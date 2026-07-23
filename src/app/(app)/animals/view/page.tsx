"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Milk, Weight, Stethoscope, Baby, Pill, Pencil, Syringe, GitBranch } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteIconButton } from "@/components/confirm-dialog";
import { AnimalImageGallery } from "@/components/animal-image-gallery";
import { softDeleteRecord } from "@/lib/sync/repository";
import {
  SPECIES_LABELS,
  ANIMAL_STATUS_LABELS,
  effectiveAnimalTypeLabel,
  ageLabel,
} from "@/lib/animal-labels";
import { formatJalali, toPersianDigits } from "@/lib/jalali";
import type { SyncableTable } from "@/lib/supabase/types";

interface TimelineEntry {
  id: string;
  table: SyncableTable;
  date: string;
  editHref: string;
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
  const router = useRouter();
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const canEdit = profile?.role === "owner" || profile?.role === "operator";
  const canDelete = profile?.role === "owner";

  const animal = useLiveQuery(() => db.animals.get(animalId), [animalId]);
  const father = useLiveQuery(() => (animal?.father_id ? db.animals.get(animal.father_id) : undefined), [animal?.father_id]);
  const mother = useLiveQuery(() => (animal?.mother_id ? db.animals.get(animal.mother_id) : undefined), [animal?.mother_id]);

  const familyStats = useLiveQuery(async () => {
    if (!farmId) return { offspringCount: 0, birthEventCount: 0 };
    const [asParent, births] = await Promise.all([
      db.animals.where("farm_id").equals(farmId).toArray(),
      db.birth_records.where("mother_id").equals(animalId).toArray(),
    ]);
    const offspringCount = asParent.filter(
      (a) => !a.deleted_at && (a.father_id === animalId || a.mother_id === animalId)
    ).length;
    const birthEventCount = births.filter((b) => !b.deleted_at).length;
    return { offspringCount, birthEventCount };
  }, [farmId, animalId]);

  const weightRecords = useLiveQuery(async () => {
    const rows = await db.weight_records.where("animal_id").equals(animalId).toArray();
    return rows
      .filter((r) => !r.deleted_at)
      .sort((a, b) => (a.record_date < b.record_date ? -1 : 1));
  }, [animalId]);

  const milkRecords = useLiveQuery(async () => {
    const rows = await db.milk_records.where("animal_id").equals(animalId).toArray();
    return rows
      .filter((r) => !r.deleted_at)
      .sort((a, b) => (a.record_date < b.record_date ? -1 : 1));
  }, [animalId]);

