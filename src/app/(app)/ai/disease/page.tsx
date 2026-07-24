"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Stethoscope, AlertTriangle, ShieldAlert } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatJalali, toPersianDigits, todayIso } from "@/lib/jalali";
import { feverAlertLevel, notImprovingAlert, isQuarantineActive } from "@/lib/disease-alerts";
import type { DiseaseType } from "@/lib/supabase/types";

const DISEASE_LABELS: Record<DiseaseType, string> = {
  respiratory: "تنفسی",
  digestive: "گوارشی",
  fever: "تب",
  infectious: "عفونی",
  lameness: "لنگش",
  other: "سایر",
};

export default function DiseaseAssistantPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const today = todayIso();

  const data = useLiveQuery(async () => {
    if (!farmId) return null;
    const [records, animals] = await Promise.all([
      db.disease_records.where("farm_id").equals(farmId).toArray(),
      db.animals.where("farm_id").equals(farmId).toArray(),
    ]);
    const earTagOf = new Map(animals.map((a) => [a.id, a.ear_tag]));
    const live = records.filter((r) => !r.deleted_at).sort((a, b) => (a.record_date < b.record_date ? 1 : -1));

    // "Has a newer record for the same animal" — used to decide whether an
    // older case still counts as unresolved.
    const latestByAnimal = new Map<string, string>();
    for (const r of live) {
      const existing = latestByAnimal.get(r.animal_id);
      if (!existing || r.record_date > existing) latestByAnimal.set(r.animal_id, r.record_date);
    }

    const recentCutoff = new Date();
    recentCutoff.setDate(recentCutoff.getDate() - 60);
    const recentCutoffIso = recentCutoff.toISOString().slice(0, 10);

    const sick = live
      .filter((r) => r.record_date >= recentCutoffIso)
      .map((r) => ({
        record: r,
        earTag: earTagOf.get(r.animal_id) ?? "؟",
        fever: feverAlertLevel(r.body_temperature ?? null),
        notImproving: notImprovingAlert(r.record_date, today, latestByAnimal.get(r.animal_id) !== r.record_date),
        quarantined: isQuarantineActive(r.quarantine_until, today),
      }));

    const statsCutoff = new Date();
    statsCutoff.setDate(statsCutoff.getDate() - 90);
    const statsCutoffIso = statsCutoff.toISOString().slice(0, 10);
    const typeCounts: Map<DiseaseType, number> = new Map();
    for (const r of live) {
      if (r.record_date < statsCutoffIso) continue;
      typeCounts.set(r.disease_type, (typeCounts.get(r.disease_type) ?? 0) + 1);
    }

    return { sick, typeCounts };
  }, [farmId, today]);

  const alertCount = useMemo(
    () => (data?.sick ?? []).filter((s) => s.fever !== null || s.notImproving).length,
    [data]
  );
  const quarantineList = useMemo(() => (data?.sick ?? []).filter((s) => s.quarantined), [data]);
  const typeCountEntries = useMemo(
    () => [...(data?.typeCounts ?? new Map<DiseaseType, number>())],
    [data]
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Stethoscope className="size-6 text-primary" />
        <h1 className="text-xl font-bold">دستیار هوشمند بیماری</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{toPersianDigits((data?.sick ?? []).length)}</div>
            <div className="text-xs text-muted-foreground">دام‌های بیمار (۶۰ روز اخیر)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={`p-4 text-center ${alertCount > 0 ? "text-destructive" : ""}`}>
            <div className="text-2xl font-bold">{toPersianDigits(alertCount)}</div>
            <div className="text-xs">هشدار فعال</div>
          </CardContent>
        </Card>
      </div>

      {quarantineList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-destructive" /> در قرنطینه
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {quarantineList.map((s) => (
              <div key={s.record.id} className="flex justify-between rounded-lg bg-destructive/10 p-2 text-sm">
                <Link href={`/animals/view?id=${s.record.animal_id}`} className="text-primary">
                  {s.earTag}
                </Link>
                <span>تا {formatJalali(s.record.quarantine_until)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>دام‌های بیمار</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(data?.sick ?? []).length === 0 && (
            <p className="text-center text-muted-foreground">موردی در ۶۰ روز اخیر ثبت نشده است.</p>
          )}
          {(data?.sick ?? []).map((s) => (
            <Link
              key={s.record.id}
              href={`/animals/view?id=${s.record.animal_id}`}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
            >
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{s.earTag}</span>
                <span className="text-xs text-muted-foreground">
                  {DISEASE_LABELS[s.record.disease_type]} · {formatJalali(s.record.record_date)}
                  {s.record.body_temperature ? ` · ${toPersianDigits(s.record.body_temperature)}°C` : ""}
                </span>
              </span>
              {(s.fever || s.notImproving) && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle className="size-3.5" />
                  {s.fever === "emergency" ? "تب اورژانسی" : s.fever === "warning" ? "تب بالا" : "بهبود نیافته"}
                </span>
              )}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>آمار بیماری (۹۰ روز اخیر)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {typeCountEntries.length === 0 ? (
            <p className="text-center text-muted-foreground">داده کافی برای آمار وجود ندارد.</p>
          ) : (
            typeCountEntries.map(([type, count]) => (
              <div key={type} className="flex justify-between rounded-lg bg-muted p-2 text-sm">
                <span>{DISEASE_LABELS[type]}</span>
                <span className="font-semibold">{toPersianDigits(count)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
