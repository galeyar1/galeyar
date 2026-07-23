"use client";

import { useEffect, useState } from "react";
import { Wheat, TrendingUp, Milk, Sparkles } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FEED_TYPE_LABELS, FEED_UNIT_LABELS } from "@/lib/feed-labels";
import { formatJalali, toPersianDigits } from "@/lib/jalali";
import type { AiInsight, FeedType, FeedUnit } from "@/lib/supabase/types";

interface FeedForecastItem {
  feed_type: FeedType;
  quantity: number;
  unit: FeedUnit;
  daily_avg_consumption: number;
  days_remaining: number | null;
}

interface HerdGrowthPayload {
  current_count: number;
  monthly_growth_rate: number;
  projected_count_in_12_months: number;
}

interface MilkTrendPayload {
  recent_daily_avg_liters: number;
  previous_daily_avg_liters: number;
  change_percent: number;
}

export default function AiAssistantPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!farmId) return;
    supabase
      .from("ai_insights")
      .select("*")
      .eq("farm_id", farmId)
      .order("generated_at", { ascending: false })
      .then(({ data }) => {
        setInsights(data ?? []);
        setLoading(false);
      });
  }, [farmId]);

  const feedForecast = insights.find((i) => i.insight_type === "feed_forecast");
  const herdGrowth = insights.find((i) => i.insight_type === "herd_growth");
  const milkTrend = insights.find((i) => i.insight_type === "milk_trend");
  const generatedAt = insights[0]?.generated_at;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-6 text-primary" />
        <h1 className="text-xl font-bold">دستیار هوشمند</h1>
      </div>

      {generatedAt && (
        <p className="text-xs text-muted-foreground">
          آخرین به‌روزرسانی: {formatJalali(generatedAt.slice(0, 10), true)}
        </p>
      )}

      {!loading && insights.length === 0 && (
        <p className="mt-10 text-center text-muted-foreground">
          هنوز داده کافی برای تحلیل هوشمند وجود ندارد. با ثبت گزارش‌های بیشتر، دستیار هوشمند فعال می‌شود.
        </p>
      )}

      {feedForecast && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wheat className="size-5 text-primary" /> پیش‌بینی خوراک
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2">
              {(feedForecast.payload as FeedForecastItem[]).map((f) => (
                <li key={f.feed_type} className="flex flex-col gap-0.5 rounded-lg bg-muted p-3">
                  <span className="font-semibold">{FEED_TYPE_LABELS[f.feed_type]}</span>
                  <span className={f.days_remaining !== null && f.days_remaining <= 14 ? "text-destructive" : "text-muted-foreground"}>
                    {f.days_remaining !== null
                      ? `با روند مصرف فعلی، ${toPersianDigits(f.days_remaining)} روز دیگر تمام می‌شود`
                      : "داده مصرف کافی برای پیش‌بینی وجود ندارد"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    موجودی فعلی: {toPersianDigits(f.quantity)} {FEED_UNIT_LABELS[f.unit]}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {herdGrowth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" /> پیش‌بینی رشد گله
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              جمعیت فعلی گله: <strong>{toPersianDigits((herdGrowth.payload as HerdGrowthPayload).current_count)}</strong> راس
            </p>
            <p className="mt-1">
              با روند فعلی، جمعیت گله تا ۱۲ ماه آینده به حدود{" "}
              <strong>
                {toPersianDigits((herdGrowth.payload as HerdGrowthPayload).projected_count_in_12_months)}
              </strong>{" "}
              راس می‌رسد.
            </p>
          </CardContent>
        </Card>
      )}

      {milkTrend && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Milk className="size-5 text-primary" /> تحلیل تولید شیر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              میانگین تولید روزانه اخیر:{" "}
              <strong>{toPersianDigits((milkTrend.payload as MilkTrendPayload).recent_daily_avg_liters)} لیتر</strong>
            </p>
            <p
              className={
                (milkTrend.payload as MilkTrendPayload).change_percent < 0 ? "text-destructive" : "text-success"
              }
            >
              {(milkTrend.payload as MilkTrendPayload).change_percent >= 0 ? "افزایش" : "کاهش"} نسبت به دوره قبل:{" "}
              {toPersianDigits(Math.abs((milkTrend.payload as MilkTrendPayload).change_percent))}٪
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
