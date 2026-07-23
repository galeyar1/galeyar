"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Milk, Weight, Stethoscope, Baby, Pill } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { formatJalali } from "@/lib/jalali";

interface FeedEntry {
  id: string;
  animalId: string | null;
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

  const feed = useLiveQuery(async () => {
    if (!farmId) return [];

    const [animals, milk, weight, disease, births, treatments] = await Promise.all([
      db.animals.where("farm_id").equals(farmId).toArray(),
      db.milk_records.where("farm_id").equals(farmId).toArray(),
      db.weight_records.where("farm_id").equals(farmId).toArray(),
      db.disease_records.where("farm_id").equals(farmId).toArray(),
      db.birth_records.where("farm_id").equals(farmId).toArray(),
      db.treatments.where("farm_id").equals(farmId).toArray(),
    ]);

    const earTagOf = new Map(animals.map((a) => [a.id, a.ear_tag]));

    const entries: FeedEntry[] = [
      ...milk
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          animalId: r.animal_id,
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
          animalId: r.animal_id,
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
          animalId: r.animal_id,
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
          animalId: r.mother_id,
          date: r.birth_date,
          createdAt: r.created_at,
          icon: Baby,
          color: "text-success",
          title: `زایمان — ${earTagOf.get(r.mother_id) ?? "؟"}`,
          detail: `${r.offspring_count} نوزاد`,
        })),
      ...treatments
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          animalId: r.animal_id,
          date: r.treatment_date,
          createdAt: r.created_at,
          icon: Pill,
          color: "text-success",
          title: `درمان — ${earTagOf.get(r.animal_id) ?? "؟"}`,
          detail: r.medication,
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
          <li key={entry.id}>
            <Link
              href={entry.animalId ? `/animals/view?id=${entry.animalId}` : "#"}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
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
          </li>
        ))}
      </ul>
    </div>
  );
}
