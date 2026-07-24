"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Baby } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { updateRecord } from "@/lib/sync/repository";
import { AnimalPicker } from "@/components/animal-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { todayIso, toPersianDigits, formatJalali, isoToJalali, JALALI_MONTHS } from "@/lib/jalali";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import {
  GESTATION_DAYS,
  MAX_PREGNANCY_MONTH,
  computeExpectedBirthDate,
  daysUntilBirth,
  pregnancyStage,
  pregnancyStatusLabel,
} from "@/lib/pregnancy";
import type { Species } from "@/lib/supabase/types";

function PregnancyEditor() {
  const { profile, session } = useAuth();
  const [animalId, setAnimalId] = useState("");
  const [isPregnant, setIsPregnant] = useState(false);
  const [month, setMonth] = useState("1");
  const [saving, setSaving] = useState(false);

  const animal = useLiveQuery(() => (animalId ? db.animals.get(animalId) : undefined), [animalId]);

  async function save() {
    if (!profile?.farm_id || !session || !animal) return;
    setSaving(true);
    console.log("[ai/pregnancy] saving", { animalId, isPregnant, month });
    try {
      if (!isPregnant) {
        await updateRecord("animals", animalId, {
          is_pregnant: false,
          pregnancy_month: null,
          expected_birth_date: null,
        });
      } else {
        const species = animal.species as Species;
        const monthNum = Number(month);
        const expectedBirthDate = computeExpectedBirthDate(species, monthNum, todayIso());
        await updateRecord("animals", animalId, {
          is_pregnant: true,
          pregnancy_month: monthNum,
          expected_birth_date: expectedBirthDate,
        });
      }
      toast.success("وضعیت آبستنی ثبت شد");
      setAnimalId("");
      setIsPregnant(false);
      setMonth("1");
    } catch (error) {
      console.error("[ai/pregnancy] save failed", error);
      toast.error(error instanceof Error ? error.message : "ثبت آبستنی با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setSaving(false);
    }
  }

  const maxMonth = animal ? MAX_PREGNANCY_MONTH[animal.species as Species] : 5;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ثبت وضعیت آبستنی</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <AnimalPicker farmId={profile?.farm_id} value={animalId} onChange={setAnimalId} filter="female" />

        {animal && (
          <>
            <div className="flex items-center justify-between rounded-xl bg-muted p-3">
              <span>آبستن</span>
              <Switch checked={isPregnant} onCheckedChange={setIsPregnant} />
            </div>

            {isPregnant && (
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted-foreground">ماه آبستنی</label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-12 w-full text-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: maxMonth }, (_, i) => i + 1).map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        ماه {toPersianDigits(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button size="lg" className="h-12" onClick={save} disabled={saving}>
              {saving ? "در حال ذخیره…" : "ذخیره"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function PregnancyAssistantPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const today = todayIso();

  const pregnantAnimals = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows
      .filter((a) => !a.deleted_at && a.is_pregnant)
      .sort((a, b) => (a.expected_birth_date ?? "") < (b.expected_birth_date ?? "") ? -1 : 1);
  }, [farmId]);

  const birthsThisMonth = useLiveQuery(async () => {
    if (!farmId) return 0;
    const monthKey = today.slice(0, 7);
    const rows = await db.birth_records.where("farm_id").equals(farmId).toArray();
    return rows.filter((r) => !r.deleted_at && r.birth_date.slice(0, 7) === monthKey).length;
  }, [farmId, today]);

  const stats = useMemo(() => {
    const list = pregnantAnimals ?? [];
    let nearBirth = 0;
    let overdue = 0;
    for (const a of list) {
      if (!a.expected_birth_date) continue;
      const stage = pregnancyStage(daysUntilBirth(a.expected_birth_date, today));
      if (stage === "near_birth") nearBirth += 1;
      if (stage === "overdue") overdue += 1;
    }
    return { total: list.length, nearBirth, overdue };
  }, [pregnantAnimals, today]);

  const calendarGroups = useMemo(() => {
    const groups = new Map<string, { label: string; animals: typeof pregnantAnimals }>();
    for (const a of pregnantAnimals ?? []) {
      if (!a.expected_birth_date) continue;
      const { jy, jm } = isoToJalali(a.expected_birth_date);
      const key = `${jy}-${jm}`;
      const label = `${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
      const existing = groups.get(key);
      if (existing) existing.animals!.push(a);
      else groups.set(key, { label, animals: [a] });
    }
    return [...groups.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([, g]) => g);
  }, [pregnantAnimals]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Baby className="size-6 text-primary" />
        <h1 className="text-xl font-bold">دستیار هوشمند آبستنی</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{toPersianDigits(stats.total)}</div>
            <div className="text-xs text-muted-foreground">کل دام‌های آبستن</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{toPersianDigits(stats.nearBirth)}</div>
            <div className="text-xs text-muted-foreground">نزدیک زایمان</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{toPersianDigits(birthsThisMonth ?? 0)}</div>
            <div className="text-xs text-muted-foreground">زایمان این ماه</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className={`p-4 text-center ${stats.overdue > 0 ? "text-destructive" : ""}`}>
            <div className="text-2xl font-bold">{toPersianDigits(stats.overdue)}</div>
            <div className="text-xs">سررسید گذشته</div>
          </CardContent>
        </Card>
      </div>

      <PregnancyEditor />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">تقویم آبستنی</h2>
        {calendarGroups.length === 0 && (
          <p className="text-center text-muted-foreground">دام آبستنی ثبت نشده است.</p>
        )}
        {calendarGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{group.label}</span>
            <ul className="flex flex-col gap-1.5">
              {group.animals!.map((a) => {
                const days = a.expected_birth_date ? daysUntilBirth(a.expected_birth_date, today) : 0;
                const stage = pregnancyStage(days);
                return (
                  <li key={a.id}>
                    <Link
                      href={`/animals/view?id=${a.id}`}
                      className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold">
                          {SPECIES_LABELS[a.species]} {a.ear_tag}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {a.expected_birth_date ? formatJalali(a.expected_birth_date) : "—"}
                        </span>
                      </span>
                      <span
                        className={`text-sm ${
                          stage === "overdue" ? "text-destructive" : stage === "near_birth" ? "text-warning" : "text-muted-foreground"
                        }`}
                      >
                        {pregnancyStatusLabel(days)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        طول دوره آبستنی: گوسفند و بز {toPersianDigits(GESTATION_DAYS.sheep)} روز، گاو {toPersianDigits(GESTATION_DAYS.cattle)} روز،
        اسب {toPersianDigits(GESTATION_DAYS.horse)} روز، شتر {toPersianDigits(GESTATION_DAYS.camel)} روز.
      </p>
    </div>
  );
}
