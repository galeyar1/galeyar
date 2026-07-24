import { toPersianDigits } from "@/lib/jalali";
import type { Species } from "@/lib/supabase/types";

/** Full gestation length in days, per species. */
export const GESTATION_DAYS: Record<Species, number> = {
  sheep: 150,
  goat: 150,
  cattle: 283,
  horse: 340,
  camel: 390,
};

/** How many months the "ماه آبستنی" picker offers, per species. */
export const MAX_PREGNANCY_MONTH: Record<Species, number> = {
  sheep: 5,
  goat: 5,
  cattle: 9,
  horse: 12,
  camel: 12,
};

/** A pregnancy is flagged "near birth" within this many days of the due date. */
export const NEAR_BIRTH_THRESHOLD_DAYS = 14;

function daysPerMonth(species: Species): number {
  return GESTATION_DAYS[species] / MAX_PREGNANCY_MONTH[species];
}

/** Expected birth date from the recorded pregnancy month, counted forward from `fromIso` (normally today). */
export function computeExpectedBirthDate(species: Species, pregnancyMonth: number, fromIso: string): string {
  const elapsedDays = pregnancyMonth * daysPerMonth(species);
  const remainingDays = Math.round(GESTATION_DAYS[species] - elapsedDays);
  const from = new Date(fromIso);
  from.setDate(from.getDate() + remainingDays);
  return from.toISOString().slice(0, 10);
}

/** Days from `todayIso` until `expectedBirthDateIso` — negative means overdue. */
export function daysUntilBirth(expectedBirthDateIso: string, todayIso: string): number {
  const ms = new Date(expectedBirthDateIso).getTime() - new Date(todayIso).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export type PregnancyStage = "near_birth" | "overdue" | "in_progress";

export function pregnancyStage(daysUntil: number): PregnancyStage {
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= NEAR_BIRTH_THRESHOLD_DAYS) return "near_birth";
  return "in_progress";
}

/** e.g. "تا ۱۰ روز دیگر زایش خواهد کرد" / "۳ روز از سررسید گذشته است" / "زایش امروز". */
export function pregnancyStatusLabel(daysUntil: number): string {
  if (daysUntil === 0) return "زایش امروز";
  if (daysUntil > 0) return `تا ${toPersianDigits(daysUntil)} روز دیگر زایش خواهد کرد`;
  return `${toPersianDigits(Math.abs(daysUntil))} روز از سررسید زایش گذشته است`;
}

/**
 * Which animal_type values the registration form's pregnancy option applies
 * to — matches src/lib/animal-labels.ts's ANIMAL_TYPES_BY_SPECIES values,
 * not just "any female": e.g. a ewe lamb or doe kid is excluded, but per the
 * spec a female calf is explicitly included alongside an adult cow.
 */
export const PREGNANCY_ELIGIBLE_TYPES: Record<Species, string[]> = {
  sheep: ["ewe"],
  goat: ["doe"],
  cattle: ["cow", "female_calf"],
  horse: ["mare"],
  camel: ["female_camel"],
};

export function canBePregnant(species: Species, animalType: string | null | undefined): boolean {
  if (!animalType) return false;
  return PREGNANCY_ELIGIBLE_TYPES[species].includes(animalType);
}
