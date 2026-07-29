import { ANIMAL_TYPES_BY_SPECIES } from "@/lib/animal-labels";
import { geneticDiversityScore, inbreedingCoefficient, INBREEDING_ALERT_THRESHOLD } from "@/lib/pedigree-ai";
import { offspringCount } from "@/lib/genetics-light";
import { healthScore } from "@/lib/genetics-advanced";
import type { PedigreeAnimal } from "@/lib/pedigree";
import type { Species } from "@/lib/supabase/types";

/**
 * Smart Herd Management Alerts — deterministic, explainable heuristics over
 * data that actually exists in GALEYAR (pedigree, genetics, disease history,
 * offspring counts). Never a real breeding-value model, never a diagnosis,
 * and never anything that changes an animal's status on its own — this only
 * ranks candidates and explains why, so the farmer decides.
 */

/** The adult, non-juvenile male type per species from ANIMAL_TYPES_BY_SPECIES — e.g. "ram" for sheep. Single source of truth: derived from the same table every other species/type UI already uses, never a separately-maintained list. */
export function breedingMaleType(species: Species): string | undefined {
  return ANIMAL_TYPES_BY_SPECIES[species].find((t) => t.gender === "male" && !t.isJuvenile)?.value;
}

export function isBreedingMale(species: Species, animalType: string | null | undefined): boolean {
  if (!animalType) return false;
  return animalType === breedingMaleType(species);
}

export function breedingFemaleType(species: Species): string | undefined {
  return ANIMAL_TYPES_BY_SPECIES[species].find((t) => t.gender === "female" && !t.isJuvenile)?.value;
}

export function isBreedingFemale(species: Species, animalType: string | null | undefined): boolean {
  if (!animalType) return false;
  return animalType === breedingFemaleType(species);
}

/**
 * General animal-husbandry guidance for how many breeding females one
 * breeding male can reasonably cover — widely-cited livestock-management
 * ranges, NOT a GALEYAR-measured fact about any specific farm. Used only as
 * a starting point for "is this ratio worth a second look", never asserted
 * as a hard rule.
 */
export const RECOMMENDED_FEMALES_PER_MALE: Record<Species, number> = {
  sheep: 30,
  goat: 25,
  cattle: 25,
  camel: 20,
  horse: 15,
};

/** How far over the recommended ratio the herd must be before it's worth flagging — avoids noise from marginal cases. */
const EXCESS_TOLERANCE = 1.3;
const MIN_MALES_TO_FLAG = 2;

export interface HerdCompositionAlert {
  species: Species;
  breedingMaleCount: number;
  breedingFemaleCount: number;
  recommendedMaleCount: number;
  excessCount: number;
}

/** Null when there's nothing worth flagging for this species (too few males, or the ratio is within a reasonable range). Never based on raw male count alone — always relative to the recorded breeding-female population. */
export function computeHerdCompositionAlert(
  animals: { species: Species; animal_type: string | null; status: string; deleted_at?: string | null }[],
  species: Species
): HerdCompositionAlert | null {
  const active = animals.filter((a) => a.species === species && a.status === "active" && !a.deleted_at);
  const breedingMaleCount = active.filter((a) => isBreedingMale(species, a.animal_type)).length;
  const breedingFemaleCount = active.filter((a) => isBreedingFemale(species, a.animal_type)).length;

  if (breedingMaleCount < MIN_MALES_TO_FLAG || breedingFemaleCount === 0) return null;

  const recommendedMaleCount = Math.max(1, Math.ceil(breedingFemaleCount / RECOMMENDED_FEMALES_PER_MALE[species]));
  if (breedingMaleCount <= recommendedMaleCount * EXCESS_TOLERANCE) return null;

  return {
    species,
    breedingMaleCount,
    breedingFemaleCount,
    recommendedMaleCount,
    excessCount: breedingMaleCount - recommendedMaleCount,
  };
}

/** Centralized so weights can be tuned later in one place, never scattered across UI components. */
export const HERD_ALERT_WEIGHTS = {
  relatedness: 0.4,
  lowDiversity: 0.25,
  lowGeneticScore: 0.15,
  health: 0.15,
  age: 0.05,
};

export interface MaleReviewCandidate {
  animal: PedigreeAnimal;
  reviewScore: number | null;
  reasons: string[];
  factors: {
    avgRelatednessToFemales: number | null;
    fractionFemalesRelated: number | null;
    diversityScore: number | null;
    geneticScore: number | null;
    diseaseCount: number;
    offspringCount: number;
    ageYears: number | null;
  };
  dataQualityNote: string | null;
}

