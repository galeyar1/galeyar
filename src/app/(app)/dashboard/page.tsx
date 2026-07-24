"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Milk,
  Wheat,
  Stethoscope,
  Bell,
  Weight,
  Baby,
  Pill,
  AlertTriangle,
  Building2,
  CloudUpload,
  Syringe,
  GitBranch,
} from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { useSyncStatus } from "@/lib/sync/use-sync-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimalNavIcon } from "@/components/animal-nav-icon";
import { SPECIES_LABELS, effectiveAnimalType, portfolioColor } from "@/lib/animal-labels";
import { feedLabel } from "@/lib/feed-labels";
import { computePedigreeFarmStats } from "@/lib/pedigree-stats";
import type { PedigreeAnimal } from "@/lib/pedigree";
import { todayIso, toPersianDigits } from "@/lib/jalali";
import type {
  AiInsight,
  FeedInventory,
  FeedConsumptionLog,
  FeedType,
  NotificationRow,
  Species,
} from "@/lib/supabase/types";

const SPECIES_ORDER: Species[] = ["sheep", "goat", "cattle", "camel", "horse"];

const CONSUMPTION_WINDOW_DAYS = 30;

const CHART_COLORS = ["#1B5E20", "#66BB6A", "#A5D6A7", "#2E7D32"];

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="min-w-[140px] flex-1">
      <CardContent className="flex flex-col gap-1 p-4">
        <Icon className="size-5 text-primary" />
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { profile, session } = useAuth();
  const farmId = profile?.farm_id;
  const canSeeManagement = profile?.role === "owner" || profile?.role === "consultant";

  const [feedInventory, setFeedInventory] = useState<FeedInventory[]>([]);
  const [feedConsumption, setFeedConsumption] = useState<FeedConsumptionLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [totalFarms, setTotalFarms] = useState<number | null>(null);
  const { pendingCount } = useSyncStatus();
  const isOwner = profile?.role === "owner";

  useEffect(() => {
    if (!isOwner || !session?.user.id) return;
    supabase
      .from("farm_members")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .then(({ count }) => setTotalFarms(count ?? 1));
  }, [isOwner, session?.user.id]);

  useEffect(() => {
    if (!farmId || !canSeeManagement) return;

    supabase
      .from("feed_inventory")
      .select("*")
      .eq("farm_id", farmId)
      .then(({ data }) => setFeedInventory(data ?? []));

    const since = new Date();
    since.setDate(since.getDate() - CONSUMPTION_WINDOW_DAYS);
    supabase
      .from("feed_consumption_log")
      .select("*")
      .eq("farm_id", farmId)
      .gte("log_date", since.toISOString().slice(0, 10))
      .then(({ data }) => setFeedConsumption(data ?? []));

    supabase
      .from("notifications")
      .select("*")
      .eq("farm_id", farmId)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setNotifications(data ?? []));

    supabase
      .from("ai_insights")
      .select("*")
      .eq("farm_id", farmId)
      .order("generated_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setInsights(data ?? []));
  }, [farmId, canSeeManagement]);

  const animals = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows.filter((a) => !a.deleted_at && a.status === "active");
  }, [farmId]);

  // Pedigree relationships don't care about sold/dead status, so this is a
  // separate (all-status) query from the `animals` one above.
  const pedigreeAnimals = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows.filter((a) => !a.deleted_at) as PedigreeAnimal[];
  }, [farmId]);

  const pedigreeStats = useMemo(() => computePedigreeFarmStats(pedigreeAnimals ?? []), [pedigreeAnimals]);

  const todayMilk = useLiveQuery(async () => {
    if (!farmId) return 0;
    const today = todayIso();
    const rows = await db.milk_records.where("farm_id").equals(farmId).toArray();
    return rows
      .filter((r) => !r.deleted_at && r.record_date === today)
      .reduce((sum, r) => sum + Number(r.morning_milk ?? 0) + Number(r.evening_milk ?? 0), 0);
  }, [farmId]);

  const activeDiseaseCount = useLiveQuery(async () => {
    if (!farmId) return 0;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const rows = await db.disease_records.where("farm_id").equals(farmId).toArray();
    return rows.filter((r) => !r.deleted_at && r.record_date >= since.toISOString().slice(0, 10)).length;
  }, [farmId]);

  const recentActivity = useLiveQuery(async () => {
    if (!farmId) return [];
    const [animalRows, milk, weight, disease, births, treatments] = await Promise.all([
      db.animals.where("farm_id").equals(farmId).toArray(),
      db.milk_records.where("farm_id").equals(farmId).toArray(),
      db.weight_records.where("farm_id").equals(farmId).toArray(),
      db.disease_records.where("farm_id").equals(farmId).toArray(),
      db.birth_records.where("farm_id").equals(farmId).toArray(),
      db.treatments.where("farm_id").equals(farmId).toArray(),
    ]);
    const earTagOf = new Map(animalRows.map((a) => [a.id, a.ear_tag]));

    const entries = [
      ...milk.filter((r) => !r.deleted_at).map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        icon: Milk,
        color: "text-primary",
        title: `ثبت شیر — ${earTagOf.get(r.animal_id) ?? "؟"}`,
      })),
      ...weight.filter((r) => !r.deleted_at).map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        icon: Weight,
        color: "text-primary",
        title: `ثبت وزن — ${earTagOf.get(r.animal_id) ?? "؟"}`,
      })),
      ...disease.filter((r) => !r.deleted_at).map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        icon: Stethoscope,
        color: "text-destructive",
        title: `بیماری — ${earTagOf.get(r.animal_id) ?? "؟"}`,
      })),
      ...births.filter((r) => !r.deleted_at).map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        icon: Baby,
        color: "text-success",
        title: `زایمان — ${earTagOf.get(r.mother_id) ?? "؟"}`,
      })),
      ...treatments.filter((r) => !r.deleted_at).map((r) => ({
        id: r.id,
        createdAt: r.created_at,
        icon: Pill,
        color: "text-success",
        title: `درمان — ${earTagOf.get(r.animal_id) ?? "؟"}`,
      })),
    ];

    return entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5);
  }, [farmId]);

  const birthsThisMonth = useLiveQuery(async () => {
    if (!farmId) return 0;
    const monthKey = new Date().toISOString().slice(0, 7);
    const rows = await db.birth_records.where("farm_id").equals(farmId).toArray();
    return rows
      .filter((r) => !r.deleted_at && r.birth_date.slice(0, 7) === monthKey)
      .reduce((sum, r) => sum + r.male_offspring_count + r.female_offspring_count, 0);
  }, [farmId]);

  const vaccinationsDue = useLiveQuery(async () => {
    if (!farmId) return 0;
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const cutoff = in30Days.toISOString().slice(0, 10);
    const rows = await db.vaccinations.where("farm_id").equals(farmId).toArray();
    return rows.filter((r) => !r.deleted_at && r.next_due_date && r.next_due_date <= cutoff).length;
  }, [farmId]);

  const birthTrend = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.birth_records.where("farm_id").equals(farmId).toArray();
    const byMonth = new Map<string, number>();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toISOString().slice(0, 7);
      months.push(key);
      byMonth.set(key, 0);
    }
    for (const r of rows) {
      if (r.deleted_at) continue;
      const key = r.birth_date.slice(0, 7);
      if (byMonth.has(key)) {
        byMonth.set(key, (byMonth.get(key) ?? 0) + r.male_offspring_count + r.female_offspring_count);
      }
    }
    return months.map((m) => ({ month: m.slice(5), value: byMonth.get(m) ?? 0 }));
  }, [farmId]);

  const herdGrowthSeries = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    const active = rows.filter((a) => !a.deleted_at);
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }
    return months.map((m) => {
      const cutoff = `${m}-31`;
      const count = active.filter((a) => a.created_at.slice(0, 10) <= cutoff).length;
      return { month: m.slice(5), value: count };
    });
  }, [farmId]);

  const herdComposition = (animals ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.species] = (acc[a.species] ?? 0) + 1;
    return acc;
  }, {});

  const chartData = Object.entries(herdComposition).map(([species, count]) => ({
    name: SPECIES_LABELS[species as keyof typeof SPECIES_LABELS] ?? species,
    value: count,
  }));

  const portfolioBySpecies = SPECIES_ORDER.map((species) => {
    const speciesAnimals = (animals ?? []).filter((a) => a.species === species);
    if (speciesAnimals.length === 0) return null;

    const buckets = new Map<string, { label: string; count: number; color: string }>();
    for (const a of speciesAnimals) {
      const type = effectiveAnimalType(species, a.gender as "male" | "female" | null, a.birth_date);
      if (!type) continue;
      const key = type.value;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(key, { label: type.label, count: 1, color: portfolioColor(species, type.gender, type.isJuvenile) });
      }
    }

    return {
      species,
      total: speciesAnimals.length,
      entries: [...buckets.values()],
    };
  }).filter((p): p is NonNullable<typeof p> => p !== null);

  const feedConsumptionChartData = feedInventory.map((item) => ({
    name: feedLabel(item),
    value: feedConsumption
      .filter((c) => c.feed_type === item.feed_type)
      .reduce((sum, c) => sum + Number(c.amount_used), 0),
  }));

  const feedAlerts = feedInventory.filter((item) => {
    const monthly = feedConsumption
      .filter((c) => c.feed_type === item.feed_type)
      .reduce((sum, c) => sum + Number(c.amount_used), 0);
    const dailyAvg = monthly / CONSUMPTION_WINDOW_DAYS;
    const remaining = dailyAvg > 0 ? Math.floor(item.quantity / dailyAvg) : null;
    return remaining !== null && remaining <= 14;
  });

  const feedForecast = insights.find((i) => i.insight_type === "feed_forecast");
  const herdGrowth = insights.find((i) => i.insight_type === "herd_growth");
  const aiSuggestions = insights.filter((i) => i.insight_type !== "feed_forecast" && i.insight_type !== "herd_growth");

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-bold">داشبورد</h1>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {isOwner && totalFarms !== null && (
          <StatCard icon={Building2} label="مزرعه‌ها" value={toPersianDigits(totalFarms)} />
        )}
        <StatCard icon={AnimalNavIcon} label="کل دام‌ها" value={toPersianDigits(animals?.length ?? 0)} />
        <StatCard icon={Milk} label="شیر امروز (لیتر)" value={toPersianDigits((todayMilk ?? 0).toFixed(1))} />
        {canSeeManagement && (
          <StatCard
            icon={Wheat}
            label="اقلام خوراک"
            value={toPersianDigits(feedInventory.length)}
          />
        )}
        <StatCard icon={Stethoscope} label="بیماری (۳۰ روز اخیر)" value={toPersianDigits(activeDiseaseCount ?? 0)} />
        <StatCard icon={Baby} label="زایمان این ماه" value={toPersianDigits(birthsThisMonth ?? 0)} />
        <StatCard icon={Syringe} label="واکسن‌های سررسید" value={toPersianDigits(vaccinationsDue ?? 0)} />
        {pendingCount > 0 && (
          <StatCard icon={CloudUpload} label="در انتظار همگام‌سازی" value={toPersianDigits(pendingCount)} />
        )}
        {canSeeManagement && (
          <StatCard icon={Bell} label="هشدارها" value={toPersianDigits(notifications.length)} />
        )}
        {canSeeManagement && (
          <StatCard icon={AlertTriangle} label="هشدار خوراک" value={toPersianDigits(feedAlerts.length)} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ترکیب گله</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {chartData.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center text-muted-foreground">هنوز دامی ثبت نشده است.</p>
          )}
        </CardContent>
      </Card>

      {portfolioBySpecies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>پرتفوی دام‌ها</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {portfolioBySpecies.map(({ species, total, entries }) => (
              <div key={species} className="flex items-center gap-4">
                <ResponsiveContainer width={90} height={90} className="shrink-0">
                  <PieChart>
                    <Pie data={entries} dataKey="count" nameKey="label" innerRadius={22} outerRadius={40}>
                      {entries.map((e) => (
                        <Cell key={e.label} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-semibold">
                    {SPECIES_LABELS[species]} ({toPersianDigits(total)})
                  </span>
                  <ul className="flex flex-col text-sm text-muted-foreground">
                    {entries.map((e) => (
                      <li key={e.label} className="flex items-center gap-1.5">
                        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                        {toPersianDigits(e.count)} {e.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {pedigreeStats.totalFamilyTrees > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="size-4 text-primary" />
              شجره‌نامه
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted p-3 text-center">
              <div className="text-xl font-bold text-primary">{toPersianDigits(pedigreeStats.totalFamilyTrees)}</div>
              <div className="text-xs text-muted-foreground">شجره‌نامه ثبت‌شده</div>
            </div>
            <div className="rounded-xl bg-muted p-3 text-center">
              <div className="text-xl font-bold text-primary">{toPersianDigits(pedigreeStats.totalGenerations)}</div>
              <div className="text-xs text-muted-foreground">بیشترین تعداد نسل</div>
            </div>
            <div className="col-span-2 rounded-xl bg-muted p-3 text-center">
              <div className="text-sm text-muted-foreground">بزرگ‌ترین دودمان</div>
              <div className="font-bold">
                {pedigreeStats.largestBloodline
                  ? `${pedigreeStats.largestBloodline.rootEarTag} (${toPersianDigits(
                      pedigreeStats.largestBloodline.descendantCount
                    )} نسل)`
                  : "—"}
              </div>
            </div>
            <div
              className={`col-span-2 rounded-xl p-3 text-center ${
                pedigreeStats.inbreedingAlerts > 0 ? "bg-destructive/10 text-destructive" : "bg-muted"
              }`}
            >
              <div className="text-xl font-bold">{toPersianDigits(pedigreeStats.inbreedingAlerts)}</div>
              <div className="text-xs">هشدار همخونی</div>
            </div>
            <Link href="/pedigree" className="col-span-2 text-center text-sm text-primary">
              مشاهده شجره‌نامه‌ها
            </Link>
          </CardContent>
        </Card>
      )}

      {canSeeManagement && (
        <Card>
          <CardHeader>
            <CardTitle>رشد گله (۶ ماه اخیر)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={herdGrowthSeries ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#1B5E20" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {canSeeManagement && (
        <Card>
          <CardHeader>
            <CardTitle>روند زایمان (۶ ماه اخیر)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={birthTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#66BB6A" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {canSeeManagement && feedConsumptionChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>مصرف خوراک (۳۰ روز اخیر)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={feedConsumptionChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill="#EF6C00" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>فعالیت‌های اخیر</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity && recentActivity.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {recentActivity.map((entry) => (
                <li key={entry.id} className="flex items-center gap-2 text-sm">
                  <entry.icon className={`size-4 shrink-0 ${entry.color}`} />
                  <span>{entry.title}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-center text-muted-foreground">هنوز فعالیتی ثبت نشده است.</p>
          )}
          <Link href="/history" className="mt-2 block text-center text-sm text-primary">
            مشاهده همه فعالیت‌ها
          </Link>
        </CardContent>
      </Card>

      {canSeeManagement && (
        <Card>
          <CardHeader>
            <CardTitle>پیش‌بینی خوراک</CardTitle>
          </CardHeader>
          <CardContent>
            {feedForecast ? (
              <ul className="flex flex-col gap-2">
                {(
                  feedForecast.payload as {
                    feed_type: FeedType;
                    custom_label: string | null;
                    days_remaining: number | null;
                  }[]
                ).map((f) => (
                    <li key={f.feed_type} className="flex justify-between text-sm">
                      <span>{feedLabel(f)}</span>
                      <span className={f.days_remaining !== null && f.days_remaining <= 14 ? "text-destructive" : ""}>
                        {f.days_remaining !== null
                          ? `${toPersianDigits(f.days_remaining)} روز باقی‌مانده`
                          : "داده کافی نیست"}
                      </span>
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                پیش‌بینی هوشمند پس از تولید اولین گزارش دستیار هوشمند نمایش داده می‌شود.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {canSeeManagement && (
        <Card>
          <CardHeader>
            <CardTitle>رشد ماهانه گله</CardTitle>
          </CardHeader>
          <CardContent>
            {herdGrowth ? (
              <p>
                با روند فعلی، جمعیت گله تا ۱۲ ماه آینده به حدود{" "}
                <strong>
                  {toPersianDigits(
                    (herdGrowth.payload as { projected_count_in_12_months: number })
                      .projected_count_in_12_months
                  )}
                </strong>{" "}
                راس می‌رسد.
              </p>
            ) : (
              <p className="text-muted-foreground">داده کافی برای پیش‌بینی رشد گله وجود ندارد.</p>
            )}
          </CardContent>
        </Card>
      )}

      {canSeeManagement && (
        <Card>
          <CardHeader>
            <CardTitle>پیشنهادهای دستیار هوشمند</CardTitle>
          </CardHeader>
          <CardContent>
            {aiSuggestions.length > 0 ? (
              <ul className="flex flex-col gap-2 text-sm">
                {aiSuggestions.map((insight) => (
                  <li key={insight.id}>{JSON.stringify(insight.payload)}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">هنوز پیشنهادی تولید نشده است.</p>
            )}
          </CardContent>
        </Card>
      )}

      {canSeeManagement && (
        <Card>
          <CardHeader>
            <CardTitle>اعلان‌ها</CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length > 0 ? (
              <ul className="flex flex-col gap-2 text-sm">
                {notifications.map((n) => (
                  <li key={n.id} className="rounded-lg bg-muted p-2">
                    {n.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">اعلان خوانده‌نشده‌ای وجود ندارد.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
