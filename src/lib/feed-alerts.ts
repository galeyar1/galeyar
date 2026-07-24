import { FEED_TYPE_LABELS, feedLabel } from "@/lib/feed-labels";
import { daysRemaining } from "@/lib/feed-forecast";
import type { FeedConsumptionLog, FeedInventory, FeedType } from "@/lib/supabase/types";

/**
 * Feed intelligence for the AI hub's "اعلان‌های خوراک" card — GALEYAR v1.8
 * moved all feed *management* UI into src/app/(app)/feed; AI's job is now
 * limited to generating these read-only alert lines from that same data.
 */

export const FEED_RUNNING_OUT_THRESHOLD_DAYS = 14;
export const PREGNANT_EWE_HAY_INCREASE_PERCENT = 10;

export interface FeedRunningOutAlert {
  feedType: FeedType;
  label: string;
  daysRemaining: number;
}

/** Items projected to run out within the threshold, using each item's own daily rate. */
export function feedRunningOutAlerts(
  inventory: Pick<FeedInventory, "feed_type" | "custom_label" | "quantity" | "daily_rate">[],
  thresholdDays = FEED_RUNNING_OUT_THRESHOLD_DAYS
): FeedRunningOutAlert[] {
  const alerts: FeedRunningOutAlert[] = [];
  for (const item of inventory) {
    const remaining = daysRemaining(item.quantity, item.daily_rate);
    if (remaining !== null && remaining <= thresholdDays) {
      alerts.push({ feedType: item.feed_type, label: feedLabel(item), daysRemaining: remaining });
    }
  }
  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/** "2026-07" -> "2026-06" — the calendar month immediately before the given YYYY-MM key. */
export function previousMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function sumByFeedType(
  logs: Pick<FeedConsumptionLog, "feed_type" | "amount_used" | "log_date">[],
  monthKey: string
): Partial<Record<FeedType, number>> {
  const totals: Partial<Record<FeedType, number>> = {};
  for (const log of logs) {
    if (log.log_date.slice(0, 7) !== monthKey) continue;
    totals[log.feed_type] = (totals[log.feed_type] ?? 0) + Number(log.amount_used);
  }
  return totals;
}

export interface ConsumptionTrend {
  feedType: FeedType;
  label: string;
  changePercent: number;
}

/** This-month vs previous-month consumption change per feed type — only for types with a prior-month baseline to compare against. */
export function consumptionTrends(
  logs: Pick<FeedConsumptionLog, "feed_type" | "amount_used" | "log_date">[],
  currentMonthKey: string,
  previousMonthKey: string
): ConsumptionTrend[] {
  const current = sumByFeedType(logs, currentMonthKey);
  const previous = sumByFeedType(logs, previousMonthKey);
  const trends: ConsumptionTrend[] = [];
  for (const feedType of Object.keys(current) as FeedType[]) {
    const prev = previous[feedType];
    if (!prev) continue;
    const curr = current[feedType] as number;
    const changePercent = Math.round(((curr - prev) / prev) * 100);
    if (changePercent !== 0) {
      trends.push({ feedType, label: FEED_TYPE_LABELS[feedType], changePercent });
    }
  }
  return trends.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
}

export interface FeedCostTrend {
  currentTotal: number;
  previousTotal: number;
  changePercent: number | null;
}

/** Month-over-month feed cost (consumption × each type's unit cost), for the "هزینه خوراک این ماه بیشتر شده" alert. */
export function feedCostTrend(
  logs: Pick<FeedConsumptionLog, "feed_type" | "amount_used" | "log_date">[],
  unitCostByType: Partial<Record<FeedType, number>>,
  currentMonthKey: string,
  previousMonthKey: string
): FeedCostTrend {
  const current = sumByFeedType(logs, currentMonthKey);
  const previous = sumByFeedType(logs, previousMonthKey);
  const costOf = (totals: Partial<Record<FeedType, number>>) =>
    (Object.entries(totals) as [FeedType, number][]).reduce(
      (sum, [type, qty]) => sum + qty * (unitCostByType[type] ?? 0),
      0
    );
  const currentTotal = costOf(current);
  const previousTotal = costOf(previous);
  const changePercent = previousTotal > 0 ? Math.round(((currentTotal - previousTotal) / previousTotal) * 100) : null;
  return { currentTotal, previousTotal, changePercent };
}

/** e.g. "برای ۶۱ میش آبستن، افزایش ۱۰٪ یونجه پیشنهاد می‌شود." — null when there's nothing to suggest for. */
export function pregnantEweRationSuggestion(pregnantCount: number): { pregnantCount: number; increasePercent: number } | null {
  if (pregnantCount <= 0) return null;
  return { pregnantCount, increasePercent: PREGNANT_EWE_HAY_INCREASE_PERCENT };
}
