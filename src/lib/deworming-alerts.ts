export const DEWORMING_OVERDUE_THRESHOLD_DAYS = 180;

export function daysSinceLastDeworming(lastDateIso: string, todayIso: string): number {
  return Math.round((new Date(todayIso).getTime() - new Date(lastDateIso).getTime()) / (1000 * 60 * 60 * 24));
}

export function dewormingOverdue(daysSince: number, thresholdDays = DEWORMING_OVERDUE_THRESHOLD_DAYS): boolean {
  return daysSince >= thresholdDays;
}
