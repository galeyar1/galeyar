import type { Species } from "@/lib/supabase/types";

export const SPECIES_LABELS: Record<Species, string> = {
  sheep: "گوسفند",
  goat: "بز",
  cattle: "گاو",
  camel: "شتر",
};

export const ANIMAL_TYPES_BY_SPECIES: Record<
  Species,
  { value: string; label: string; gender: "male" | "female" }[]
> = {
  sheep: [
    { value: "ram", label: "قوچ", gender: "male" },
    { value: "ewe", label: "میش", gender: "female" },
  ],
  goat: [
    { value: "buck", label: "بز نر", gender: "male" },
    { value: "doe", label: "بز ماده", gender: "female" },
  ],
  cattle: [
    { value: "bull", label: "گاو نر", gender: "male" },
    { value: "cow", label: "گاو ماده", gender: "female" },
  ],
  camel: [
    { value: "male_camel", label: "شتر نر", gender: "male" },
    { value: "female_camel", label: "شتر ماده", gender: "female" },
  ],
};

export const ANIMAL_STATUS_LABELS = {
  active: "فعال",
  sold: "فروخته‌شده",
  dead: "تلف‌شده",
} as const;
