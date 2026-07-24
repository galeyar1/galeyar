"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Gauge } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toPersianDigits, todayIso } from "@/lib/jalali";
import { computeProfitLoss } from "@/lib/finance";
import { vaccinationDueStatus } from "@/lib/vaccination-alerts";
import { daysRemaining } from "@/lib/feed-forecast";
import {
  birthRatePercent,
  mortalityScore,
  vaccinationCoveragePercent,
  feedEfficiencyScore,
  profitabilityScore,
  herdGrowthScore,
  overallPerformanceScore,
} from "@/lib/farm-performance";
import type { FeedInventory } from "@/lib/supabase/types";

function ScoreRow({ label, value }: { label: string; value: number }) {
  const color = value >= 70 ? "text-success" : value >= 40 ? "text-warning" : "text-destructive";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={`font-bold ${color}`}>{toPersianDigits(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={`h-2 rounded-full ${value >= 70 ? "bg-success" : value >= 40 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function FarmPerformancePage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const today = todayIso();
  const [feedItems, setFeedItems] = useState<Pick<FeedInventory, "quantity" | "daily_rate">[]>([]);

  useEffect(() => {
    if (!farmId) return;
    supabase
      .from("feed_inventory")
      .select("quantity, daily_rate")
      .eq("farm_id", farmId)
      .then(({ data }) => setFeedItems(data ?? []));
  }, [farmId]);

  const data = useLiveQuery(async () => {
    if (!farmId) return null;
    const [animals, births, vaccinations, txns] = await Promise.all([
      db.animals.where("farm_id").equals(farmId).toArray(),
      db.birth_records.where("farm_id").equals(farmId).toArray(),
      db.vaccinations.where("farm_id").equals(farmId).toArray(),
      db.financial_transactions.where("farm_id").equals(farmId).toArray(),
    ]);

    const live = animals.filter((a) => !a.deleted_at);
    const activeCount = live.filter((a) => a.status === "active").length;
    const femaleCount = live.filter((a) => a.gender === "female" && a.status === "active").length;
    const deadCount = live.filter((a) => a.status === "dead").length;

    const yearKey = today.slice(0, 4);
    const birthsThisYear = births
      .filter((b) => !b.deleted_at && b.birth_date.slice(0, 4) === yearKey)
      .reduce((sum, b) => sum + b.male_offspring_count + b.female_offspring_count, 0);

    const vaccinatedAnimalIds = new Set(vaccinations.filter((v) => !v.deleted_at).map((v) => v.animal_id));
    const overdueVaccineCount = vaccinations.filter(
      (v) => !v.deleted_at && vaccinationDueStatus(v.next_due_date, today) === "overdue"
    ).length;

    const yearTxns = txns.filter((t) => !t.deleted_at && t.transaction_date.slice(0, 4) === yearKey);
    const pl = computeProfitLoss(yearTxns);

    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoCount = live.filter((a) => a.created_at.slice(0, 10) <= monthAgo.toISOString().slice(0, 10)).length;
    const yoyGrowth = monthAgoCount > 0 ? ((activeCount - monthAgoCount) / monthAgoCount) * 100 : 0;

    return {
      activeCount,
      femaleCount,
      deadCount,
      totalEver: live.length,
      birthsThisYear,
      vaccinatedCount: vaccinatedAnimalIds.size,
      overdueVaccineCount,
      pl,
      yoyGrowth,
    };
  }, [farmId, today]);

  if (!data) {
    return <p className="p-4 text-center text-muted-foreground">در حال بارگذاری…</p>;
  }

  const itemsWithoutAlert = feedItems.filter((i) => {
    const remaining = daysRemaining(i.quantity, i.daily_rate);
    return remaining === null || remaining > 14;
  }).length;

  const metrics = {
    birthRate: birthRatePercent(data.birthsThisYear, data.femaleCount),
    mortality: mortalityScore(data.deadCount, data.totalEver),
    feedEfficiency: feedEfficiencyScore(itemsWithoutAlert, feedItems.length),
    profitability: profitabilityScore(data.pl.netProfit, data.pl.revenue),
    vaccinationCoverage: vaccinationCoveragePercent(data.vaccinatedCount, data.activeCount),
    herdGrowth: herdGrowthScore(data.yoyGrowth),
  };
  const overall = overallPerformanceScore(metrics);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Gauge className="size-6 text-primary" />
        <h1 className="text-xl font-bold">عملکرد دامداری</h1>
      </div>

      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-4xl font-bold text-primary">{toPersianDigits(overall)}</div>
          <div className="text-sm text-muted-foreground">امتیاز کلی عملکرد (از ۱۰۰)</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>شاخص‌ها</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ScoreRow label="نرخ زایمان" value={metrics.birthRate} />
          <ScoreRow label="نرخ بقا (کمتر تلفات)" value={metrics.mortality} />
          <ScoreRow label="کارایی خوراک" value={metrics.feedEfficiency} />
          <ScoreRow label="سودآوری" value={metrics.profitability} />
          <ScoreRow label="پوشش واکسیناسیون" value={metrics.vaccinationCoverage} />
          <ScoreRow label="رشد گله" value={metrics.herdGrowth} />
        </CardContent>
      </Card>

      {data.overdueVaccineCount > 0 && (
        <p className="text-sm text-destructive">{toPersianDigits(data.overdueVaccineCount)} واکسن سررسید گذشته روی امتیاز واکسیناسیون تأثیر گذاشته است.</p>
      )}
    </div>
  );
}
