import { geneticScore } from "@/lib/genetics-light";
import type { PedigreeAnimal } from "@/lib/pedigree";

/**
 * Four-factor advanced genetic scoring (0-100 each) plus an overall average
 * — an explicit, inspectable heuristic (like everything else in this app's
 * "AI"), not a real breeding-value model. Each factor uses whatever data is
 * actually recorded; missing data defaults to a neutral 50, not a guess.
 */

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** From weight_records: average monthly weight gain vs a benchmark. Null input (fewer than 2 records) -> neutral 50. */
export function growthScore(weightRecords: { weight: number; record_date: string }[], benchmarkKgPerMonth = 4): number {
  if (weightRecords.length < 2) return 50;
  const sorted = [...weightRecords].sort((a, b) => (a.record_date < b.record_date ? -1 : 1));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const days = (new Date(last.record_date).getTime() - new Date(first.record_date).getTime()) / 86_400_000;
  if (days <= 0) return 50;
  const gainPerMonth = ((last.weight - first.weight) / days) * 30;
  return clampScore((gainPerMonth / benchmarkKgPerMonth) * 100);
}

/** From birth_records where this animal is the mother: more successful births -> higher score, capped at 100. */
export function fertilityScore(birthEventCount: number, perBirth = 20): number {
  return clampScore(birthEventCount * perBirth);
}

/** From disease_records: each recorded case costs points, floor at 0. */
export function healthScore(diseaseCount: number, perCase = 12): number {
  return clampScore(100 - diseaseCount * perCase);
}

/** Reuses the existing offspring-count + diversity heuristic (src/lib/genetics-light.ts), normalized into 0-100. */
export function geneticsScore(animal: PedigreeAnimal, allAnimals: PedigreeAnimal[]): number {
  const raw = geneticScore(animal, allAnimals).score;
  return clampScore(raw);
}

export interface AdvancedGeneticProfile {
  genetics: number;
  growth: number;
  fertility: number;
  health: number;
  overall: number;
}

export function buildAdvancedProfile(parts: Omit<AdvancedGeneticProfile, "overall">): AdvancedGeneticProfile {
  const overall = clampScore((parts.genetics + parts.growth + parts.fertility + parts.health) / 4);
  return { ...parts, overall };
}
