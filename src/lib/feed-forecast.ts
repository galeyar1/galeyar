/**
 * Feed forecasting from a single "daily consumption rate" set once per feed
 * type — the spec's explicit alternative to logging consumption every day.
 * Pure arithmetic; the existing daily-log-based rolling average (src/app/
 * (app)/feed/page.tsx) is untouched and still works for farms that prefer it.
 */

const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;

export function monthlyFromDaily(dailyRate: number): number {
  return dailyRate * DAYS_PER_MONTH;
}

export function annualFromDaily(dailyRate: number): number {
  return dailyRate * DAYS_PER_YEAR;
}

/** Whole days of stock left at the current quantity and daily rate, or null when the rate is unknown/zero. */
export function daysRemaining(quantity: number, dailyRate: number | null): number | null {
  if (!dailyRate || dailyRate <= 0) return null;
  return Math.floor(quantity / dailyRate);
}

/** Cost per animal per day — null when either the unit cost or the animal count is unknown/zero. */
export function costPerAnimalPerDay(
  dailyRate: number,
  unitCost: number | null,
  animalCount: number
): number | null {
  if (!unitCost || animalCount <= 0) return null;
  return (dailyRate * unitCost) / animalCount;
}
