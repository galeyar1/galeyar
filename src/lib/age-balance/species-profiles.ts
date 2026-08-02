import type { Species } from "@/lib/supabase/types";

/**
 * Herd Age Balance & Replacement Intelligence — species profile registry.
 *
 * This is the ONLY place biological age/reproduction reference values are
 * defined. Every number here is either (a) taken directly from the
 * scientific references supplied when this module was specified, or (b)
 * general, widely-taught livestock-management convention used only where
 * no specific figure was supplied — never an invented species- or
 * breed-specific claim. `sourceMetadata.confidence` on each profile is
 * honest about which case applies; nothing here should be read as a
 * validated citation. See breed-profiles.ts for why breed-level values are
 * deliberately NOT filled in for V1 (fallback: breed -> species baseline).
 */

export type LifeStage =
  | "neonatal"
  | "growing"
  | "replacement_candidate"
  | "young_breeding"
  | "mature_breeding"
  | "senior_breeding"
  | "senior_monitoring";

export const LIFE_STAGE_LABELS: Record<LifeStage, string> = {
  neonatal: "نوزاد/وابسته",
  growing: "در حال رشد",
  replacement_candidate: "کاندید جایگزینی",
  young_breeding: "مولد جوان",
  mature_breeding: "مولد بالغ",
  senior_breeding: "مولد مسن",
  senior_monitoring: "نیازمند پایش سنی",
};

export interface LifeStageThresholds {
  neonatalMaxMonths: number;
  growingMaxMonths: number;
  replacementCandidateMaxMonths: number;
  youngBreedingMaxYears: number;
  matureBreedingMaxYears: number;
  /** Age at which an animal enters "needs closer monitoring" — NEVER a culling threshold, see age-balance/README notes in engine.ts. */
  seniorMonitoringStartYears: number;
}

export interface ReproductiveParameters {
  gestationDays: number;
  pubertyMonthsRange: [number, number];
  /** Some species' spec explicitly separates male puberty (e.g. bucks mature faster than does). */
  pubertyMonthsRangeMale?: [number, number];
  /** % of mature body weight commonly referenced as a breeding-readiness threshold — null where no such reference was supplied (never invented). */
  matureWeightReadinessPercent: [number, number] | null;
  calvingIntervalMonths: number | null;
  /** Explicit "first breeding typically happens around age X" reference, distinct from puberty onset — only set where the source data specifically calls this out (e.g. camel). */
  firstBreedingReferenceYears: number | null;
}

export type ConfidenceLevel = "high" | "medium" | "low" | "insufficient";

export interface SourceMetadata {
  note: string;
  reviewYear: number;
  confidence: ConfidenceLevel;
}

export interface SpeciesAgeProfile {
  species: Species;
  lifeStageThresholds: LifeStageThresholds;
  /** Commercial annual replacement-rate benchmark, as a range — contextual reference only, never a mandatory target (spec section 9). Null where no benchmark was supplied. */
  replacementBenchmarkPercent: [number, number] | null;
  /** e.g. sheep ~1 mature ram per 40 ewes — a configurable starting reference for typical compact breeding, never a universal rule. Null where not supplied. */
  maleFemaleBreedingRatio: number | null;
  reproductiveParameters: ReproductiveParameters;
  sourceMetadata: SourceMetadata;
}

export const AGE_BALANCE_MODEL_VERSION = "1.0";

