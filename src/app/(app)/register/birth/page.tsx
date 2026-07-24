"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { AnimalPicker } from "@/components/animal-picker";
import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { createRecord, updateRecord } from "@/lib/sync/repository";
import { todayIso, toPersianDigits } from "@/lib/jalali";
import { juvenileAnimalType } from "@/lib/animal-labels";
import {
  GENDER_CODE,
  SPECIES_CODE,
  buildGeneratedId,
  jalaliYearSuffix,
  nextOffspringNumbers,
  offspringTitle,
} from "@/lib/offspring-id";

/** Highest offspring_number already used for this mother+year+gender, or 0 if none — so a second litter the same year keeps numbering instead of colliding. */
async function existingMaxOffspringNumber(
  farmId: string,
  motherId: string,
  birthYear: string,
  genderCode: "M" | "F"
): Promise<number> {
  const rows = await db.animals.where("farm_id").equals(farmId).toArray();
  return rows.reduce((max, r) => {
    if (
      r.deleted_at ||
      r.mother_id !== motherId ||
      r.birth_year !== birthYear ||
      r.gender_code !== genderCode ||
      !r.offspring_number
    )
      return max;
    return Math.max(max, r.offspring_number);
  }, 0);
}

function BirthForm({ recordId }: { recordId: string | null }) {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [motherId, setMotherId] = useState("");
  const [fatherId, setFatherId] = useState("");
  const [maleCount, setMaleCount] = useState("0");
  const [femaleCount, setFemaleCount] = useState("0");
  const [notes, setNotes] = useState("");
  const [birthDate, setBirthDate] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);

  const existing = useLiveQuery(() => (recordId ? db.birth_records.get(recordId) : undefined), [recordId]);
  const mother = useLiveQuery(() => (motherId ? db.animals.get(motherId) : undefined), [motherId]);

  const previewIds = useLiveQuery(async () => {
    if (recordId || !mother || !profile?.farm_id) return [];
    const maleN = Number(maleCount) || 0;
    const femaleN = Number(femaleCount) || 0;
    const birthYear = jalaliYearSuffix(birthDate);
    const items: { id: string; title: string }[] = [];
    for (const [genderCode, count, gender] of [
      [GENDER_CODE.male, maleN, "male"] as const,
      [GENDER_CODE.female, femaleN, "female"] as const,
    ]) {
      if (count === 0) continue;
      const existingMax = await existingMaxOffspringNumber(profile.farm_id, motherId, birthYear, genderCode);
      for (const n of nextOffspringNumbers(existingMax, count)) {
        items.push({
          id: buildGeneratedId(mother.species, mother.ear_tag, birthYear, genderCode, n),
          title: offspringTitle(mother.species, gender),
        });
      }
    }
    return items;
  }, [recordId, mother, motherId, profile?.farm_id, maleCount, femaleCount, birthDate]);

  useEffect(() => {
    if (existing) {
      setMotherId(existing.mother_id);
      setFatherId(existing.father_id ?? "");
      setMaleCount(String(existing.male_offspring_count));
      setFemaleCount(String(existing.female_offspring_count));
      setNotes(existing.notes ?? "");
      setBirthDate(existing.birth_date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const total = (Number(maleCount) || 0) + (Number(femaleCount) || 0);
  const canSubmit = motherId && total > 0;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);

    const maleN = Number(maleCount) || 0;
    const femaleN = Number(femaleCount) || 0;

    if (recordId) {
      await updateRecord("birth_records", recordId, {
        mother_id: motherId,
        father_id: fatherId || null,
        male_offspring_count: maleN,
        female_offspring_count: femaleN,
        birth_date: birthDate,
        notes: notes || null,
      });
      toast.success("زایمان به‌روزرسانی شد");
      setSubmitting(false);
      router.push("/register");
      return;
    }

    // Auto-create one animal record per offspring, each with an automatic
    // SPECIES-MOTHERID-YEAR-GENDER+NUMBER ID (e.g. "SH-125-05-M1") used as
    // its ear tag — the farmer can still rename it later like any ear tag.
    const generatedIds: string[] = [];
    if (mother) {
      const maleType = juvenileAnimalType(mother.species, "male");
      const femaleType = juvenileAnimalType(mother.species, "female");
      const birthYear = jalaliYearSuffix(birthDate);
      const jobs: Promise<unknown>[] = [];

      for (const [genderCode, count, gender, type] of [
        [GENDER_CODE.male, maleN, "male", maleType] as const,
        [GENDER_CODE.female, femaleN, "female", femaleType] as const,
      ]) {
        if (count === 0) continue;
        const existingMax = await existingMaxOffspringNumber(profile.farm_id, motherId, birthYear, genderCode);
        for (const offspringNumber of nextOffspringNumbers(existingMax, count)) {
          const generatedId = buildGeneratedId(mother.species, mother.ear_tag, birthYear, genderCode, offspringNumber);
          generatedIds.push(generatedId);
          jobs.push(
            createRecord("animals", profile.farm_id, session.user.id, {
              ear_tag: generatedId,
              name: null,
              species: mother.species,
              animal_type: type.value,
              breed: mother.breed,
              gender,
              birth_date: birthDate,
              father_id: fatherId || null,
              mother_id: motherId,
              status: "active",
              notes: null,
              generated_id: generatedId,
              species_code: SPECIES_CODE[mother.species],
              birth_year: birthYear,
              offspring_number: offspringNumber,
              gender_code: genderCode,
            })
          );
        }
      }
      await Promise.all(jobs);
    }

    await createRecord("birth_records", profile.farm_id, session.user.id, {
      mother_id: motherId,
      father_id: fatherId || null,
      male_offspring_count: maleN,
      female_offspring_count: femaleN,
      birth_date: birthDate,
      notes: notes || null,
      offspring_generated_ids: generatedIds,
    });

    setSubmitting(false);
    toast.success(`زایمان و ${toPersianDigits(total)} نوزاد با موفقیت ثبت شد`);
    router.push("/register");
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">{recordId ? "ویرایش زایمان" : "ثبت زایمان"}</h1>

      <div className="flex flex-col gap-2">
        <label className="text-base">مادر *</label>
        <AnimalPicker farmId={profile?.farm_id} value={motherId} onChange={setMotherId} filter="female" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">پدر (اختیاری)</label>
        <AnimalPicker farmId={profile?.farm_id} value={fatherId} onChange={setFatherId} filter="male" allowNone />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">تاریخ زایمان</label>
        <PersianDatePicker value={birthDate} onChange={(iso) => setBirthDate(iso ?? todayIso())} className="h-12 text-lg" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label className="text-base">تعداد نر</label>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={maleCount}
            onChange={(e) => setMaleCount(e.target.value)}
            className="h-14 text-center text-xl"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-base">تعداد ماده</label>
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            value={femaleCount}
            onChange={(e) => setFemaleCount(e.target.value)}
            className="h-14 text-center text-xl"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted p-3">
        <span className="text-muted-foreground">مجموع نوزادان</span>
        <span className="text-xl font-bold text-primary">{toPersianDigits(total)}</span>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">یادداشت</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      {!recordId && total > 0 && previewIds && previewIds.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl bg-muted p-3">
          <span className="text-sm text-muted-foreground">
            با ثبت، {toPersianDigits(total)} دام جدید با شناسه خودکار زیر ایجاد می‌شود (قابل ویرایش):
          </span>
          <ul className="flex flex-col gap-1">
            {previewIds.map((item) => (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="font-mono font-semibold">{item.id}</span>
                <span className="text-muted-foreground">{item.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {recordId && (
        <p className="text-sm text-muted-foreground">
          ویرایش این رکورد، دام‌های نوزادی که قبلاً ایجاد شده‌اند را تغییر نمی‌دهد.
        </p>
      )}

      <Button size="lg" className="h-14 text-lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
        {submitting ? "در حال ثبت…" : recordId ? "ذخیره تغییرات" : "ثبت زایمان"}
      </Button>
    </div>
  );
}

function BirthFormInner() {
  const params = useSearchParams();
  return <BirthForm recordId={params.get("id")} />;
}

export default function NewBirthRecordPage() {
  return (
    <Suspense fallback={null}>
      <BirthFormInner />
    </Suspense>
  );
}
