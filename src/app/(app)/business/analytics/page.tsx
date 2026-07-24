"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { BarChart3 } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toPersianDigits } from "@/lib/jalali";
import {
  mostProfitableAnimal,
  mostExpensiveAnimal,
  highestProducingAnimal,
  bestFarm,
  worstFarm,
  type AnimalFinancialSummary,
  type AnimalRanking,
  type FarmScore,
} from "@/lib/business-analytics";
import { computeProfitLoss } from "@/lib/finance";
import type { Farm } from "@/lib/supabase/types";

export default function BusinessAnalyticsPage() {
  const { profile, session } = useAuth();
  const farmId = profile?.farm_id;
  const [farmScores, setFarmScores] = useState<FarmScore[] | null>(null);

  const animalFinancials = useLiveQuery(async () => {
    if (!farmId) return { profitable: null, expensive: null, earTagOf: new Map<string, string>() };
    const [txns, animals] = await Promise.all([
      db.financial_transactions.where("farm_id").equals(farmId).toArray(),
      db.animals.where("farm_id").equals(farmId).toArray(),
    ]);
    const earTagOf = new Map(animals.map((a) => [a.id, a.ear_tag]));
    const byAnimal = new Map<string, AnimalFinancialSummary>();
    for (const t of txns) {
      if (t.deleted_at || !t.animal_id) continue;
      const entry = byAnimal.get(t.animal_id) ?? { animalId: t.animal_id, revenue: 0, expense: 0 };
      if (t.type === "income") entry.revenue += Number(t.amount);
      else entry.expense += Number(t.amount);
      byAnimal.set(t.animal_id, entry);
    }
    const summaries = [...byAnimal.values()];
    return {
      profitable: mostProfitableAnimal(summaries),
      expensive: mostExpensiveAnimal(summaries),
      earTagOf,
    };
  }, [farmId]);

  const highestProducer = useLiveQuery(async () => {
    if (!farmId) return null;
    const [milk, animals] = await Promise.all([
      db.milk_records.where("farm_id").equals(farmId).toArray(),
      db.animals.where("farm_id").equals(farmId).toArray(),
    ]);
    const earTagOf = new Map(animals.map((a) => [a.id, a.ear_tag]));
    const totals = new Map<string, number>();
    for (const m of milk) {
      if (m.deleted_at) continue;
      totals.set(m.animal_id, (totals.get(m.animal_id) ?? 0) + Number(m.morning_milk ?? 0) + Number(m.evening_milk ?? 0));
    }
    const ranking: AnimalRanking[] = [...totals.entries()].map(([animalId, value]) => ({ animalId, value }));
    const best = highestProducingAnimal(ranking);
    return best ? { ...best, earTag: earTagOf.get(best.animalId) ?? "؟" } : null;
  }, [farmId]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data: memberships } = await supabase
        .from("farm_members")
        .select("farm_id, farms(*)")
        .eq("user_id", session.user.id);
      const farms = ((memberships ?? []) as unknown as { farm_id: string; farms: Farm }[]).map((m) => m.farms).filter(Boolean);
      if (farms.length < 2) {
        setFarmScores([]);
        return;
      }
      const thisYear = new Date().toISOString().slice(0, 4);
      const scores = await Promise.all(
        farms.map(async (farm): Promise<FarmScore> => {
          const { data: txns } = await supabase
            .from("financial_transactions")
            .select("type, amount, transaction_date, is_settled")
            .eq("farm_id", farm.id)
            .gte("transaction_date", `${thisYear}-01-01`)
            .is("deleted_at", null);
          const pl = computeProfitLoss(txns ?? []);
          return { farmId: farm.id, farmName: farm.farm_name, score: pl.netProfit };
        })
      );
      setFarmScores(scores);
    })();
  }, [session]);

  const best = useMemo(() => (farmScores && farmScores.length > 0 ? bestFarm(farmScores) : null), [farmScores]);
  const worst = useMemo(() => (farmScores && farmScores.length > 1 ? worstFarm(farmScores) : null), [farmScores]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="size-6 text-primary" />
        <h1 className="text-xl font-bold">تحلیل کسب‌وکار</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>پرسودترین دام</CardTitle></CardHeader>
        <CardContent>
          {animalFinancials?.profitable ? (
            <Link href={`/animals/view?id=${animalFinancials.profitable.animalId}`} className="text-lg font-bold text-primary">
              {animalFinancials.earTagOf.get(animalFinancials.profitable.animalId) ?? "؟"}
            </Link>
          ) : (
            <p className="text-muted-foreground">داده کافی نیست.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>پرهزینه‌ترین دام</CardTitle></CardHeader>
        <CardContent>
          {animalFinancials?.expensive ? (
            <Link href={`/animals/view?id=${animalFinancials.expensive.animalId}`} className="text-lg font-bold text-destructive">
              {animalFinancials.earTagOf.get(animalFinancials.expensive.animalId) ?? "؟"}
            </Link>
          ) : (
            <p className="text-muted-foreground">داده کافی نیست.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>پرتولیدترین دام (شیر)</CardTitle></CardHeader>
        <CardContent>
          {highestProducer ? (
            <Link href={`/animals/view?id=${highestProducer.animalId}`} className="text-lg font-bold text-primary">
              {highestProducer.earTag} — {toPersianDigits(highestProducer.value.toFixed(1))} لیتر
            </Link>
          ) : (
            <p className="text-muted-foreground">داده کافی نیست.</p>
          )}
        </CardContent>
      </Card>

      {farmScores && farmScores.length >= 2 && (
        <Card>
          <CardHeader><CardTitle>مقایسه دامداری‌ها (سود امسال)</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {best && <p>بهترین عملکرد: <strong className="text-success">{best.farmName}</strong></p>}
            {worst && <p>ضعیف‌ترین عملکرد: <strong className="text-destructive">{worst.farmName}</strong></p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