export const SPECIES_AGE_PROFILES: Record<Species, SpeciesAgeProfile> = {
  sheep: {
    species: "sheep",
    lifeStageThresholds: {
      neonatalMaxMonths: 2,
      growingMaxMonths: 6,
      replacementCandidateMaxMonths: 12,
      youngBreedingMaxYears: 2,
      matureBreedingMaxYears: 4,
      seniorMonitoringStartYears: 6,
    },
    replacementBenchmarkPercent: [20, 25],
    maleFemaleBreedingRatio: 40,
    reproductiveParameters: {
      gestationDays: 150,
      pubertyMonthsRange: [6, 8],
      matureWeightReadinessPercent: [60, 70],
      calvingIntervalMonths: null,
      firstBreedingReferenceYears: null,
    },
    sourceMetadata: {
      note:
        "Puberty (6-8mo), breeding-readiness weight (60-70% mature weight), replacement benchmark (20-25%/yr), and ram:ewe ratio (~1:40) are from the supplied specification. Life-stage year boundaries (young/mature/senior) are general flock-management convention, not a specific citation.",
      reviewYear: 2026,
      confidence: "medium",
    },
  },
  goat: {
    species: "goat",
    lifeStageThresholds: {
      neonatalMaxMonths: 2,
      growingMaxMonths: 6,
      replacementCandidateMaxMonths: 12,
      youngBreedingMaxYears: 2,
      matureBreedingMaxYears: 4,
      seniorMonitoringStartYears: 6,
    },
    replacementBenchmarkPercent: null,
    maleFemaleBreedingRatio: null,
    reproductiveParameters: {
      gestationDays: 150,
      pubertyMonthsRange: [6, 8],
      pubertyMonthsRangeMale: [4, 6],
      matureWeightReadinessPercent: [60, 65],
      calvingIntervalMonths: null,
      firstBreedingReferenceYears: null,
    },
    sourceMetadata: {
      note:
        "Doe puberty (6-8mo), buck puberty (4-6mo), and breeding-readiness weight (~60-65% mature weight) are from the supplied specification. No replacement-rate or male:female ratio benchmark was supplied for goats — left null rather than borrowed from sheep. Life-stage year boundaries are general convention.",
      reviewYear: 2026,
      confidence: "medium",
    },
  },
  cattle: {
    species: "cattle",
    lifeStageThresholds: {
      neonatalMaxMonths: 3,
      growingMaxMonths: 12,
      replacementCandidateMaxMonths: 15,
      youngBreedingMaxYears: 3,
      matureBreedingMaxYears: 6,
      seniorMonitoringStartYears: 8,
    },
    replacementBenchmarkPercent: null,
    maleFemaleBreedingRatio: null,
    reproductiveParameters: {
      gestationDays: 283,
      pubertyMonthsRange: [10, 14],
      matureWeightReadinessPercent: null,
      calvingIntervalMonths: 13,
      firstBreedingReferenceYears: null,
    },
    sourceMetadata: {
      note:
        "Chronological age alone is explicitly de-emphasized for cattle in the specification — parity, productive life, and reproductive/health history matter more (see genetics-advanced.ts healthScore/fertilityScore, and the parity-distribution UI, for the data-driven side). Puberty range and calving-interval target are general dairy-management convention, not breed-calibrated. No breeding-readiness weight or replacement benchmark was supplied.",
      reviewYear: 2026,
      confidence: "medium",
    },
  },
  horse: {
    species: "horse",
    lifeStageThresholds: {
      neonatalMaxMonths: 6,
      growingMaxMonths: 24,
      replacementCandidateMaxMonths: 36,
      youngBreedingMaxYears: 6,
      matureBreedingMaxYears: 12,
      seniorMonitoringStartYears: 15,
    },
    replacementBenchmarkPercent: null,
    maleFemaleBreedingRatio: null,
    reproductiveParameters: {
      gestationDays: 340,
      pubertyMonthsRange: [15, 24],
      matureWeightReadinessPercent: null,
      calvingIntervalMonths: null,
      firstBreedingReferenceYears: null,
    },
    sourceMetadata: {
      note:
        "Senior classification commonly begins 15-20+ years with large individual variation, per the supplied specification — the cautious (lower) bound of 15 is used as the monitoring threshold, deliberately never framed as a removal threshold. Puberty range is general convention, not breed-specific (Asil/Turkoman/Kurdish/Caspian/Dareshuri all share this baseline in V1).",
      reviewYear: 2026,
      confidence: "medium",
    },
  },
  camel: {
    species: "camel",
    lifeStageThresholds: {
      neonatalMaxMonths: 12,
      growingMaxMonths: 36,
      replacementCandidateMaxMonths: 48,
      youngBreedingMaxYears: 8,
      matureBreedingMaxYears: 12,
      seniorMonitoringStartYears: 15,
    },
    replacementBenchmarkPercent: null,
    maleFemaleBreedingRatio: null,
    reproductiveParameters: {
      gestationDays: 390,
      pubertyMonthsRange: [36, 48],
      matureWeightReadinessPercent: null,
      calvingIntervalMonths: 24,
      firstBreedingReferenceYears: 5,
    },
    sourceMetadata: {
      note:
        "First calving (~5 years) and calving interval (~2 years) are from Iranian Turkmen camel data per the supplied specification — camel reproductive timing is deliberately never derived from sheep/goat thresholds. Puberty range and senior/mature boundaries beyond that are general convention given camels' long lifespan (commonly 20-25+ years).",
      reviewYear: 2026,
      confidence: "medium",
    },
  },
};
