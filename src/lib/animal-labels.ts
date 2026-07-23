import type { Species } from "@/lib/supabase/types";

export const SPECIES_LABELS: Record<Species, string> = {
  sheep: "گوسفند",
  goat: "بز",
  cattle: "گاو",
  camel: "شتر",
  horse: "اسب",
};

export const ANIMAL_TYPES_BY_SPECIES: Record<
  Species,
  { value: string; label: string; gender: "male" | "female" }[]
> = {
  sheep: [
    { value: "ram", label: "قوچ", gender: "male" },
    { value: "ewe", label: "میش", gender: "female" },
    { value: "ram_lamb", label: "بره نر", gender: "male" },
    { value: "ewe_lamb", label: "بره ماده", gender: "female" },
  ],
  goat: [
    { value: "buck", label: "بز نر", gender: "male" },
    { value: "doe", label: "بز ماده", gender: "female" },
    { value: "male_kid", label: "بزغاله نر", gender: "male" },
    { value: "female_kid", label: "بزغاله ماده", gender: "female" },
  ],
  cattle: [
    { value: "bull", label: "گاو نر", gender: "male" },
    { value: "cow", label: "گاو ماده", gender: "female" },
    { value: "male_calf", label: "گوساله نر", gender: "male" },
    { value: "female_calf", label: "گوساله ماده", gender: "female" },
  ],
  camel: [
    { value: "male_camel", label: "شتر نر", gender: "male" },
    { value: "female_camel", label: "شتر ماده", gender: "female" },
    { value: "male_camel_calf", label: "بچه‌شتر نر", gender: "male" },
    { value: "female_camel_calf", label: "بچه‌شتر ماده", gender: "female" },
  ],
  horse: [
    { value: "stallion", label: "اسب نر", gender: "male" },
    { value: "mare", label: "مادیان", gender: "female" },
    { value: "male_foal", label: "کره اسب نر", gender: "male" },
    { value: "female_foal", label: "کره اسب ماده", gender: "female" },
  ],
};

/** animal_type assigned to offspring auto-created from a birth registration. */
export const BIRTH_OFFSPRING_TYPE: Record<Species, { male: string; female: string }> = {
  sheep: { male: "ram_lamb", female: "ewe_lamb" },
  goat: { male: "male_kid", female: "female_kid" },
  cattle: { male: "male_calf", female: "female_calf" },
  camel: { male: "male_camel_calf", female: "female_camel_calf" },
  horse: { male: "male_foal", female: "female_foal" },
};

export const ANIMAL_STATUS_LABELS = {
  active: "فعال",
  sold: "فروخته‌شده",
  dead: "تلف‌شده",
} as const;

/** Looks up an animal_type's label across every species (list/history views only have the code, not the species-scoped list). */
export function animalTypeLabel(animalType: string | null): string | null {
  if (!animalType) return null;
  for (const options of Object.values(ANIMAL_TYPES_BY_SPECIES)) {
    const match = options.find((o) => o.value === animalType);
    if (match) return match.label;
  }
  return animalType;
}
