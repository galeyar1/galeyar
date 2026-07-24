"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Milk, Weight, Stethoscope, Baby, Pill, Pencil, Syringe } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { DeleteIconButton } from "@/components/confirm-dialog";
import { softDeleteRecord } from "@/lib/sync/repository";
import { formatJalali, toPersianDigits } from "@/lib/jalali";
import type { SyncableTable } from "@/lib/supabase/types";

interface FeedEntry {
  id: string;
  table: SyncableTable;
  animalId: string | null;
  editHref: string;
  date: string;
  createdAt: string;
  icon: typeof Milk;
  color: string;
  title: string;
  detail?: string;
}

const DISEASE_LABELS: Record<string, string> = {
  respiratory: "تنفسی",
  digestive: "گوارشی",
  fever: "تب",
  infectious: "عفونی",
  lameness: "لنگش",
  other: "سایر",
};

export default function HistoryPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const canEdit = profile?.role === "owner" || profile?.role === "operator";
  const canDelete = profile?.role === "owner";

  const feed = useLiveQuery(async () => {
    if (!farmId) return [];

    const [animals, milk, weight, disease, births, treatments, vaccinations] = await Promise.all([
      db.animals.where("farm_id").equals(farmId).toArray(),
      db.milk_records.where("farm_id").equals(farmId).toArray(),
      db.weight_records.where("farm_id").equals(farmId).toArray(),
      db.disease_records.where("farm_id").equals(farmId).toArray(),
      db.birth_records.where("farm_id").equals(farmId).toArray(),
      db.treatments.where("farm_id").equals(farmId).toArray(),
      db.vaccinations.where("farm_id").equals(farmId).toArray(),
    ]);

    const earTagOf = new Map(animals.map((a) => [a.id, a.ear_tag]));

    const entries: FeedEntry[] = [
      ...milk
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          table: "milk_records" as SyncableTable,
          animalId: r.animal_id,
          editHref: `/register/milk?id=${r.id}`,
          date: r.record_date,
          createdAt: r.created_at,
          icon: Milk,
          color: "text-primary",
          title: `ثبت شیر — ${earTagOf.get(r.animal_id) ?? "؟"}`,
          detail: `صبح ${r.morning_milk ?? 0} — عصر ${r.evening_milk ?? 0} لیتر`,
        })),
      ...weight
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          table: "weight_records" as SyncableTable,
          animalId: r.animal_id,
          editHref: `/register/weight?id=${r.id}`,
          date: r.record_date,
          createdAt: r.created_at,
          icon: Weight,
          color: "text-primary",
          title: `ثبت وزن — ${earTagOf.get(r.animal_id) ?? "؟"}`,
          detail: `${r.weight} کیلوگرم`,
        })),
      ...disease
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          table: "disease_records" as SyncableTable,
          animalId: r.animal_id,
          editHref: `/register/disease?id=${r.id}`,
          date: r.record_date,
          createdAt: r.created_at,
          icon: Stethoscope,
          color: "text-destructive",
          title: `بیماری — ${earTagOf.get(r.animal_id) ?? "؟"}`,
          detail: DISEASE_LABELS[r.disease_type] ?? r.disease_type,
        })),
      ...births
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          table: "birth_records" as SyncableTable,
          animalId: r.mother_id,
          editHref: `/register/birth?id=${r.id}`,
          date: r.birth_date,
          createdAt: r.created_at,
          icon: Baby,
          color: "text-success",
          title: `زایمان — ${earTagOf.get(r.mother_id) ?? "؟"}`,
          detail: [
            `${toPersianDigits(r.male_offspring_count)} نر، ${toPersianDigits(r.female_offspring_count)} ماده`,
            ...(r.offspring_generated_ids?.length ? [r.offspring_generated_ids.join("، ")] : []),
          ].join(" — "),
        })),
      ...treatments
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          table: "treatments" as SyncableTable,
          animalId: r.animal_id,
          editHref: `/register/treatment?id=${r.id}`,
          date: r.treatment_date,
          createdAt: r.created_at,
          icon: Pill,
          color: "text-success",
          title: `درمان — ${earTagOf.get(r.animal_id) ?? "؟"}`,
          detail: r.medication,
        })),
      ...vaccinations
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          table: "vaccinations" as SyncableTable,
          animalId: r.animal_id,
          editHref: `/register/vaccination?id=${r.id}`,
          date: r.date_given,
          createdAt: r.created_at,
          icon: Syringe,
          color: "text-success",
          title: `واکسیناسیون — ${earTagOf.get(r.animal_id) ?? "؟"}`,
          detail: r.vaccine_name,
        })),
    ];

    return entries.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 200);
  }, [farmId]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">تاریخچه فعالیت‌ها</h1>

      {feed?.length === 0 && (
        <p className="mt-10 text-center text-muted-foreground">هنوز فعالیتی ثبت نشده است.</p>
      )}

      <ul className="flex flex-col gap-2">
        {feed?.map((entry) => (
          <li key={entry.id} className="flex items-start gap-1 rounded-xl border border-border bg-card p-3">
            <Link
              href={entry.animalId ? `/animals/view?id=${entry.animalId}` : "#"}
              className="flex flex-1 items-start gap-3"
            >
              <entry.icon className={`mt-0.5 size-5 shrink-0 ${entry.color}`} />
              <div className="flex flex-1 flex-col">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{entry.title}</span>
                  <span className="text-xs text-muted-foreground">{formatJalali(entry.date)}</span>
                </div>
                {entry.detail && <span className="text-sm text-muted-foreground">{entry.detail}</span>}
              </div>
            </Link>
            {canEdit && (
              <Button variant="ghost" size="icon-sm" asChild aria-label="ویرایش">
                <Link href={entry.editHref}>
                  <Pencil className="size-4" />
                </Link>
              </Button>
            )}
            {canDelete && <DeleteIconButton onDelete={() => softDeleteRecord(entry.table, entry.id)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
