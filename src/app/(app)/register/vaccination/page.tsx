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
import { todayIso } from "@/lib/jalali";

function VaccinationForm({ recordId }: { recordId: string | null }) {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [animalId, setAnimalId] = useState("");
  const [vaccineName, setVaccineName] = useState("");
  const [dateGiven, setDateGiven] = useState(todayIso());
  const [nextDueDate, setNextDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existing = useLiveQuery(() => (recordId ? db.vaccinations.get(recordId) : undefined), [recordId]);

  useEffect(() => {
    if (existing) {
      setAnimalId(existing.animal_id);
      setVaccineName(existing.vaccine_name);
      setDateGiven(existing.date_given);
      setNextDueDate(existing.next_due_date ?? "");
      setNotes(existing.notes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const canSubmit = animalId && vaccineName.trim().length > 0;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);

    const payload = {
      animal_id: animalId,
      vaccine_name: vaccineName.trim(),
      date_given: dateGiven,
      next_due_date: nextDueDate || null,
      notes: notes || null,
    };

    if (recordId) {
      await updateRecord("vaccinations", recordId, payload);
      toast.success("واکسیناسیون به‌روزرسانی شد");
    } else {
      await createRecord("vaccinations", profile.farm_id, session.user.id, payload);
      toast.success("واکسیناسیون با موفقیت ثبت شد");
    }

    setSubmitting(false);
    router.push("/register");
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">{recordId ? "ویرایش واکسیناسیون" : "ثبت واکسیناسیون"}</h1>

      <div className="flex flex-col gap-2">
        <label className="text-base">دام *</label>
        <AnimalPicker farmId={profile?.farm_id} value={animalId} onChange={setAnimalId} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">نام واکسن *</label>
        <Input
          value={vaccineName}
          onChange={(e) => setVaccineName(e.target.value)}
          className="h-12 text-lg"
          placeholder="مثلاً: آنتروتوکسمی"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">تاریخ تزریق</label>
        <PersianDatePicker value={dateGiven} onChange={(iso) => setDateGiven(iso ?? todayIso())} className="h-12 text-lg" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">تاریخ سررسید بعدی (اختیاری)</label>
        <PersianDatePicker value={nextDueDate} onChange={(iso) => setNextDueDate(iso ?? "")} className="h-12 text-lg" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">یادداشت</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <Button size="lg" className="h-14 text-lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
        {submitting ? "در حال ثبت…" : recordId ? "ذخیره تغییرات" : "ثبت واکسیناسیون"}
      </Button>
    </div>
  );
}

function VaccinationFormInner() {
  const params = useSearchParams();
  return <VaccinationForm recordId={params.get("id")} />;
}

export default function NewVaccinationPage() {
  return (
    <Suspense fallback={null}>
      <VaccinationFormInner />
    </Suspense>
  );
}
