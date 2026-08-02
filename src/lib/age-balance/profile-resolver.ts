import { SPECIES_AGE_PROFILES, type SpeciesAgeProfile } from "@/lib/age-balance/species-profiles";
import { findBreedProfile } from "@/lib/age-balance/breed-profiles";
import type { Species } from "@/lib/supabase/types";

export interface ResolvedAgeProfile extends SpeciesAgeProfile {
  /** Name of the breed profile actually applied, or null when the species baseline was used untouched (the normal V1 case for every breed — see breed-profiles.ts). */
  breedProfileApplied: string | null;
}

/** Fallback hierarchy: breed-specific override -> species baseline. Never fabricates a value neither level actually has. */
export function resolveAgeProfile(species: Species, breed: string | null | undefined): ResolvedAgeProfile {
  const base = SPECIES_AGE_PROFILES[species];
  const breedProfile = findBreedProfile(species, breed);

  if (!breedProfile || Object.keys(breedProfile.overrides).length === 0) {
    return { ...base, breedProfileApplied: null };
  }

  return {
    ...base,
    replacementBenchmarkPercent: breedProfile.overrides.replacementBenchmarkPercent ?? base.replacementBenchmarkPercent,
    maleFemaleBreedingRatio: breedProfile.overrides.maleFemaleBreedingRatio ?? base.maleFemaleBreedingRatio,
    reproductiveParameters: {
      ...base.reproductiveParameters,
      matureWeightReadinessPercent:
        breedProfile.overrides.matureWeightReadinessPercent ?? base.reproductiveParameters.matureWeightReadinessPercent,
    },
    breedProfileApplied: breedProfile.breed,
  };
}