function ageInYears(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const ms = Date.now() - new Date(birthDate).getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

/**
 * Ranks breeding males as candidates worth reviewing for sale/removal from
 * the breeding herd — highest reviewScore first. This is a recommendation
 * ranking only: it never touches animals.status/exit_reason, and the score
 * is a weighted average of only the factors that actually have data for
 * that animal (missing data is excluded from the average, never treated as
 * a zero/bad score).
 */
export function rankMaleReviewCandidates(
  males: (PedigreeAnimal & { genetic_score: number | null; birth_date?: string | null })[],
  breedingFemales: PedigreeAnimal[],
  byId: Map<string, PedigreeAnimal>,
  diseaseCountByAnimalId: Map<string, number>
): MaleReviewCandidate[] {
  return males
    .map((male) => {
      const relatedness = breedingFemales.map((f) => inbreedingCoefficient(male.id, f.id, byId));
      const hasPedigreeSignal = relatedness.some((r) => r > 0) || geneticDiversityScore(male.id, byId) !== null;
      const avgRelatednessToFemales = breedingFemales.length > 0 ? relatedness.reduce((s, r) => s + r, 0) / breedingFemales.length : null;
      const fractionFemalesRelated =
        breedingFemales.length > 0 ? relatedness.filter((r) => r >= INBREEDING_ALERT_THRESHOLD).length / breedingFemales.length : null;
      const diversityScore = geneticDiversityScore(male.id, byId);
      const diseaseCount = diseaseCountByAnimalId.get(male.id) ?? 0;
      const offspring = offspringCount(male.id, [...byId.values()]);
      const ageYears = ageInYears(male.birth_date);

      // Normalize each available factor to 0-1 ("1" = stronger candidate for review), then a weighted average over only the factors with real data.
      const parts: { weight: number; value: number }[] = [];
      if (avgRelatednessToFemales !== null) parts.push({ weight: HERD_ALERT_WEIGHTS.relatedness, value: Math.min(1, avgRelatednessToFemales / 0.25) });
      if (diversityScore !== null) parts.push({ weight: HERD_ALERT_WEIGHTS.lowDiversity, value: 1 - diversityScore / 100 });
      if (male.genetic_score !== null) parts.push({ weight: HERD_ALERT_WEIGHTS.lowGeneticScore, value: 1 - Math.min(100, male.genetic_score) / 100 });
      parts.push({ weight: HERD_ALERT_WEIGHTS.health, value: 1 - healthScore(diseaseCount) / 100 });
      if (ageYears !== null) parts.push({ weight: HERD_ALERT_WEIGHTS.age, value: Math.min(1, ageYears / 8) });

      const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
      const reviewScore = totalWeight > 0 ? Math.round((parts.reduce((s, p) => s + p.weight * p.value, 0) / totalWeight) * 100) : null;

      const reasons: string[] = [];
      if (fractionFemalesRelated !== null && fractionFemalesRelated >= 0.5) {
        reasons.push("بخش زیادی از میش‌های مولد فعلی با این قوچ خویشاوند هستند");
      } else if (avgRelatednessToFemales !== null && avgRelatednessToFemales >= INBREEDING_ALERT_THRESHOLD) {
        reasons.push("این قوچ خویشاوندی بیشتری با میش‌های مولد فعلی دارد");
      }
      if (diversityScore !== null && diversityScore < 50) {
        reasons.push("سهم این قوچ در تنوع ژنتیکی گله پایین است");
      }
      if (diseaseCount >= 2) {
        reasons.push("سوابق سلامت ثبت‌شده این دام نیاز به بررسی دارد");
      }
      if (male.genetic_score !== null && male.genetic_score < 40) {
        reasons.push("امتیاز ژنتیکی ثبت‌شده این دام پایین است");
      }

      return {
        animal: male,
        reviewScore,
        reasons,
        factors: {
          avgRelatednessToFemales,
          fractionFemalesRelated,
          diversityScore,
          geneticScore: male.genetic_score,
          diseaseCount,
          offspringCount: offspring,
          ageYears,
        },
        dataQualityNote: !hasPedigreeSignal && male.genetic_score === null && diseaseCount === 0 ? "داده کافی برای ارزیابی کامل وجود ندارد." : null,
      };
    })
    .sort((a, b) => (b.reviewScore ?? -1) - (a.reviewScore ?? -1));
}
