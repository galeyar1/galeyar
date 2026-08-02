import { ageInYears } from "@/lib/animal-labels";
import type { LifeStage } from "@/lib/age-balance/species-profiles";
import type { ResolvedAgeProfile } from "@/lib/age-balance/profile-resolver";

export { LIFE_STAGE_LABELS, type LifeStage } from "@/lib/age-balance/species-profiles";

/**
 * Chronological life stage only — deliberately NOT a productive-value or
 * retention judgement (spec section 4: Life Stage / Productive Stage / Herd
 * Structure / Individual Performance are kept separate). Returns null when
 * birth_date is unknown, which callers must treat as "cannot classify,"
 * never as an assumed stage.
 */
export function classifyLifeStage(birthDate: string | null, profile: ResolvedAgeProfile): LifeStage | null {
  const years = ageInYears(birthDate);
  if (years === null) return null;
  const months = years * 12;
  const t = profile.lifeStageThresholds;

  if (months <= t.neonatalMaxMonths) return "neonatal";
  if (months <= t.growingMaxMonths) return "growing";
  if (months <= t.replacementCandidateMaxMonths) return "replacement_candidate";
  if (years <= t.youngBreedingMaxYears) return "young_breeding";
  if (years <= t.matureBreedingMaxYears) return "mature_breeding";
  if (years < t.seniorMonitoringStartYears) return "senior_breeding";
  return "senior_monitoring";
}

/** Whole-months-until-crossing-the-senior-monitoring-threshold, or null if already there / birth date unknown. Used for the 12-month replacement-exit projection. */
export function monthsUntilSeniorMonitoring(birthDate: string | null, profile: ResolvedAgeProfile): number | null {
  const years = ageInYears(birthDate);
  if (years === null) return null;
  const remainingYears = profile.lifeStageThresholds.seniorMonitoringStartYears - years;
  if (remainingYears <= 0) return 0;
  return Math.round(remainingYears * 12);
}
