// Scheduled job (see supabase/functions/generate-ai-insights/README below)
// that computes the "AI Assistant" predictions described in the spec:
// feed depletion forecasts, herd growth projection, and milk trend alerts.
//
// This runs with the service-role key so it can read across every farm in
// one pass; it never accepts a farm_id from a client. Trigger it on a daily
// schedule via Supabase's Dashboard → Edge Functions → Cron, or a pg_cron
// job calling this function's URL through pg_net.

import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const FEED_LOOKBACK_DAYS = 14;
const MILK_WINDOW_DAYS = 7;
const HERD_LOOKBACK_MONTHS = 6;
const PROJECTION_MONTHS = 12;

interface Farm {
  id: string;
}

async function computeFeedForecast(farmId: string) {
  const since = new Date();
  since.setDate(since.getDate() - FEED_LOOKBACK_DAYS);

  const { data: inventory } = await supabase
    .from("feed_inventory")
    .select("feed_type, quantity, unit")
    .eq("farm_id", farmId);

  const { data: consumption } = await supabase
    .from("feed_consumption_log")
    .select("feed_type, amount_used")
    .eq("farm_id", farmId)
    .gte("log_date", since.toISOString().slice(0, 10));

  if (!inventory || inventory.length === 0) return null;

  const dailyAvgByType = new Map<string, number>();
  for (const row of consumption ?? []) {
    dailyAvgByType.set(
      row.feed_type,
      (dailyAvgByType.get(row.feed_type) ?? 0) + Number(row.amount_used) / FEED_LOOKBACK_DAYS
    );
  }

  const forecast = inventory.map((item) => {
    const dailyAvg = dailyAvgByType.get(item.feed_type) ?? 0;
    const daysRemaining = dailyAvg > 0 ? Math.floor(Number(item.quantity) / dailyAvg) : null;
    return {
      feed_type: item.feed_type,
      quantity: item.quantity,
      unit: item.unit,
      daily_avg_consumption: Number(dailyAvg.toFixed(2)),
      days_remaining: daysRemaining,
    };
  });

  return forecast;
}

async function computeHerdGrowth(farmId: string) {
  const since = new Date();
  since.setMonth(since.getMonth() - HERD_LOOKBACK_MONTHS);

  const { count: currentCount } = await supabase
    .from("animals")
    .select("id", { count: "exact", head: true })
    .eq("farm_id", farmId)
    .eq("status", "active")
    .is("deleted_at", null);

  const { count: pastCount } = await supabase
    .from("animals")
    .select("id", { count: "exact", head: true })
    .eq("farm_id", farmId)
    .eq("status", "active")
    .is("deleted_at", null)
    .lte("created_at", since.toISOString());

  const current = currentCount ?? 0;
  const past = pastCount ?? 0;
  const monthlyGrowthRate = past > 0 ? (current - past) / past / HERD_LOOKBACK_MONTHS : 0;
  const projected = Math.round(current * Math.pow(1 + monthlyGrowthRate, PROJECTION_MONTHS));

  return {
    current_count: current,
    monthly_growth_rate: Number(monthlyGrowthRate.toFixed(4)),
    projected_count_in_12_months: projected,
  };
}

async function computeMilkTrend(farmId: string) {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - MILK_WINDOW_DAYS * 2);

  const { data } = await supabase
    .from("milk_records")
    .select("morning_milk, evening_milk, record_date")
    .eq("farm_id", farmId)
    .gte("record_date", windowStart.toISOString().slice(0, 10))
    .is("deleted_at", null);

  if (!data || data.length === 0) return null;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MILK_WINDOW_DAYS);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  let recentTotal = 0;
  const recentDays = new Set<string>();
  let priorTotal = 0;
  const priorDays = new Set<string>();

  for (const row of data) {
    const total = Number(row.morning_milk ?? 0) + Number(row.evening_milk ?? 0);
    if (row.record_date >= cutoffIso) {
      recentTotal += total;
      recentDays.add(row.record_date);
    } else {
      priorTotal += total;
      priorDays.add(row.record_date);
    }
  }

  const recentAvg = recentDays.size > 0 ? recentTotal / recentDays.size : 0;
  const priorAvg = priorDays.size > 0 ? priorTotal / priorDays.size : 0;
  const changePercent = priorAvg > 0 ? ((recentAvg - priorAvg) / priorAvg) * 100 : 0;

  return {
    recent_daily_avg_liters: Number(recentAvg.toFixed(1)),
    previous_daily_avg_liters: Number(priorAvg.toFixed(1)),
    change_percent: Number(changePercent.toFixed(1)),
  };
}

Deno.serve(async () => {
  const { data: farms, error } = await supabase.from("farms").select("id");
  if (error) {
    console.error("generate-ai-insights: failed to list farms", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let processed = 0;

  for (const farm of (farms ?? []) as Farm[]) {
    const [feedForecast, herdGrowth, milkTrend] = await Promise.all([
      computeFeedForecast(farm.id),
      computeHerdGrowth(farm.id),
      computeMilkTrend(farm.id),
    ]);

    const rows = [];
    if (feedForecast) rows.push({ farm_id: farm.id, insight_type: "feed_forecast", payload: feedForecast });
    if (herdGrowth) rows.push({ farm_id: farm.id, insight_type: "herd_growth", payload: herdGrowth });
    if (milkTrend) rows.push({ farm_id: farm.id, insight_type: "milk_trend", payload: milkTrend });

    if (rows.length > 0) {
      await supabase.from("ai_insights").insert(rows);
      processed += 1;
    }

    const lowFeed = (feedForecast ?? []).filter(
      (f) => f.days_remaining !== null && f.days_remaining <= 14
    );
    if (lowFeed.length > 0) {
      await supabase.from("notifications").insert(
        lowFeed.map((f) => ({
          farm_id: farm.id,
          type: "feed_low",
          message: `موجودی ${f.feed_type} تا حدود ${f.days_remaining} روز دیگر تمام می‌شود.`,
        }))
      );
    }
  }

  return new Response(JSON.stringify({ farms_processed: processed }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
