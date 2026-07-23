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

    const payload = {
      mother_id: motherId,
      father_id: fatherId || null,
      male_offspring_count: Number(maleCount) || 0,
      female_offspring_count: Number(femaleCount) || 0,
      birth_date: birthDate,
      notes: notes || null,
    };

    if (recordId) {
      await updateRecord("birth_records", recordId, payload);
      toast.success("زایمان به‌روزرسانی شد");
      setSubmitting(false);
      router.push("/register");
      return;
    }

    await createRecord("birth_records", profile.farm_id, session.user.id, payload);

    // Auto-create one animal record per offspring, tagged provisionally —
    // the farmer renames the ear tag later once they actually tag the animal.
    if (mother) {
      const maleType = juvenileAnimalType(mother.species, "male");
      const femaleType = juvenileAnimalType(mother.species, "female");
      const jobs: Promise<unknown>[] = [];
      for (let i = 0; i < (Number(maleCount) || 0); i++) {
        jobs.push(
          createRecord("animals", profile.farm_id, session.user.id, {
            ear_tag: `${mother.ear_tag}-${crypto.randomUUID().slice(0, 6)}`,
            name: null,
            species: mother.species,
            animal_type: maleType.value,
            breed: mother.breed,
            gender: "male",
            birth_date: birthDate,
            father_id: fatherId || null,
            mother_id: motherId,
            status: "active",
            notes: null,
          })
        );
      }
      for (let i = 0; i < (Number(femaleCount) || 0); i++) {
        jobs.push(
          createRecord("animals", profile.farm_id, session.user.id, {
            ear_tag: `${mother.ear_tag}-${crypto.randomUUID().slice(0, 6)}`,
            name: null,
            species: mother.species,
            animal_type: femaleType.value,
            breed: mother.breed,
            gender: "female",
            birth_date: birthDate,
            father_id: fatherId || null,
            mother_id: motherId,
            status: "active",
            notes: null,
          })
        );
      }
      await Promise.all(jobs);
    }

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

      {!recordId && total > 0 && (
        <p className="text-sm text-muted-foreground">
          با ثبت، {toPersianDigits(total)} دام جدید (با پلاک موقت بر پایه پلاک مادر) به‌طور خودکار در فهرست دام‌ها ایجاد می‌شود.
        </p>
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
