import type { DiseaseType } from "@/lib/supabase/types";

/** Body temperature (°C) thresholds. */
export const FEVER_WARNING_TEMP = 39.5;
export const FEVER_EMERGENCY_TEMP = 40.5;

export type FeverLevel = "emergency" | "warning" | null;

export function feverAlertLevel(temperature: number | null): FeverLevel {
  if (temperature === null) return null;
  if (temperature > FEVER_EMERGENCY_TEMP) return "emergency";
  if (temperature > FEVER_WARNING_TEMP) return "warning";
  return null;
}

/** Flags a case that's still open `thresholdDays` (default 7) after it was recorded, with no newer disease/treatment record for the same animal since. */
export function notImprovingAlert(
  recordDateIso: string,
  todayIso: string,
  hasNewerRecord: boolean,
  thresholdDays = 7
): boolean {
  if (hasNewerRecord) return false;
  const daysSince = Math.round((new Date(todayIso).getTime() - new Date(recordDateIso).getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= thresholdDays;
}

/** Disease types close enough to the spec's named quarantine diseases (FMD/PPR/Brucellosis/Sheep Pox) to suggest quarantine. */
const QUARANTINE_SUGGESTED_DISEASE_TYPES: DiseaseType[] = ["infectious"];
export const DEFAULT_QUARANTINE_DAYS = 14;

export function suggestedQuarantineDays(diseaseType: DiseaseType): number | null {
  return QUARANTINE_SUGGESTED_DISEASE_TYPES.includes(diseaseType) ? DEFAULT_QUARANTINE_DAYS : null;
}

export function isQuarantineActive(quarantineUntilIso: string | null, todayIso: string): boolean {
  if (!quarantineUntilIso) return false;
  return quarantineUntilIso >= todayIso;
}
