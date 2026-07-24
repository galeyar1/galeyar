/**
 * Herd growth projection: each year, ~half the herd (breeding females)
 * produces `twinRate` offspring per animal on average; both the existing
 * herd and the new offspring are then thinned by `mortalityRate`. A rough,
 * clearly-labeled model — not a substitute for real flock records — but
 * useful for multi-year planning, which is exactly what's asked for.
 */

export const BREEDING_FEMALE_SHARE = 0.5;

// Keyed to match src/lib/animal-labels.ts's SHEEP_BREEDS exactly, plus
// "افشاری" for older records predating that closed dropdown.
export const DEFAULT_SHEEP_TWIN_RATES: Record<string, number> = {
  "محلی": 1.1,
  "افشاری": 1.3,
  "افشاری هموزایگوت": 1.8,
  "افشاری هتروزایگوت": 1.6,
  "شال": 1.2,
  "شال-رومانوف": 1.9,
  "رومانوف": 2.5,
  "رومانوف-اصف": 2.2,
  "لاکن": 1.7,
};

export const DEFAULT_GOAT_TWIN_RATES: Record<string, number> = {
  "محلی": 1.3,
  "آلپاین": 1.8,
  "سانن": 2.0,
  "بوئر": 1.9,
  "پاکستانی": 1.5,
  "اسرائیلی": 2.1,
};

export type MortalityPreset = "excellent" | "good" | "average" | "weak" | "critical";

export const DEFAULT_MORTALITY_RATES: Record<MortalityPreset, number> = {
  excellent: 0.03,
  good: 0.05,
  average: 0.08,
  weak: 0.12,
  critical: 0.15,
};

export const MORTALITY_PRESET_LABELS: Record<MortalityPreset, string> = {
  excellent: "عالی",
  good: "خوب",
  average: "متوسط",
  weak: "ضعیف",
  critical: "بحرانی",
};

/** One year's growth: surviving adults + surviving newborns. */
export function nextYearCount(count: number, twinRate: number, mortalityRate: number): number {
  const breedingFemales = count * BREEDING_FEMALE_SHARE;
  const offspring = breedingFemales * twinRate;
  const survivingOffspring = offspring * (1 - mortalityRate);
  const survivingAdults = count * (1 - mortalityRate);
  return Math.round(survivingAdults + survivingOffspring);
}

export interface YearProjection {
  year: number;
  count: number;
}

/** Year-by-year projection from year 1 through `years`, e.g. for a chart. */
export function projectHerdGrowth(
  currentCount: number,
  twinRate: number,
  mortalityRate: number,
  years: number
): YearProjection[] {
  const projections: YearProjection[] = [];
  let count = currentCount;
  for (let year = 1; year <= years; year++) {
    count = nextYearCount(count, twinRate, mortalityRate);
    projections.push({ year, count });
  }
  return projections;
}

/** Just the specific milestone years the spec asks for (1/2/3/5/10). */
export function projectMilestones(currentCount: number, twinRate: number, mortalityRate: number) {
  const full = projectHerdGrowth(currentCount, twinRate, mortalityRate, 10);
  const byYear = new Map(full.map((p) => [p.year, p.count]));
  return {
    year1: byYear.get(1)!,
    year2: byYear.get(2)!,
    year3: byYear.get(3)!,
    year5: byYear.get(5)!,
    year10: byYear.get(10)!,
  };
}
