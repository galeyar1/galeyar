"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Syringe } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatJalali, toPersianDigits, todayIso } from "@/lib/jalali";
import { vaccinationDueStatus } from "@/lib/vaccination-alerts";

export default function VaccinationAssistantPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const today = todayIso();

  const data = useLiveQuery(async () => {
    if (!farmId) return null;
    const [records, animals] = await Promise.all([
      db.vaccinations.where("farm_id").equals(farmId).toArray(),
      db.animals.where("farm_id").equals(farmId).toArray(),
    ]);
    const earTagOf = new Map(animals.map((a) => [a.id, a.ear_tag]));
    const live = records.filter((r) => !r.deleted_at);

    const withStatus = live.map((r) => ({
      record: r,
      earTag: earTagOf.get(r.animal_id) ?? "؟",
      status: vaccinationDueStatus(r.next_due_date, today),
    }));

    const history = [...live].sort((a, b) => (a.date_given < b.date_given ? 1 : -1)).slice(0, 20);

    return {
      overdue: withStatus.filter((r) => r.status === "overdue"),
      upcoming: withStatus.filter((r) => r.status === "upcoming"),
      history,
      earTagOf,
    };
  }, [farmId, today]);

  const overdueByVaccine = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of data?.overdue ?? []) {
      counts.set(r.record.vaccine_name, (counts.get(r.record.vaccine_name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Syringe className="size-6 text-primary" />
        <h1 className="text-xl font-bold">دستیار هوشمند واکسیناسیون</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className={`p-4 text-center ${(data?.overdue.length ?? 0) > 0 ? "text-destructive" : ""}`}>
            <div className="text-2xl font-bold">{toPersianDigits(data?.overdue.length ?? 0)}</div>
            <div className="text-xs">سررسید گذشته</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{toPersianDigits(data?.upcoming.length ?? 0)}</div>
            <div className="text-xs text-muted-foreground">نزدیک سررسید (۳۰ روز)</div>
          </CardContent>
        </Card>
      </div>

      {overdueByVaccine.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {overdueByVaccine
            .map(([name, count]) => `${toPersianDigits(count)} دام نیازمند واکسن ${name}`)
            .join(" — ")}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>سررسید گذشته</CardTitle>
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
                <span>{r.earTag} — {r.record.vaccine_name}</span>
                <span>{formatJalali(r.record.next_due_date)}</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>نزدیک سررسید</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(data?.upcoming.length ?? 0) === 0 ? (
            <p className="text-center text-muted-foreground">موردی نیست.</p>
          ) : (
            data?.upcoming.map((r) => (
              <Link
                key={r.record.id}
                href={`/animals/view?id=${r.record.animal_id}`}
                className="flex justify-between rounded-lg bg-muted p-2 text-sm"
              >
                <span>{r.earTag} — {r.record.vaccine_name}</span>
                <span>{formatJalali(r.record.next_due_date)}</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>تاریخچه واکسیناسیون</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(data?.history.length ?? 0) === 0 ? (
            <p className="text-center text-muted-foreground">موردی ثبت نشده است.</p>
          ) : (
            data?.history.map((r) => (
              <div key={r.id} className="flex justify-between text-sm">
                <span>{data.earTagOf.get(r.animal_id) ?? "؟"} — {r.vaccine_name}</span>
                <span className="text-muted-foreground">{formatJalali(r.date_given)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
