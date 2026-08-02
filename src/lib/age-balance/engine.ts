import { resolveAgeProfile } from "@/lib/age-balance/profile-resolver";
import { classifyLifeStage, monthsUntilSeniorMonitoring } from "@/lib/age-balance/life-stage";
import { assessDataQuality, type DataQualityResult } from "@/lib/age-balance/confidence";
import { isBreedingMale, isBreedingFemale } from "@/lib/herd-alerts";
import { AGE_BALANCE_MODEL_VERSION, type LifeStage, type ConfidenceLevel } from "@/lib/age-balance/species-profiles";
import type { Species } from "@/lib/supabase/types";

export { AGE_BALANCE_MODEL_VERSION };

/**
 * Herd Age Balance & Replacement Intelligence — deterministic scoring
 * engine (spec section 42: "structured farm data -> deterministic scoring
 * engine -> structured result -> AI explanation", never "farm data -> LLM
 * guesses a score"). Every score here is a plain, inspectable formula over
 * real Galeyar data; src/lib/age-balance/explain.ts turns the STRUCTURED
 * RESULT this file returns into Persian sentences — it never recomputes or
 * second-guesses a number.
 *
 * Weights are centralized here (spec section 3) rather than scattered
 * through UI components, and are explicitly product-model defaults, not
 * universal scientific constants.
 */
export const AGE_BALANCE_WEIGHTS = {
  breedingStructure: 0.35,
  replacementCoverage: 0.3,
  ageRisk: 0.2,
  reproductiveSustainability: 0.15,
};

export interface AgeBalanceAnimalInput {
  id: string;
  ear_tag: string;
  name: string | null;
  species: Species;
  breed: string | null;
  gender: "male" | "female" | null;
  animal_type: string | null;
  birth_date: string | null;
  is_pregnant: boolean;
}

export interface AgeBalanceInput {
  /** Already farm-scoped and active-only — this module never filters status/farm itself, so callers can't accidentally leak another farm's or a sold/dead animal's data in. */
  animals: AgeBalanceAnimalInput[];
  latestWeightByAnimalId: Map<string, number>;
  /** Already farm-scoped birth_records, for recent-birth / reproductive-sustainability signal. */
  birthRecordDatesByMother: Map<string, string[]>;
  growthObjective: "maintain" | "grow" | "reduce" | null;
  growthTargetPercent: number | null;
  referenceDateIso: string;
}

export interface ReplacementResult {
  expectedExits12m: number;
  growthRequirement: number;
  replacementNeed: number;
  eligibleReplacementFemales: number;
  /** null when replacementNeed is 0 — "no need" is not the same as "100% covered," and this avoids ever dividing by zero. */
  coveragePercent: number | null;
  coverageBand: string | null;
}

export interface ComponentScores {
  breedingStructure: number | null;
  replacementCoverage: number | null;
  ageRisk: number | null;
  reproductiveSustainability: number | null;
}

export interface AgeDistributionBucket {
  stage: LifeStage;
  count: number;
  percent: number;
  animalIds: string[];
}

export interface BreedingStructureBySpecies {
  species: Species;
  breedingMales: number;
  breedingFemales: number;
  ratio: number | null;
}

export interface AgeBalanceResult {
  modelVersion: string;
  confidence: ConfidenceLevel;
  dataQuality: DataQualityResult;
  totalActiveAnimals: number;
  totalBreedingFemales: number;
  youthIndex: number | null;
  ageBalanceScore: number | null;
  components: ComponentScores;
  replacement: ReplacementResult;
  ageDistribution: AgeDistributionBucket[];
  breedingStructureBySpecies: BreedingStructureBySpecies[];
  /** Animals in senior_monitoring — grouped for one alert, never one notification per animal (spec section 27). */
  seniorReviewAnimals: AgeBalanceAnimalInput[];
  /** Exposed so the explanation/alert layer (explain.ts) never has to recompute these from scratch — it only reads the structured result. */
  shares: {
    seniorBreedingFemalePercent: number;
    primeBreedingFemalePercent: number;
    /** Share of ALL active animals not yet at a breeding life stage (neonatal/growing/replacement_candidate). */
    notYetBreedingPercent: number;
    /** Share of all active animals that are currently breeding-eligible females. */
    activeBreedingFemalePercent: number;
  };
}

