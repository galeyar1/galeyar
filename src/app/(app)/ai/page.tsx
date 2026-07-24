"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Sparkles,
  Baby,
  Wheat,
  Stethoscope,
  Syringe,
  Bug,
  TrendingUp,
  Dna,
  ChevronLeft,
} from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { toPersianDigits, todayIso } from "@/lib/jalali";
import { daysUntilBirth, pregnancyStage } from "@/lib/pregnancy";
import { daysRemaining as feedDaysRemaining } from "@/lib/feed-forecast";
import { feverAlertLevel } from "@/lib/disease-alerts";
import { vaccinationDueStatus } from "@/lib/vaccination-alerts";
import { daysSinceLastDeworming, dewormingOverdue } from "@/lib/deworming-alerts";
import { computePedigreeFarmStats } from "@/lib/pedigree-stats";
import { mostCommonExitReason, EXIT_REASON_LABELS } from "@/lib/exit-reasons";
import { isoToJalali } from "@/lib/jalali";
import type { PedigreeAnimal } from "@/lib/pedigree";
import type { AiInsight, FeedInventory } from "@/lib/supabase/types";

interface MilkTrendPayload {
  recent_daily_avg_liters: number;
  previous_daily_avg_liters: number;
  change_percent: number;
}

interface MenuItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number | null;
  tone: "default" | "alert";
}

