"use client";

import { useEffect, useState } from "react";
import { Globe, WifiOff } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { useSyncStatus } from "@/lib/sync/use-sync-status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toPersianDigits } from "@/lib/jalali";
import { computeProfitLoss } from "@/lib/finance";
import { vaccinationDueStatus } from "@/lib/vaccination-alerts";
import type { Farm } from "@/lib/supabase/types";

interface FarmSummary {
  farm: Farm;
  animalCount: number;
  revenue: number;
  expenses: number;
  births: number;
  alerts: number;
}

/**
 * Aggregates across every farm the owner belongs to — not just the
 * currently active one. Offline sync only ever caches the *active* farm's
 * data locally, so unlike the rest of the app this page talks to Supabase
 * directly and needs a connection; it's the one screen where "the full
 * picture across all your farms" inherently requires that.
 */
export default function GlobalDashboardPage() {
  const { session } = useAuth();
  const { isOnline } = useSyncStatus();
  const [summaries, setSummaries] = useState<FarmSummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session || !isOnline) {
      setLoading(false);
      return;
    }

    (async () => {
      const { data: memberships } = await supabase
        .from("farm_members")
        .select("farm_id, farms(*)")
        .eq("user_id", session.user.id);

      const farms = ((memberships ?? []) as unknown as { farm_id: string; farms: Farm }[])
        .map((m) => m.farms)
        .filter(Boolean);

      const today = new Date().toISOString().slice(0, 10);
      const monthKey = today.slice(0, 7);

      const results = await Promise.all(
        farms.map(async (farm): Promise<FarmSummary> => {
          const [{ count: animalCount }, { data: txns }, { data: births }, { data: vaccinations }] = await Promise.all([
            supabase
              .from("animals")
              .select("id", { count: "exact", head: true })
              .eq("farm_id", farm.id)
              .eq("status", "active")
              .is("deleted_at", null),
            supabase
              .from("financial_transactions")
              .select("type, amount, transaction_date, is_settled")
              .eq("farm_id", farm.id)
              .gte("transaction_date", `${monthKey}-01`)
              .is("deleted_at", null),
            supabase
              .from("birth_records")
              .select("id, birth_date, male_offspring_count, female_offspring_count")
              .eq("farm_id", farm.id)
              .gte("birth_date", `${monthKey}-01`)
              .is("deleted_at", null),
            supabase
              .from("vaccinations")
              .select("next_due_date")
              .eq("farm_id", farm.id)
              .is("deleted_at", null),
          ]);

          const pl = computeProfitLoss(txns ?? []);
          const births_total = (births ?? []).reduce((sum, b) => sum + b.male_offspring_count + b.female_offspring_count, 0);
          const alerts = (vaccinations ?? []).filter((v) => {
            const status = vaccinationDueStatus(v.next_due_date, today);
            return status === "overdue" || status === "upcoming";
          }).length;

          return {
            farm,
            animalCount: animalCount ?? 0,
            revenue: pl.revenue,
            expenses: pl.expenses,
            births: births_total,
            alerts,
          };
        })
      );

      setSummaries(results);
      setLoading(false);
    })();
  }, [session, isOnline]);

  const totals = (summaries ?? []).reduce(
    (acc, s) => ({
      farms: acc.farms + 1,
      animals: acc.animals + s.animalCount,
      revenue: acc.revenue + s.revenue,
      expenses: acc.expenses + s.expenses,
      births: acc.births + s.births,
      alerts: acc.alerts + s.alerts,
    }),
    { farms: 0, animals: 0, revenue: 0, expenses: 0, births: 0, alerts: 0 }
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Globe className="size-6 text-primary" />
        <h1 className="text-xl font-bold">داشبورد کل دامداری‌ها</h1>
      </div>

      {!isOnline ? (
        <p className="flex items-center gap-2 rounded-xl bg-muted p-4 text-muted-foreground">
          <WifiOff className="size-4 shrink-0" />
          این داشبورد نیاز به اتصال اینترنت دارد تا اطلاعات همه دامداری‌ها را یک‌جا نمایش دهد.
        </p>
      ) : loading ? (
        <p className="text-center text-muted-foreground">در حال بارگذاری…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card><CardContent className="p-4 text-center"><div className="text-xl font-bold text-primary">{toPersianDigits(totals.farms)}</div><div className="text-xs text-muted-foreground">دامداری</div></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><div className="text-xl font-bold text-primary">{toPersianDigits(totals.animals)}</div><div className="text-xs text-muted-foreground">کل دام‌ها</div></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><div className="text-xl font-bold text-primary">{toPersianDigits(totals.births)}</div><div className="text-xs text-muted-foreground">زایمان این ماه</div></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><div className="text-lg font-bold text-success">{toPersianDigits(totals.revenue.toLocaleString())}</div><div className="text-xs text-muted-foreground">درآمد کل</div></CardContent></Card>
            <Card><CardContent className="p-4 text-center"><div className="text-lg font-bold text-destructive">{toPersianDigits(totals.expenses.toLocaleString())}</div><div className="text-xs text-muted-foreground">هزینه کل</div></CardContent></Card>
            <Card><CardContent className={`p-4 text-center ${totals.alerts > 0 ? "text-destructive" : ""}`}><div className="text-xl font-bold">{toPersianDigits(totals.alerts)}</div><div className="text-xs">هشدارها</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>مقایسه دامداری‌ها</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(summaries ?? []).map((s) => (
                <div key={s.farm.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <span className="font-semibold">{s.farm.farm_name}</span>
                  <div className="flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
                    <span>{toPersianDigits(s.animalCount)} دام</span>
                    <span className={s.revenue - s.expenses >= 0 ? "text-success" : "text-destructive"}>
                      سود: {toPersianDigits((s.revenue - s.expenses).toLocaleString())}
                    </span>
                  </div>
                </div>
              ))}
              {(summaries ?? []).length === 0 && (
                <p className="text-center text-muted-foreground">دامداری‌ای یافت نشد.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
