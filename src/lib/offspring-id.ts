import { isoToJalali } from "@/lib/jalali";
import { juvenileAnimalType } from "@/lib/animal-labels";
import type { Species } from "@/lib/supabase/types";

/**
 * Automatic offspring ID system: every animal auto-created from a birth
 * record gets an ID of the form SPECIES-MOTHERID-YEAR-GENDER+NUMBER (e.g.
 * "SH-125-05-M1"), replacing the previous random-suffix ear tag. It's
 * generated once at birth registration and then stored as a normal,
 * user-editable ear_tag — nothing re-derives or locks it afterward.
 */

export const SPECIES_CODE: Record<Species, string> = {
  sheep: "SH",
  goat: "GT",
  cattle: "CT",
  camel: "CM",
  horse: "HS",
};

export type GenderCode = "M" | "F";

export const GENDER_CODE: Record<"male" | "female", GenderCode> = {
  male: "M",
  female: "F",
};

/** Last two digits of the Jalali birth year, zero-padded (1405 -> "05", 1400 -> "00"). */
export function jalaliYearSuffix(birthDateIso: string): string {
  const { jy } = isoToJalali(birthDateIso);
  return String(jy % 100).padStart(2, "0");
}

/** Builds "SH-125-05-M1" from its parts. motherEarTag is embedded as-is (e.g. "125"). */
export function buildGeneratedId(
  species: Species,
  motherEarTag: string,
  birthYear: string,
  genderCode: GenderCode,
  offspringNumber: number
): string {
  return `${SPECIES_CODE[species]}-${motherEarTag}-${birthYear}-${genderCode}${offspringNumber}`;
}

/**
 * The next `count` sequential numbers for one gender, continuing after
 * `existingMax` (the highest offspring_number already used for this
 * mother+year+gender). Never restarts mid-year, so IDs stay unique even
 * across multiple births from the same mother in the same year.
 */
export function nextOffspringNumbers(existingMax: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => existingMax + i + 1);
}

/** Human-readable title beside the generated ID, e.g. "بره نر" for a male sheep offspring. */
export function offspringTitle(species: Species, gender: "male" | "female"): string {
  return juvenileAnimalType(species, gender).label;
}
