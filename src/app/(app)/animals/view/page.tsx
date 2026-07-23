"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Milk, Weight, Stethoscope, Baby, Pill } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { SPECIES_LABELS, ANIMAL_STATUS_LABELS } from "@/lib/animal-labels";
import { formatJalali } from "@/lib/jalali";

interface TimelineEntry {
  id: string;
  date: string;
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

function AnimalDetail({ animalId }: { animalId: string }) {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;

  const animal = useLiveQuery(() => db.animals.get(animalId), [animalId]);

  const timeline = useLiveQuery(async () => {
    if (!farmId) return [];

    const [milk, weight, disease, births, treatments] = await Promise.all([
      db.milk_records.where("animal_id").equals(animalId).toArray(),
      db.weight_records.where("animal_id").equals(animalId).toArray(),
      db.disease_records.where("animal_id").equals(animalId).toArray(),
      db.birth_records.where("mother_id").equals(animalId).toArray(),
      db.treatments.where("animal_id").equals(animalId).toArray(),
    ]);

    const entries: TimelineEntry[] = [
      ...milk
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          date: r.record_date,
          icon: Milk,
          color: "text-primary",
          title: "ثبت شیر",
          detail: `صبح ${r.morning_milk ?? 0} — عصر ${r.evening_milk ?? 0} لیتر`,
        })),
      ...weight
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          date: r.record_date,
          icon: Weight,
          color: "text-primary",
          title: "ثبت وزن",
          detail: `${r.weight} کیلوگرم`,
        })),
      ...disease
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          date: r.record_date,
          icon: Stethoscope,
          color: "text-destructive",
          title: `بیماری: ${DISEASE_LABELS[r.disease_type] ?? r.disease_type}`,
          detail: r.description ?? undefined,
        })),
      ...births
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          date: r.birth_date,
          icon: Baby,
          color: "text-success",
          title: "زایمان",
          detail: `${r.offspring_count} نوزاد`,
        })),
      ...treatments
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          date: r.treatment_date,
          icon: Pill,
          color: "text-success",
          title: `درمان: ${r.medication}`,
          detail: r.notes ?? undefined,
        })),
    ];

    return entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [animalId, farmId]);

  if (!animal) {
    return <p className="p-4 text-center text-muted-foreground">دام یافت نشد</p>;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">
            {animal.name ? `${animal.name} — ` : ""}
            {animal.ear_tag}
          </h1>
          <Badge variant={animal.status === "active" ? "default" : "secondary"}>
            {ANIMAL_STATUS_LABELS[animal.status]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {SPECIES_LABELS[animal.species]}
          {animal.breed ? ` · ${animal.breed}` : ""}
          {animal.birth_date ? ` · متولد ${formatJalali(animal.birth_date)}` : ""}
        </p>
        {animal.notes && <p className="text-sm">{animal.notes}</p>}
      </div>

      <h2 className="text-lg font-semibold">تاریخچه</h2>
      {timeline?.length === 0 && (
        <p className="text-center text-muted-foreground">هنوز گزارشی برای این دام ثبت نشده است.</p>
      )}
      <ul className="flex flex-col gap-2">
        {timeline?.map((entry) => (
          <li key={entry.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
            <entry.icon className={`mt-0.5 size-5 shrink-0 ${entry.color}`} />
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{entry.title}</span>
                <span className="text-xs text-muted-foreground">{formatJalali(entry.date)}</span>
              </div>
              {entry.detail && <span className="text-sm text-muted-foreground">{entry.detail}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnimalViewInner() {
  const params = useSearchParams();
  const id = params.get("id");

  if (!id) return <p className="p-4 text-center text-muted-foreground">دامی مشخص نشده است</p>;
  return <AnimalDetail animalId={id} />;
}

export default function AnimalViewPage() {
  return (
    <Suspense fallback={<p className="p-4 text-center text-muted-foreground">در حال بارگذاری…</p>}>
      <AnimalViewInner />
    </Suspense>
  );
}
