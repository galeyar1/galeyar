import { clampScore } from "@/lib/genetics-advanced";

/**
 * Farm Performance: five 0-100 metrics plus an overall average. Every metric
 * is computed from data the app actually records — "feed efficiency" here
 * means "how often feed nearly runs out", a real proxy available today, not
 * true output-per-input efficiency (which would need production data this
 * app doesn't track).
 */

export function birthRatePercent(birthsThisYear: number, femaleCount: number): number {
  if (femaleCount <= 0) return 0;
  return clampScore((birthsThisYear / femaleCount) * 100);
}

/** Lower mortality is better, so this returns the *survival* score (100 - mortality%). */
export function mortalityScore(deadCount: number, totalEverCount: number): number {
  if (totalEverCount <= 0) return 100;
  const mortalityPercent = (deadCount / totalEverCount) * 100;
  return clampScore(100 - mortalityPercent);
}

export function vaccinationCoveragePercent(vaccinatedCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0;
  return clampScore((vaccinatedCount / totalCount) * 100);
}

/** Share of feed items that are NOT close to running out. */
export function feedEfficiencyScore(itemsWithoutAlert: number, totalItems: number): number {
  if (totalItems <= 0) return 100;
  return clampScore((itemsWithoutAlert / totalItems) * 100);
}

/** Net profit margin as a 0-100 score (negative margin clamps to 0). */
export function profitabilityScore(netProfit: number, revenue: number): number {
  if (revenue <= 0) return netProfit > 0 ? 100 : 0;
  return clampScore((netProfit / revenue) * 100);
}

/** Centers 0% year-over-year growth at a neutral 50, rewarding growth and penalizing shrinkage. */
export function herdGrowthScore(yoyGrowthPercent: number): number {
  return clampScore(50 + yoyGrowthPercent);
}

export interface FarmPerformanceInputs {
  birthRate: number;
  mortality: number;
  feedEfficiency: number;
  profitability: number;
  vaccinationCoverage: number;
  herdGrowth: number;
}

export function overallPerformanceScore(inputs: FarmPerformanceInputs): number {
  const values = Object.values(inputs);
  return clampScore(values.reduce((sum, v) => sum + v, 0) / values.length);
}
