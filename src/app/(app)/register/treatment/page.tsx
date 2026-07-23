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

function TreatmentForm({ recordId }: { recordId: string | null }) {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [animalId, setAnimalId] = useState("");
  const [medication, setMedication] = useState("");
  const [notes, setNotes] = useState("");
  const [treatmentDate, setTreatmentDate] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);

  const existing = useLiveQuery(() => (recordId ? db.treatments.get(recordId) : undefined), [recordId]);

  useEffect(() => {
    if (existing) {
      setAnimalId(existing.animal_id);
      setMedication(existing.medication);
      setNotes(existing.notes ?? "");
      setTreatmentDate(existing.treatment_date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const canSubmit = animalId && medication.trim().length > 0;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);

    const payload = {
      animal_id: animalId,
      medication: medication.trim(),
      treatment_date: treatmentDate,
      notes: notes || null,
    };

    if (recordId) {
      await updateRecord("treatments", recordId, payload);
      toast.success("درمان به‌روزرسانی شد");
    } else {
      await createRecord("treatments", profile.farm_id, session.user.id, payload);
      toast.success("درمان با موفقیت ثبت شد");
    }

    setSubmitting(false);
    router.push("/register");
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">{recordId ? "ویرایش درمان" : "ثبت درمان"}</h1>

      <div className="flex flex-col gap-2">
        <label className="text-base">دام *</label>
        <AnimalPicker farmId={profile?.farm_id} value={animalId} onChange={setAnimalId} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">دارو *</label>
        <Input
          value={medication}
          onChange={(e) => setMedication(e.target.value)}
          className="h-12 text-lg"
          placeholder="نام دارو"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">تاریخ درمان</label>
        <PersianDatePicker value={treatmentDate} onChange={(iso) => setTreatmentDate(iso ?? todayIso())} className="h-12 text-lg" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">یادداشت دامپزشک</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <Button size="lg" className="h-14 text-lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
        {submitting ? "در حال ثبت…" : recordId ? "ذخیره تغییرات" : "ثبت درمان"}
      </Button>
    </div>
  );
}

function TreatmentFormInner() {
  const params = useSearchParams();
  return <TreatmentForm recordId={params.get("id")} />;
}

export default function NewTreatmentPage() {
  return (
    <Suspense fallback={null}>
      <TreatmentFormInner />
    </Suspense>
  );
}
