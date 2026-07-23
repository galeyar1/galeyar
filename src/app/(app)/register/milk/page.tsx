"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { AnimalPicker } from "@/components/animal-picker";
import { useAuth } from "@/lib/auth/auth-provider";
import { createRecord } from "@/lib/sync/repository";
import { todayIso } from "@/lib/jalali";

export default function NewMilkRecordPage() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [animalId, setAnimalId] = useState("");
  const [morning, setMorning] = useState("");
  const [evening, setEvening] = useState("");
  const [recordDate, setRecordDate] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = animalId && (morning !== "" || evening !== "");

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);

    await createRecord("milk_records", profile.farm_id, session.user.id, {
      animal_id: animalId,
      morning_milk: morning === "" ? null : Number(morning),
      evening_milk: evening === "" ? null : Number(evening),
      record_date: recordDate,
    });

    setSubmitting(false);
    toast.success("شیر با موفقیت ثبت شد");
    router.push("/register");
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">ثبت شیر</h1>

      <div className="flex flex-col gap-2">
        <label className="text-base">دام *</label>
        <AnimalPicker farmId={profile?.farm_id} value={animalId} onChange={setAnimalId} filter="female" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">تاریخ</label>
        <PersianDatePicker value={recordDate} onChange={(iso) => setRecordDate(iso ?? todayIso())} className="h-12 text-lg" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">شیر صبح (لیتر)</label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={morning}
          onChange={(e) => setMorning(e.target.value)}
          className="h-14 text-xl"
          placeholder="۰"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">شیر عصر (لیتر)</label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={evening}
          onChange={(e) => setEvening(e.target.value)}
          className="h-14 text-xl"
          placeholder="۰"
        />
      </div>

      <Button size="lg" className="h-14 text-lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
        {submitting ? "در حال ثبت…" : "ثبت شیر"}
      </Button>
    </div>
  );
}