  const timeline = useLiveQuery(async () => {
    if (!farmId) return [];

    const [milk, weight, disease, births, treatments, vaccinations] = await Promise.all([
      db.milk_records.where("animal_id").equals(animalId).toArray(),
      db.weight_records.where("animal_id").equals(animalId).toArray(),
      db.disease_records.where("animal_id").equals(animalId).toArray(),
      db.birth_records.where("mother_id").equals(animalId).toArray(),
      db.treatments.where("animal_id").equals(animalId).toArray(),
      db.vaccinations.where("animal_id").equals(animalId).toArray(),
    ]);

    const entries: TimelineEntry[] = [
      ...milk
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          table: "milk_records" as SyncableTable,
          date: r.record_date,
          editHref: `/register/milk?id=${r.id}`,
          icon: Milk,
          color: "text-primary",
          title: "ثبت شیر",
          detail: `صبح ${r.morning_milk ?? 0} — عصر ${r.evening_milk ?? 0} لیتر`,
        })),
      ...weight
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          table: "weight_records" as SyncableTable,
          date: r.record_date,
          editHref: `/register/weight?id=${r.id}`,
          icon: Weight,
          color: "text-primary",
          title: "ثبت وزن",
          detail: `${r.weight} کیلوگرم`,
        })),
      ...disease
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          table: "disease_records" as SyncableTable,
          date: r.record_date,
          editHref: `/register/disease?id=${r.id}`,
          icon: Stethoscope,
          color: "text-destructive",
          title: `بیماری: ${DISEASE_LABELS[r.disease_type] ?? r.disease_type}`,
          detail: r.description ?? undefined,
        })),
      ...births
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          table: "birth_records" as SyncableTable,
          date: r.birth_date,
          editHref: `/register/birth?id=${r.id}`,
          icon: Baby,
          color: "text-success",
          title: "زایمان",
          detail: `${toPersianDigits(r.male_offspring_count)} نر، ${toPersianDigits(r.female_offspring_count)} ماده`,
        })),
      ...treatments
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          table: "treatments" as SyncableTable,
          date: r.treatment_date,
          editHref: `/register/treatment?id=${r.id}`,
          icon: Pill,
          color: "text-success",
          title: `درمان: ${r.medication}`,
          detail: r.notes ?? undefined,
        })),
      ...vaccinations
        .filter((r) => !r.deleted_at)
        .map((r) => ({
          id: r.id,
          table: "vaccinations" as SyncableTable,
          date: r.date_given,
          editHref: `/register/vaccination?id=${r.id}`,
          icon: Syringe,
          color: "text-success",
          title: `واکسیناسیون: ${r.vaccine_name}`,
          detail: r.next_due_date ? `سررسید بعدی: ${formatJalali(r.next_due_date)}` : undefined,
        })),
    ];

    return entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [animalId, farmId]);

  const weightChartData = useMemo(
    () => (weightRecords ?? []).map((r) => ({ date: r.record_date.slice(5), value: r.weight })),
    [weightRecords]
  );
  const milkChartData = useMemo(
    () =>
      (milkRecords ?? []).map((r) => ({
        date: r.record_date.slice(5),
        value: Number(r.morning_milk ?? 0) + Number(r.evening_milk ?? 0),
      })),
    [milkRecords]
  );

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
          <div className="flex items-center gap-1">
            <Badge variant={animal.status === "active" ? "default" : "secondary"}>
              {ANIMAL_STATUS_LABELS[animal.status]}
            </Badge>
            {canEdit && (
              <Button variant="ghost" size="icon-sm" asChild aria-label="ویرایش دام">
                <Link href={`/animals/new?id=${animal.id}`}>
                  <Pencil className="size-4" />
                </Link>
              </Button>
            )}
            {canDelete && (
              <DeleteIconButton
                title="حذف دام"
                description={`آیا از حذف ${animal.ear_tag} مطمئن هستید؟ تاریخچه ثبت‌شده آن نیز از فهرست‌ها مخفی می‌شود.`}
                onDelete={async () => {
                  await softDeleteRecord("animals", animal.id);
                  router.push("/animals");
                }}
              />
            )}
          </div>
        </div>
        {animal.notes && <p className="text-sm">{animal.notes}</p>}
      </div>

      {/* General Information */}
      <Card>
        <CardHeader>
          <CardTitle>اطلاعات کلی</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <InfoRow label="پلاک گوش" value={animal.ear_tag} />
          <InfoRow label="شناسه داخلی" value={animal.id.slice(0, 8)} />
          <InfoRow label="نام" value={animal.name ?? "—"} />
          <InfoRow label="گونه" value={SPECIES_LABELS[animal.species]} />
          <InfoRow
            label="نوع"
            value={effectiveAnimalTypeLabel(animal.species, animal.gender, animal.birth_date, animal.animal_type)}
          />
          <InfoRow label="نژاد" value={animal.breed ?? "—"} />
          <InfoRow label="جنسیت" value={animal.gender === "male" ? "نر" : animal.gender === "female" ? "ماده" : "—"} />
          <InfoRow label="تاریخ تولد" value={animal.birth_date ? formatJalali(animal.birth_date) : "—"} />
          <InfoRow label="سن" value={ageLabel(animal.birth_date)} />
          <InfoRow label="وضعیت" value={ANIMAL_STATUS_LABELS[animal.status]} />
        </CardContent>
      </Card>

      {/* Family */}
      <Card>
        <CardHeader>
          <CardTitle>خانواده</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">پدر</span>
              {father ? (
                <Link href={`/animals/view?id=${father.id}`} className="text-primary">
                  {father.ear_tag}
                </Link>
              ) : (
                <span>—</span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">مادر</span>
              {mother ? (
                <Link href={`/animals/view?id=${mother.id}`} className="text-primary">
                  {mother.ear_tag}
                </Link>
              ) : (
                <span>—</span>
              )}
            </div>
            <InfoRow label="تعداد فرزندان" value={toPersianDigits(familyStats?.offspringCount ?? 0)} />
            <InfoRow label="تعداد زایمان" value={toPersianDigits(familyStats?.birthEventCount ?? 0)} />
          </div>
          <Button variant="outline" size="sm" asChild className="self-start">
            <Link href={`/animals/pedigree?id=${animal.id}`}>
              <GitBranch className="size-4" />
              مشاهده شجره‌نامه
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Performance / Analytics */}
      {weightChartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>روند رشد وزن</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => `${toPersianDigits(Number(v))} کیلوگرم`} />
                <Line type="monotone" dataKey="value" stroke="#1B5E20" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {milkChartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>روند تولید شیر</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={milkChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => `${toPersianDigits(Number(v))} لیتر`} />
                <Line type="monotone" dataKey="value" stroke="#2E7D32" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Media */}
      <Card>
        <CardHeader>
          <CardTitle>تصاویر</CardTitle>
        </CardHeader>
        <CardContent>
          <AnimalImageGallery animalId={animal.id} canEdit={canEdit} />
        </CardContent>
      </Card>

      {/* Health + everything else, chronological */}
      <div className="flex flex-col gap-2">
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
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
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