function clamp01to100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** Weighted average over only the components that actually have a value — a missing component is excluded, never treated as zero (spec sections 45-47). */
function weightedAverage(parts: { weight: number; value: number | null }[]): number | null {
  const available = parts.filter((p): p is { weight: number; value: number } => p.value !== null);
  const totalWeight = available.reduce((s, p) => s + p.weight, 0);
  if (totalWeight === 0) return null;
  return clamp01to100(available.reduce((s, p) => s + p.weight * p.value, 0) / totalWeight);
}

const YOUTH_VALUE_BY_STAGE: Record<LifeStage, number> = {
  neonatal: 100,
  growing: 90,
  replacement_candidate: 75,
  young_breeding: 55,
  mature_breeding: 35,
  senior_breeding: 15,
  senior_monitoring: 5,
};

/** Average of the farm's own most-recent weights for animals already in mature_breeding of this species+gender — a data-derived reference, never an invented breed/species weight constant. Null when the farm has no such data yet. */
function farmMatureWeightReference(
  species: Species,
  gender: "male" | "female",
  animals: AgeBalanceAnimalInput[],
  weightById: Map<string, number>
): number | null {
  const weights: number[] = [];
  for (const a of animals) {
    if (a.species !== species || a.gender !== gender) continue;
    const profile = resolveAgeProfile(a.species, a.breed);
    if (classifyLifeStage(a.birth_date, profile) !== "mature_breeding") continue;
    const w = weightById.get(a.id);
    if (w !== undefined) weights.push(w);
  }
  if (weights.length === 0) return null;
  return weights.reduce((s, w) => s + w, 0) / weights.length;
}

