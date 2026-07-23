"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { AnimalPicker } from "@/components/animal-picker";
import { useAuth } from "@/lib/auth/auth-provider";
import { createRecord } from "@/lib/sync/repository";
import { todayIso } from "@/lib/jalali";

export default function NewTreatmentPage() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [animalId, setAnimalId] = useState("");
  const [medication, setMedication] = useState("");
  const [notes, setNotes] = useState("");
  const [treatmentDate, setTreatmentDate] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = animalId && medication.trim().length > 0;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);

    await createRecord("treatments", profile.farm_id, session.user.id, {
      animal_id: animalId,
      medication: medication.trim(),
      treatment_date: treatmentDate,
      notes: notes || null,
    });

    setSubmitting(false);
    toast.success("درمان با موفقیت ثبت شد");
    router.push("/register");
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">ثبت درمان</h1>

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
        {submitting ? "در حال ثبت…" : "ثبت درمان"}
      </Button>
    </div>
  );
}
