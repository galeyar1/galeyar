/** Suggested vaccines (free-text vaccine_name field also accepts anything else). */
export const SUGGESTED_VACCINES = [
  "تب برفکی",
  "آبله گوسفندی",
  "بروسلوز",
  "آنتروتوکسمی",
  "طاعون نشخوارکنندگان کوچک (PPR)",
  "سیاه‌زخم",
  "هاری",
] as const;

export const VACCINATION_UPCOMING_WINDOW_DAYS = 30;

export type DueStatus = "overdue" | "upcoming" | "ok" | null;

export function vaccinationDueStatus(nextDueDateIso: string | null, todayIso: string): DueStatus {
  if (!nextDueDateIso) return null;
  if (nextDueDateIso < todayIso) return "overdue";
  const daysUntil = Math.round(
    (new Date(nextDueDateIso).getTime() - new Date(todayIso).getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysUntil <= VACCINATION_UPCOMING_WINDOW_DAYS ? "upcoming" : "ok";
}
