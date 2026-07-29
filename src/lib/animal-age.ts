import { todayIso } from "@/lib/jalali";

export const MAX_AGE_MONTHS = 360;

/**
 * Age-in-months is a convenience INPUT method, never a second persisted
 * fact — birth_date stays the single source of truth every age/juvenile
 * computation already derives from (ageInYears/effectiveAnimalType in
 * animal-labels.ts). Both Single and Bulk Registration call this same
 * function so "6 months old, relative to the entry date" means exactly
 * the same stored birth_date everywhere in the app.
 */
export function estimateBirthDateFromAgeMonths(ageMonths: number, referenceDateIso: string = todayIso()): string {
  const [y, m, d] = referenceDateIso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCMonth(date.getUTCMonth() - ageMonths);
  return date.toISOString().slice(0, 10);
}

export function isValidAgeMonths(value: string): boolean {
  if (value.trim() === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= MAX_AGE_MONTHS;
}
