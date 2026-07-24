/**
 * Cross-cutting business comparisons: per-animal profit/cost/production
 * leaders, and per-farm comparison (for owners with more than one farm).
 */

export interface AnimalFinancialSummary {
  animalId: string;
  revenue: number;
  expense: number;
}

export interface AnimalRanking {
  animalId: string;
  value: number;
}

/** Revenue minus attributed expense per animal, highest first. Null if no animals have any transactions. */
export function mostProfitableAnimal(summaries: AnimalFinancialSummary[]): AnimalRanking | null {
  if (summaries.length === 0) return null;
  return summaries
    .map((s) => ({ animalId: s.animalId, value: s.revenue - s.expense }))
    .sort((a, b) => b.value - a.value)[0];
}

export function mostExpensiveAnimal(summaries: AnimalFinancialSummary[]): AnimalRanking | null {
  if (summaries.length === 0) return null;
  return summaries.map((s) => ({ animalId: s.animalId, value: s.expense })).sort((a, b) => b.value - a.value)[0];
}

export function highestProducingAnimal(milkTotals: AnimalRanking[]): AnimalRanking | null {
  if (milkTotals.length === 0) return null;
  return [...milkTotals].sort((a, b) => b.value - a.value)[0];
}

export interface FarmScore {
  farmId: string;
  farmName: string;
  score: number;
}

export function bestFarm(farms: FarmScore[]): FarmScore | null {
  if (farms.length === 0) return null;
  return [...farms].sort((a, b) => b.score - a.score)[0];
}

export function worstFarm(farms: FarmScore[]): FarmScore | null {
  if (farms.length === 0) return null;
  return [...farms].sort((a, b) => a.score - b.score)[0];
}
