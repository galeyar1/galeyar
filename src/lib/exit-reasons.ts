import type { ExitReason } from "@/lib/supabase/types";

export const EXIT_REASON_LABELS: Record<ExitReason, string> = {
  sale: "فروش",
  slaughterhouse: "کشتارگاه",
  disease_death: "تلف بر اثر بیماری",
  accident: "تصادف",
  genetic_removal: "حذف ژنتیکی",
  old_age: "کهولت سن",
  infertility: "ناباروری",
  abortion: "سقط جنین",
  missing: "مفقودی",
  donation: "اهدا",
  other: "سایر",
};

/** Reasons that imply the animal is deceased rather than merely gone from the herd. */
const DEATH_REASONS: ExitReason[] = ["disease_death", "accident", "old_age"];

export function statusForExitReason(reason: ExitReason): "sold" | "dead" {
  return DEATH_REASONS.includes(reason) ? "dead" : "sold";
}

export interface ExitAnimalLike {
  exit_reason: string | null;
  updated_at: string;
}

export interface ExitReasonStat {
  reason: ExitReason;
  count: number;
  percent: number;
}

/** Most common exit reason among animals whose exit falls in the given Jalali year (e.g. 1405), or null with no data. */
export function mostCommonExitReason(
  animals: ExitAnimalLike[],
  jalaliYearFilter: (updatedAtIso: string) => boolean
): ExitReasonStat | null {
  const inYear = animals.filter((a) => a.exit_reason && jalaliYearFilter(a.updated_at));
  if (inYear.length === 0) return null;

  const counts = new Map<string, number>();
  for (const a of inYear) {
    counts.set(a.exit_reason!, (counts.get(a.exit_reason!) ?? 0) + 1);
  }

  const [reason, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return { reason: reason as ExitReason, count, percent: Math.round((count / inYear.length) * 100) };
}
