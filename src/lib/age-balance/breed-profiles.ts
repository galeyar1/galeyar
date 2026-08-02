import type { Species } from "@/lib/supabase/types";
import type { ConfidenceLevel } from "@/lib/age-balance/species-profiles";

/**
 * Breed-level metadata registry — Iran-first, extensible to any breed.
 *
 * IMPORTANT: this deliberately carries NO breed-specific numeric age
 * thresholds. Per the spec: "Do NOT invent breed-specific biological
 * thresholds when reliable evidence/configuration does not exist... fall
 * back to species baseline." Every entry here has `overrides: {}` — the
 * fields exist so a future round can fill in a specific, sourced value for
 * one breed without touching the scoring engine at all (the engine already
 * reads through resolveAgeProfile, which merges breed overrides onto the
 * species baseline). Until then, every breed behaves identically to its
 * species baseline, and `confidence` stays "low" to reflect that no
 * breed-specific calibration has actually happened yet.
 */

export type ProductionRole = "dairy" | "meat" | "mixed" | "native" | "companion" | "unspecified";

export interface BreedProfile {
  breed: string;
  species: Species;
  productionRole: ProductionRole;
  /** Deliberately empty in V1 for every breed — see file header. */
  overrides: Partial<{
    matureWeightReadinessPercent: [number, number];
    replacementBenchmarkPercent: [number, number];
    maleFemaleBreedingRatio: number;
  }>;
  confidence: ConfidenceLevel;
  source: string;
  version: string;
  lastReviewed: number;
}

function unvalidatedBreed(breed: string, species: Species, productionRole: ProductionRole = "unspecified"): BreedProfile {
  return {
    breed,
    species,
    productionRole,
    overrides: {},
    confidence: "low",
    source: "No breed-specific validated data yet — falls back to species baseline.",
    version: "1.0",
    lastReviewed: 2026,
  };
}

const SHEEP_BREEDS = ["افشاری", "شال", "مغانی", "قزل", "لری بختیاری", "رومانوف"];
const GOAT_BREEDS: [string, ProductionRole][] = [
  ["مرخز", "unspecified"],
  ["مهابادی", "unspecified"],
  ["نجدی", "unspecified"],
  ["رائینی", "unspecified"],
  ["خلخالی", "unspecified"],
  ["سانن", "dairy"],
  ["آلپاین", "dairy"],
  ["بوئر", "meat"],
];
const CATTLE_BREEDS: [string, ProductionRole][] = [
  ["هلشتاین", "dairy"],
  ["بومی ایرانی", "native"],
  ["دورگ", "mixed"],
];
const HORSE_BREEDS = ["اصیل ایرانی", "ترکمن", "کرد", "کاسپین", "دره‌شوری"];
const CAMEL_BREEDS = ["ترکمن", "بومی/عرب"];

export const BREED_PROFILES: BreedProfile[] = [
  ...SHEEP_BREEDS.map((b) => unvalidatedBreed(b, "sheep")),
  ...GOAT_BREEDS.map(([b, role]) => unvalidatedBreed(b, "goat", role)),
  ...CATTLE_BREEDS.map(([b, role]) => unvalidatedBreed(b, "cattle", role)),
  ...HORSE_BREEDS.map((b) => unvalidatedBreed(b, "horse")),
  ...CAMEL_BREEDS.map((b) => unvalidatedBreed(b, "camel")),
];

const BREED_PROFILE_INDEX = new Map(BREED_PROFILES.map((p) => [`${p.species}:${p.breed}`, p]));

/** Exact-match lookup only — an unrecognized/free-text breed simply has no profile, which is the correct "fall back to species baseline" behavior, not an error. */
export function findBreedProfile(species: Species, breed: string | null | undefined): BreedProfile | null {
  if (!breed) return null;
  return BREED_PROFILE_INDEX.get(`${species}:${breed.trim()}`) ?? null;
}