export default function AiCenterPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const today = todayIso();
  const [feedAlertCount, setFeedAlertCount] = useState<number | null>(null);
  const [milkTrend, setMilkTrend] = useState<MilkTrendPayload | null>(null);

  useEffect(() => {
    // feed_inventory isn't offline-synced yet (pre-existing, same as the
    // /feed management page) — this count needs a connection.
    if (!farmId) return;
    supabase
      .from("feed_inventory")
      .select("quantity, daily_rate")
      .eq("farm_id", farmId)
      .then(({ data }) => {
        const items = (data ?? []) as Pick<FeedInventory, "quantity" | "daily_rate">[];
        const alerts = items.filter((i) => {
          const remaining = feedDaysRemaining(i.quantity, i.daily_rate);
          return remaining !== null && remaining <= 14;
        });
        setFeedAlertCount(alerts.length);
      });
  }, [farmId]);

  useEffect(() => {
    // Generated server-side by the generate-ai-insights Edge Function
    // (scheduled job) — kept from the previous /ai page.
    if (!farmId) return;
    supabase
      .from("ai_insights")
      .select("*")
      .eq("farm_id", farmId)
      .eq("insight_type", "milk_trend")
      .order("generated_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const row = (data as AiInsight[] | null)?.[0];
        if (row) setMilkTrend(row.payload as MilkTrendPayload);
      });
  }, [farmId]);

  const pregnancyStats = useLiveQuery(async () => {
    if (!farmId) return { pregnant: 0, nearBirth: 0, overdue: 0, birthsThisMonth: 0 };
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    const pregnant = rows.filter((a) => !a.deleted_at && a.is_pregnant);
    let nearBirth = 0;
    let overdue = 0;
    for (const a of pregnant) {
      if (!a.expected_birth_date) continue;
      const days = daysUntilBirth(a.expected_birth_date, today);
      const stage = pregnancyStage(days);
      if (stage === "near_birth") nearBirth += 1;
      if (stage === "overdue") overdue += 1;
    }
    const monthKey = today.slice(0, 7);
    const births = await db.birth_records.where("farm_id").equals(farmId).toArray();
    const birthsThisMonth = births.filter((b) => !b.deleted_at && b.birth_date.slice(0, 7) === monthKey).length;
    return { pregnant: pregnant.length, nearBirth, overdue, birthsThisMonth };
  }, [farmId, today]);

  const diseaseAlertCount = useLiveQuery(async () => {
    if (!farmId) return 0;
    const rows = await db.disease_records.where("farm_id").equals(farmId).toArray();
    return rows.filter((r) => !r.deleted_at && feverAlertLevel(r.body_temperature ?? null) !== null).length;
  }, [farmId]);

  const vaccinationAlertCount = useLiveQuery(async () => {
    if (!farmId) return 0;
    const rows = await db.vaccinations.where("farm_id").equals(farmId).toArray();
    return rows.filter((r) => {
      if (r.deleted_at) return false;
      const status = vaccinationDueStatus(r.next_due_date, today);
      return status === "overdue" || status === "upcoming";
    }).length;
  }, [farmId, today]);

  const dewormingAlertCount = useLiveQuery(async () => {
    if (!farmId) return 0;
    const rows = await db.deworming_records.where("farm_id").equals(farmId).toArray();
    return rows.filter((r) => !r.deleted_at && dewormingOverdue(daysSinceLastDeworming(r.date_given, today))).length;
  }, [farmId, today]);

  const pedigreeStats = useLiveQuery(async () => {
    if (!farmId) return null;
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return computePedigreeFarmStats(rows.filter((a) => !a.deleted_at) as PedigreeAnimal[]);
  }, [farmId]);

  const exitStat = useLiveQuery(async () => {
    if (!farmId) return null;
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    const currentJalaliYear = isoToJalali(today).jy;
    return mostCommonExitReason(rows, (updatedAt) => isoToJalali(updatedAt.slice(0, 10)).jy === currentJalaliYear);
  }, [farmId, today]);

  const menu: MenuItem[] = [
    { href: "/ai/pregnancy", label: "آبستنی", icon: Baby, count: pregnancyStats?.pregnant ?? null, tone: "default" },
    { href: "/ai/feed", label: "خوراک و جیره", icon: Wheat, count: feedAlertCount, tone: "alert" },
    { href: "/ai/disease", label: "بیماری", icon: Stethoscope, count: diseaseAlertCount ?? null, tone: "alert" },
    { href: "/ai/vaccination", label: "واکسیناسیون", icon: Syringe, count: vaccinationAlertCount ?? null, tone: "alert" },
    { href: "/ai/deworming", label: "ضد انگل", icon: Bug, count: dewormingAlertCount ?? null, tone: "alert" },
    { href: "/ai/herd-growth", label: "رشد گله", icon: TrendingUp, count: null, tone: "default" },
    { href: "/ai/genetics", label: "ژنتیک", icon: Dna, count: pedigreeStats?.inbreedingAlerts ?? null, tone: "alert" },
  ];

  const summaryLines: string[] = [];
  if (pregnancyStats && pregnancyStats.nearBirth > 0) {
    summaryLines.push(`${toPersianDigits(pregnancyStats.nearBirth)} دام نزدیک زایمان هستند.`);
  }
  if (feedAlertCount !== null && feedAlertCount > 0) {
    summaryLines.push(`${toPersianDigits(feedAlertCount)} نوع خوراک تا ۱۴ روز آینده تمام می‌شود.`);
  }
  if (vaccinationAlertCount) {
    summaryLines.push(`${toPersianDigits(vaccinationAlertCount)} دام نیازمند واکسیناسیون هستند.`);
  }
  if (dewormingAlertCount) {
    summaryLines.push(`${toPersianDigits(dewormingAlertCount)} دام بیش از ۱۸۰ روز از ضدانگل قبلی‌شان گذشته است.`);
  }
  if (diseaseAlertCount) {
    summaryLines.push(`${toPersianDigits(diseaseAlertCount)} دام دارای تب هشداردهنده هستند.`);
  }
  if (pedigreeStats && pedigreeStats.inbreedingAlerts > 0) {
    summaryLines.push(`${toPersianDigits(pedigreeStats.inbreedingAlerts)} مورد هشدار همخونی در شجره‌نامه ثبت شده است.`);
  }
  if (exitStat) {
    summaryLines.push(
      `شایع‌ترین دلیل خروج دام امسال: ${EXIT_REASON_LABELS[exitStat.reason]} (${toPersianDigits(exitStat.percent)}٪).`
    );
  }
  if (milkTrend) {
    const direction = milkTrend.change_percent >= 0 ? "افزایش" : "کاهش";
    summaryLines.push(
      `میانگین تولید شیر اخیر ${toPersianDigits(milkTrend.recent_daily_avg_liters)} لیتر — ${direction} ${toPersianDigits(
        Math.abs(milkTrend.change_percent)
      )}٪ نسبت به دوره قبل.`
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-6 text-primary" />
        <h1 className="text-xl font-bold">دستیار هوشمند گله‌یار</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {menu.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full transition-colors hover:border-primary">
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between">
                  <item.icon className="size-6 text-primary" />
                  {item.count !== null && item.count > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        item.tone === "alert" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                      }`}
                    >
                      {toPersianDigits(item.count)}
                    </span>
                  )}
                </div>
                <span className="text-base font-semibold">{item.label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-2 p-4">
          <span className="font-semibold">خلاصه روزانه</span>
          {summaryLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">هشدار فعالی برای امروز وجود ندارد.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {summaryLines.map((line, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <ChevronLeft className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  {line}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
