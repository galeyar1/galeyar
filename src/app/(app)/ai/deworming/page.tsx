"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Bug } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatJalali, toPersianDigits, todayIso } from "@/lib/jalali";
import { daysSinceLastDeworming, dewormingOverdue } from "@/lib/deworming-alerts";
import type { DewormingType } from "@/lib/supabase/types";

const DEWORMING_TYPE_LABELS: Record<DewormingType, string> = {
  internal: "داخلی",
  external: "خارجی",
};

export default function DewormingAssistantPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const today = todayIso();

  const data = useLiveQuery(async () => {
    if (!farmId) return null;
    const [records, animals] = await Promise.all([
      db.deworming_records.where("farm_id").equals(farmId).toArray(),
      db.animals.where("farm_id").equals(farmId).toArray(),
    ]);
    const earTagOf = new Map(animals.map((a) => [a.id, a.ear_tag]));
    const live = records.filter((r) => !r.deleted_at);

    // Most recent deworming per animal.
    const lastByAnimal = new Map<string, (typeof live)[number]>();
    for (const r of live) {
      const existing = lastByAnimal.get(r.animal_id);
      if (!existing || r.date_given > existing.date_given) lastByAnimal.set(r.animal_id, r);
    }

    const overdue = [...lastByAnimal.values()]
      .map((r) => ({ record: r, earTag: earTagOf.get(r.animal_id) ?? "؟", daysSince: daysSinceLastDeworming(r.date_given, today) }))
      .filter((r) => dewormingOverdue(r.daysSince))
      .sort((a, b) => b.daysSince - a.daysSince);

    const history = [...live].sort((a, b) => (a.date_given < b.date_given ? 1 : -1)).slice(0, 20);

    return { overdue, history, earTagOf, animalsWithRecords: lastByAnimal.size, totalAnimals: animals.filter((a) => !a.deleted_at).length };
  }, [farmId, today]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Bug className="size-6 text-primary" />
        <h1 className="text-xl font-bold">دستیار هوشمند ضد انگل</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className={`p-4 text-center ${(data?.overdue.length ?? 0) > 0 ? "text-destructive" : ""}`}>
            <div className="text-2xl font-bold">{toPersianDigits(data?.overdue.length ?? 0)}</div>
            <div className="text-xs">بیش از ۱۸۰ روز گذشته</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {toPersianDigits(data?.animalsWithRecords ?? 0)}/{toPersianDigits(data?.totalAnimals ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground">دام‌های دارای سابقه</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>نیازمند ضد انگل</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(data?.overdue.length ?? 0) === 0 ? (
            <p className="text-center text-muted-foreground">موردی نیست.</p>
          ) : (
            data?.overdue.map((r) => (
              <Link
                key={r.record.id}
                href={`/animals/view?id=${r.record.animal_id}`}
                className="flex justify-between rounded-lg bg-destructive/10 p-2 text-sm"
              >
                <span>{r.earTag}</span>
                <span>{toPersianDigits(r.daysSince)} روز پیش</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تاریخچه</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(data?.history.length ?? 0) === 0 ? (
            <p className="text-center text-muted-foreground">موردی ثبت نشده است.</p>
          ) : (
            data?.history.map((r) => (
              <div key={r.id} className="flex justify-between text-sm">
                <span>
                  {data.earTagOf.get(r.animal_id) ?? "؟"} — {r.product_name} ({DEWORMING_TYPE_LABELS[r.deworming_type]})
                </span>
                <span className="text-muted-foreground">{formatJalali(r.date_given)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
