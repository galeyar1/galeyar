import { toPersianDigits } from "@/lib/jalali";
import type { Species } from "@/lib/supabase/types";

export const SPECIES_LABELS: Record<Species, string> = {
  sheep: "گوسفند",
  goat: "بز",
  cattle: "گاو",
  camel: "شتر",
  horse: "اسب",
};

export interface AnimalTypeOption {
  value: string;
  label: string;
  gender: "male" | "female";
  /** True for the juvenile (under JUVENILE_AGE_MONTHS) designation of this species+gender. */
  isJuvenile: boolean;
}

export const ANIMAL_TYPES_BY_SPECIES: Record<Species, AnimalTypeOption[]> = {
  sheep: [
    { value: "ram", label: "قوچ", gender: "male", isJuvenile: false },
    { value: "ewe", label: "میش", gender: "female", isJuvenile: false },
    { value: "ram_lamb", label: "بره نر", gender: "male", isJuvenile: true },
    { value: "ewe_lamb", label: "بره ماده", gender: "female", isJuvenile: true },
  ],
  goat: [
    { value: "buck", label: "بز نر", gender: "male", isJuvenile: false },
    { value: "doe", label: "بز ماده", gender: "female", isJuvenile: false },
    { value: "male_kid", label: "بزغاله نر", gender: "male", isJuvenile: true },
    { value: "female_kid", label: "بزغاله ماده", gender: "female", isJuvenile: true },
  ],
  cattle: [
    { value: "bull", label: "گاو نر", gender: "male", isJuvenile: false },
    { value: "cow", label: "گاو ماده", gender: "female", isJuvenile: false },
    { value: "male_calf", label: "گوساله نر", gender: "male", isJuvenile: true },
    { value: "female_calf", label: "گوساله ماده", gender: "female", isJuvenile: true },
  ],
  camel: [
    { value: "male_camel", label: "شتر نر", gender: "male", isJuvenile: false },
    { value: "female_camel", label: "شتر ماده", gender: "female", isJuvenile: false },
    { value: "male_camel_calf", label: "بچه‌شتر نر", gender: "male", isJuvenile: true },
    { value: "female_camel_calf", label: "بچه‌شتر ماده", gender: "female", isJuvenile: true },
  ],
  horse: [
    { value: "stallion", label: "نریان", gender: "male", isJuvenile: false },
    { value: "mare", label: "مادیان", gender: "female", isJuvenile: false },
    { value: "male_foal", label: "کره اسب نر", gender: "male", isJuvenile: true },
    { value: "female_foal", label: "کره اسب ماده", gender: "female", isJuvenile: true },
  ],
};

export const ANIMAL_STATUS_LABELS = {
  active: "فعال",
  sold: "فروخته‌شده",
  dead: "تلف‌شده",
} as const;

/** Sheep breed is a closed dropdown per the spec; other species keep free text. */
export const SHEEP_BREEDS = [
  "محلی",
  "افشاری هموزایگوت",
  "افشاری هتروزایگوت",
  "شال",
  "شال-رومانوف",
  "لاکن",
  "اَصف",
  "رومانوف",
  "رومانوف-اصف",
  "رومن",
] as const;

export const GOAT_BREEDS = ["محلی", "آلپاین", "سانن", "بوئر", "پاکستانی", "اسرائیلی"] as const;

export const DEFAULT_BREED = "محلی";

/** Species that use a closed breed dropdown instead of free text. */
export function breedOptionsFor(species: Species): readonly string[] | null {
  if (species === "sheep") return SHEEP_BREEDS;
  if (species === "goat") return GOAT_BREEDS;
  return null;
}

/** Looks up an animal_type's label across every species (list/history views only have the code, not the species-scoped list). */
export function animalTypeLabel(animalType: string | null): string | null {
  if (!animalType) return null;
  for (const options of Object.values(ANIMAL_TYPES_BY_SPECIES)) {
    const match = options.find((o) => o.value === animalType);
    if (match) return match.label;
  }
  return animalType;
}

