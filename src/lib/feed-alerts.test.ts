import { describe, it, expect } from "vitest";
import {
  feedRunningOutAlerts,
  consumptionTrends,
  feedCostTrend,
  pregnantEweRationSuggestion,
  previousMonthKey,
  FEED_RUNNING_OUT_THRESHOLD_DAYS,
  PREGNANT_EWE_HAY_INCREASE_PERCENT,
} from "@/lib/feed-alerts";

describe("previousMonthKey", () => {
  it("steps back one calendar month", () => {
    expect(previousMonthKey("2026-07")).toBe("2026-06");
  });

  it("rolls back across a year boundary", () => {
    expect(previousMonthKey("2026-01")).toBe("2025-12");
  });
});

describe("feedRunningOutAlerts", () => {
  it("flags items at or under the threshold, sorted soonest-first", () => {
    const inventory = [
      { feed_type: "hay" as const, custom_label: null, quantity: 120, daily_rate: 10 }, // 12 days
      { feed_type: "concentrate" as const, custom_label: null, quantity: 1000, daily_rate: 5 }, // 200 days
      { feed_type: "straw" as const, custom_label: null, quantity: 20, daily_rate: 5 }, // 4 days
    ];
    const alerts = feedRunningOutAlerts(inventory);
    expect(alerts.map((a) => a.feedType)).toEqual(["straw", "hay"]);
    expect(alerts[0].daysRemaining).toBe(4);
    expect(alerts[1].daysRemaining).toBe(12);
  });

  it("skips items with no daily rate or beyond the threshold", () => {
    const inventory = [
      { feed_type: "hay" as const, custom_label: null, quantity: 120, daily_rate: null },
      { feed_type: "barley" as const, custom_label: null, quantity: 1000, daily_rate: 5 },
    ];
    expect(feedRunningOutAlerts(inventory)).toEqual([]);
  });

  it("uses the exported threshold constant by default", () => {
    const inventory = [{ feed_type: "hay" as const, custom_label: null, quantity: 140, daily_rate: 10 }]; // 14 days
    expect(feedRunningOutAlerts(inventory)).toHaveLength(1);
    expect(FEED_RUNNING_OUT_THRESHOLD_DAYS).toBe(14);
  });
});

describe("consumptionTrends", () => {
  const logs = [
    { feed_type: "concentrate" as const, amount_used: 118, log_date: "2026-07-15" },
    { feed_type: "concentrate" as const, amount_used: 100, log_date: "2026-06-15" },
    { feed_type: "hay" as const, amount_used: 50, log_date: "2026-07-10" },
    { feed_type: "hay" as const, amount_used: 50, log_date: "2026-06-10" },
    { feed_type: "barley" as const, amount_used: 30, log_date: "2026-07-05" },
  ];

  it("computes month-over-month percent change per feed type", () => {
    const trends = consumptionTrends(logs, "2026-07", "2026-06");
    const concentrate = trends.find((t) => t.feedType === "concentrate");
    expect(concentrate?.changePercent).toBe(18);
  });

  it("omits types with no change and types with no prior-month baseline", () => {
    const trends = consumptionTrends(logs, "2026-07", "2026-06");
    expect(trends.find((t) => t.feedType === "hay")).toBeUndefined();
    expect(trends.find((t) => t.feedType === "barley")).toBeUndefined();
  });

  it("sorts by largest absolute change first", () => {
    const bigger = [
      { feed_type: "concentrate" as const, amount_used: 118, log_date: "2026-07-15" },
      { feed_type: "concentrate" as const, amount_used: 100, log_date: "2026-06-15" },
      { feed_type: "corn" as const, amount_used: 200, log_date: "2026-07-15" },
      { feed_type: "corn" as const, amount_used: 100, log_date: "2026-06-15" },
    ];
    const trends = consumptionTrends(bigger, "2026-07", "2026-06");
    expect(trends[0].feedType).toBe("corn");
  });
});

describe("feedCostTrend", () => {
  it("computes total cost change between two months", () => {
    const logs = [
      { feed_type: "hay" as const, amount_used: 150, log_date: "2026-07-15" },
      { feed_type: "hay" as const, amount_used: 100, log_date: "2026-06-15" },
    ];
    const trend = feedCostTrend(logs, { hay: 10 }, "2026-07", "2026-06");
    expect(trend.currentTotal).toBe(1500);
    expect(trend.previousTotal).toBe(1000);
    expect(trend.changePercent).toBe(50);
  });

  it("returns a null changePercent when there's no prior-month cost to compare against", () => {
    const logs = [{ feed_type: "hay" as const, amount_used: 150, log_date: "2026-07-15" }];
    const trend = feedCostTrend(logs, { hay: 10 }, "2026-07", "2026-06");
    expect(trend.previousTotal).toBe(0);
    expect(trend.changePercent).toBeNull();
  });
});

describe("pregnantEweRationSuggestion", () => {
  it("suggests the fixed hay increase percent for a positive pregnant count", () => {
    expect(pregnantEweRationSuggestion(61)).toEqual({ pregnantCount: 61, increasePercent: PREGNANT_EWE_HAY_INCREASE_PERCENT });
  });

  it("is null when no animals are pregnant", () => {
    expect(pregnantEweRationSuggestion(0)).toBeNull();
  });
});