export function analyzeHerdAgeBalance(input: AgeBalanceInput): AgeBalanceResult {
  const { animals, latestWeightByAnimalId, birthRecordDatesByMother, referenceDateIso } = input;

  const dataQuality = assessDataQuality({
    totalAnimals: animals.length,
    animalsWithBirthDate: animals.filter((a) => a.birth_date).length,
    animalsWithBreed: animals.filter((a) => a.breed).length,
    animalsWithWeight: animals.filter((a) => latestWeightByAnimalId.has(a.id)).length,
  });

  if (animals.length === 0 || dataQuality.confidence === "insufficient") {
    return {
      modelVersion: AGE_BALANCE_MODEL_VERSION,
      confidence: dataQuality.confidence,
      dataQuality,
      totalActiveAnimals: animals.length,
      totalBreedingFemales: 0,
      youthIndex: null,
      ageBalanceScore: null,
      components: { breedingStructure: null, replacementCoverage: null, ageRisk: null, reproductiveSustainability: null },
      replacement: { expectedExits12m: 0, growthRequirement: 0, replacementNeed: 0, eligibleReplacementFemales: 0, coveragePercent: null, coverageBand: null },
      ageDistribution: [],
      breedingStructureBySpecies: [],
      seniorReviewAnimals: [],
      shares: { seniorBreedingFemalePercent: 0, primeBreedingFemalePercent: 0, notYetBreedingPercent: 0, activeBreedingFemalePercent: 0 },
    };
  }

  // --- life-stage classification, once per animal ---
  const classified = animals.map((a) => ({
    animal: a,
    profile: resolveAgeProfile(a.species, a.breed),
    stage: classifyLifeStage(a.birth_date, resolveAgeProfile(a.species, a.breed)),
  }));

  // --- Youth Index: population-wide average of each animal's own species-relative youth value ---
  const withStage = classified.filter((c) => c.stage !== null);
  const youthIndex =
    withStage.length > 0
      ? clamp01to100(withStage.reduce((sum, c) => sum + YOUTH_VALUE_BY_STAGE[c.stage as LifeStage], 0) / withStage.length)
      : null;

  // --- age distribution ---
  const bucketMap = new Map<LifeStage, { count: number; ids: string[] }>();
  for (const c of withStage) {
    const entry = bucketMap.get(c.stage as LifeStage) ?? { count: 0, ids: [] };
    entry.count += 1;
    entry.ids.push(c.animal.id);
    bucketMap.set(c.stage as LifeStage, entry);
  }
  const ageDistribution: AgeDistributionBucket[] = [...bucketMap.entries()].map(([stage, { count, ids }]) => ({
    stage,
    count,
    percent: withStage.length > 0 ? Math.round((count / withStage.length) * 100) : 0,
    animalIds: ids,
  }));

  // --- breeding population (females/males already at the adult breeding animal_type) ---
  const breedingFemales = classified.filter((c) => isBreedingFemale(c.animal.species, c.animal.animal_type));
  const breedingMales = classified.filter((c) => isBreedingMale(c.animal.species, c.animal.animal_type));
  const totalBreedingFemales = breedingFemales.length;

  const speciesPresent = [...new Set(animals.map((a) => a.species))];
  const breedingStructureBySpecies: BreedingStructureBySpecies[] = speciesPresent.map((species) => {
    const males = breedingMales.filter((c) => c.animal.species === species).length;
    const females = breedingFemales.filter((c) => c.animal.species === species).length;
    return { species, breedingMales: males, breedingFemales: females, ratio: males > 0 ? Math.round((females / males) * 10) / 10 : null };
  });

  // --- Breeding Structure Score: reward the breeding-female population being concentrated in prime (young+mature) life stages, relative to a 60% "balanced" reference ---
  const IDEAL_PRIME_SHARE = 0.6;
  const primeCount = breedingFemales.filter((c) => c.stage === "young_breeding" || c.stage === "mature_breeding").length;
  const primeShare = totalBreedingFemales > 0 ? primeCount / totalBreedingFemales : null;
  const breedingStructureScore = primeShare !== null ? clamp01to100(100 - Math.abs(primeShare - IDEAL_PRIME_SHARE) * 100 * 1.2) : null;

  // --- Replacement need/coverage ---
  const seniorBreedingFemales = breedingFemales.filter((c) => c.stage === "senior_breeding" || c.stage === "senior_monitoring");
  const expectedExits12m = breedingFemales.filter((c) => {
    const remaining = monthsUntilSeniorMonitoring(c.animal.birth_date, c.profile);
    return remaining !== null && remaining <= 12;
  }).length;

  const growthRequirement =
    input.growthObjective === "grow" && input.growthTargetPercent
      ? Math.max(0, Math.ceil((totalBreedingFemales * input.growthTargetPercent) / 100))
      : 0;
  const replacementNeed = expectedExits12m + growthRequirement;

  const eligibleReplacementFemales = classified.filter((c) => {
    if (c.animal.gender !== "female" || c.stage !== "replacement_candidate") return false;
    const weight = latestWeightByAnimalId.get(c.animal.id);
    if (weight === undefined) return true; // age-based estimate, lower overall confidence already reflected in dataQuality
    const matureRef = farmMatureWeightReference(c.animal.species, "female", animals, latestWeightByAnimalId);
    const readiness = c.profile.reproductiveParameters.matureWeightReadinessPercent;
    if (matureRef === null || !readiness) return true; // no farm reference yet to compare against
    return weight >= (matureRef * readiness[0]) / 100;
  }).length;

  const coveragePercent = replacementNeed > 0 ? Math.round((eligibleReplacementFemales / replacementNeed) * 100) : null;
  const coverageBand =
    coveragePercent === null
      ? null
      : coveragePercent >= 120
        ? "ذخیره جایگزینی مناسب"
        : coveragePercent >= 90
          ? "مناسب"
          : coveragePercent >= 70
            ? "نیازمند توجه"
            : "کمبود جایگزین";

  const replacementCoverageScore = coveragePercent === null ? 100 : clamp01to100(coveragePercent);

  // --- Age Risk Score: senior concentration + projected transition, not raw average age ---
  const seniorSharePercent = totalBreedingFemales > 0 ? (seniorBreedingFemales.length / totalBreedingFemales) * 100 : 0;
  const projectedTransitionPercent = totalBreedingFemales > 0 ? (expectedExits12m / totalBreedingFemales) * 100 : 0;
  const coverageShortfallPenalty = replacementNeed > 0 && coveragePercent !== null && coveragePercent < 70 ? 15 : 0;
  const ageRiskScore =
    totalBreedingFemales > 0
      ? clamp01to100(100 - seniorSharePercent * 1.0 - projectedTransitionPercent * 0.5 - coverageShortfallPenalty)
      : null;

  // --- Reproductive Sustainability: recent births + pregnancy + replacement pipeline, using real records only ---
  const hasAnyBirthHistory = birthRecordDatesByMother.size > 0;
  const eighteenMonthsAgo = new Date(referenceDateIso);
  eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
  const eighteenMonthsAgoIso = eighteenMonthsAgo.toISOString().slice(0, 10);

  const recentBirthCount = breedingFemales.filter((c) =>
    (birthRecordDatesByMother.get(c.animal.id) ?? []).some((d) => d >= eighteenMonthsAgoIso)
  ).length;
  const pregnantCount = breedingFemales.filter((c) => c.animal.is_pregnant).length;
  const replacementPipelineShare = totalBreedingFemales > 0 ? eligibleReplacementFemales / totalBreedingFemales : 0;

  const reproductiveSustainabilityScore =
    !hasAnyBirthHistory || totalBreedingFemales === 0
      ? null
      : clamp01to100(
          0.5 * ((recentBirthCount / totalBreedingFemales) * 100) +
            0.2 * ((pregnantCount / totalBreedingFemales) * 100) +
            0.3 * Math.min(100, replacementPipelineShare * 100 * 3)
        );

  const components: ComponentScores = {
    breedingStructure: breedingStructureScore,
    replacementCoverage: replacementCoverageScore,
    ageRisk: ageRiskScore,
    reproductiveSustainability: reproductiveSustainabilityScore,
  };

  const ageBalanceScore = weightedAverage([
    { weight: AGE_BALANCE_WEIGHTS.breedingStructure, value: components.breedingStructure },
    { weight: AGE_BALANCE_WEIGHTS.replacementCoverage, value: components.replacementCoverage },
    { weight: AGE_BALANCE_WEIGHTS.ageRisk, value: components.ageRisk },
    { weight: AGE_BALANCE_WEIGHTS.reproductiveSustainability, value: components.reproductiveSustainability },
  ]);

  const seniorReviewAnimals = classified.filter((c) => c.stage === "senior_monitoring").map((c) => c.animal);

  const notYetBreedingCount = classified.filter(
    (c) => c.stage === "neonatal" || c.stage === "growing" || c.stage === "replacement_candidate"
  ).length;

  return {
    modelVersion: AGE_BALANCE_MODEL_VERSION,
    confidence: dataQuality.confidence,
    dataQuality,
    totalActiveAnimals: animals.length,
    totalBreedingFemales,
    youthIndex,
    ageBalanceScore,
    components,
    replacement: {
      expectedExits12m,
      growthRequirement,
      replacementNeed,
      eligibleReplacementFemales,
      coveragePercent,
      coverageBand,
    },
    ageDistribution,
    breedingStructureBySpecies,
    seniorReviewAnimals,
    shares: {
      seniorBreedingFemalePercent: Math.round(seniorSharePercent),
      primeBreedingFemalePercent: primeShare !== null ? Math.round(primeShare * 100) : 0,
      notYetBreedingPercent: animals.length > 0 ? Math.round((notYetBreedingCount / animals.length) * 100) : 0,
      activeBreedingFemalePercent: animals.length > 0 ? Math.round((totalBreedingFemales / animals.length) * 100) : 0,
    },
  };
}

export function youthIndexBand(youthIndex: number): string {
  if (youthIndex <= 20) return "بسیار پیر";
  if (youthIndex <= 40) return "متمایل به پیری";
  if (youthIndex <= 60) return "میانه";
  if (youthIndex <= 80) return "متمایل به جوانی";
  return "بسیار جوان";
}

export function ageBalanceBand(score: number): string {
  if (score < 40) return "ضعیف";
  if (score < 60) return "نیازمند توجه";
  if (score < 80) return "مناسب";
  return "متعادل";
}