/** Age in fractional years, or null when birth_date is unknown. */
export function ageInYears(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const ms = Date.now() - new Date(birthDate).getTime();
  return ms / (1000 * 60 * 60 * 24 * 365.25);
}

/** Human-readable age, e.g. "۲ سال و ۳ ماه" or "۴ ماه" for under a year. */
export function ageLabel(birthDate: string | null): string {
  const years = ageInYears(birthDate);
  if (years === null) return "نامشخص";
  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12));
    return `${toPersianDigits(months)} ماه`;
  }
  const wholeYears = Math.floor(years);
  const months = Math.round((years - wholeYears) * 12);
  return months > 0
    ? `${toPersianDigits(wholeYears)} سال و ${toPersianDigits(months)} ماه`
    : `${toPersianDigits(wholeYears)} سال`;
}

export const JUVENILE_AGE_MONTHS_THRESHOLD = 4;

/** null when birth_date is unknown — callers decide the safe default (this module defaults unknown-age to "adult", see effectiveAnimalType). */
export function isJuvenile(birthDate: string | null): boolean | null {
  const years = ageInYears(birthDate);
  if (years === null) return null;
  return years * 12 < JUVENILE_AGE_MONTHS_THRESHOLD;
}

/**
 * The animal_type stored at registration/birth is a snapshot — it never
 * updates itself as the animal ages. Every display and every dashboard
 * count uses this instead: it recomputes juvenile vs. adult live from the
 * current age, every time, so a lamb automatically becomes a ewe/ram in
 * every view once it turns 4 months old with no migration, cron job, or
 * write of any kind involved.
 */
export function effectiveAnimalType(
  species: Species,
  gender: "male" | "female" | null,
  birthDate: string | null
): AnimalTypeOption | null {
  if (!gender) return null;
  const wantJuvenile = isJuvenile(birthDate) ?? false; // unknown age -> treat as adult, not stuck as a permanent newborn
  return ANIMAL_TYPES_BY_SPECIES[species].find((o) => o.gender === gender && o.isJuvenile === wantJuvenile) ?? null;
}

/** The juvenile type for a given species+gender — used when auto-creating offspring from a birth record. */
export function juvenileAnimalType(species: Species, gender: "male" | "female"): AnimalTypeOption {
  return ANIMAL_TYPES_BY_SPECIES[species].find((o) => o.gender === gender && o.isJuvenile)!;
}

/** Display label for any animal card/list/profile — age-computed when gender is known, otherwise falls back to whatever was stored. */
export function effectiveAnimalTypeLabel(
  species: Species,
  gender: string | null,
  birthDate: string | null,
  fallbackAnimalType: string | null
): string {
  const effective = effectiveAnimalType(species, gender === "male" || gender === "female" ? gender : null, birthDate);
  if (effective) return effective.label;
  return animalTypeLabel(fallbackAnimalType) ?? SPECIES_LABELS[species];
}

const ADULT_MALE_COLOR: Record<Species, string> = {
  sheep: "#8D6E63",
  goat: "#6D4C41",
  cattle: "#4E342E",
  camel: "#A1887F",
  horse: "#5D4037",
};

const ADULT_FEMALE_COLOR: Record<Species, string> = {
  sheep: "#66BB6A",
  goat: "#43A047",
  cattle: "#1B5E20",
  camel: "#81C784",
  horse: "#2E7D32",
};

const JUVENILE_FEMALE_COLOR = "#F8BBD0"; // soft pink
const JUVENILE_MALE_COLOR = "#BBDEFB"; // very light blue

/** Portfolio chart color: pink/blue for young, species-distinct green/brown shades for adults. */
export function portfolioColor(species: Species, gender: "male" | "female", juvenile: boolean): string {
  if (juvenile) return gender === "female" ? JUVENILE_FEMALE_COLOR : JUVENILE_MALE_COLOR;
  return gender === "female" ? ADULT_FEMALE_COLOR[species] : ADULT_MALE_COLOR[species];
}
