import { geneticDiversityScore } from "@/lib/pedigree-ai";
import type { PedigreeAnimal } from "@/lib/pedigree";

/**
 * "Genetics Assistant (light version)" — a simple, transparent heuristic
 * combining how many offspring an animal has produced with its own genetic
 * diversity score (src/lib/pedigree-ai.ts), not a real breeding-value model.
 * Inbreeding warnings reuse pedigree-ai.ts's inbreedingWarning() directly.
 */

export function offspringCount(animalId: string, allAnimals: PedigreeAnimal[]): number {
  return allAnimals.filter((a) => a.father_id === animalId || a.mother_id === animalId).length;
}

export interface GeneticScoreResult {
  animal: PedigreeAnimal;
  offspringCount: number;
  diversityScore: number | null;
  score: number;
}

/** Higher is "better": offspring count weighted more heavily than diversity, since it's the more concrete signal. */
export function geneticScore(animal: PedigreeAnimal, allAnimals: PedigreeAnimal[]): GeneticScoreResult {
  const byId = new Map(allAnimals.map((a) => [a.id, a]));
  const count = offspringCount(animal.id, allAnimals);
  const diversity = geneticDiversityScore(animal.id, byId);
  return {
    animal,
    offspringCount: count,
    diversityScore: diversity,
    score: count * 10 + (diversity ?? 0) * 0.5,
  };
}

/** The single highest-scoring animal of the given gender, or null if none exist. */
export function bestByGender(
  allAnimals: PedigreeAnimal[],
  gender: "male" | "female"
): GeneticScoreResult | null {
  const candidates = allAnimals.filter((a) => a.gender === gender);
  if (candidates.length === 0) return null;
  return candidates
    .map((a) => geneticScore(a, allAnimals))
    .sort((a, b) => b.score - a.score)[0];
}

/** The animal with the most recorded offspring overall. */
export function mostOffspring(allAnimals: PedigreeAnimal[]): GeneticScoreResult | null {
  if (allAnimals.length === 0) return null;
  return allAnimals
    .map((a) => geneticScore(a, allAnimals))
    .sort((a, b) => b.offspringCount - a.offspringCount)[0];
}
