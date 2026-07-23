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
import { todayIso, toPersianDigits } from "@/lib/jalali";
import { cn } from "@/lib/utils";

const QUICK_WEIGHTS = [5, 10, 20, 35, 40, 60, 90];

export default function NewWeightRecordPage() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [animalId, setAnimalId] = useState("");
  const [weight, setWeight] = useState("");
  const [recordDate, setRecordDate] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = animalId && weight !== "" && Number(weight) > 0;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);

    await createRecord("weight_records", profile.farm_id, session.user.id, {
      animal_id: animalId,
      weight: Number(weight),
      record_date: recordDate,
    });

    setSubmitting(false);
    toast.success("وزن با موفقیت ثبت شد");
    router.push("/register");
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">ثبت وزن</h1>

      <div className="flex flex-col gap-2">
        <label className="text-base">دام *</label>
        <AnimalPicker farmId={profile?.farm_id} value={animalId} onChange={setAnimalId} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">تاریخ</label>
        <PersianDatePicker value={recordDate} onChange={(iso) => setRecordDate(iso ?? todayIso())} className="h-12 text-lg" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">وزن سریع (کیلوگرم)</label>
        <div className="grid grid-cols-4 gap-2">
          {QUICK_WEIGHTS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWeight(String(w))}
              className={cn(
                "flex h-14 items-center justify-center rounded-xl border border-border text-lg font-semibold",
                weight === String(w) && "border-primary bg-primary/10 text-primary"
              )}
            >
              {toPersianDigits(w)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">وزن دستی (کیلوگرم)</label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="h-14 text-xl"
          placeholder="وارد کنید"
        />
      </div>

      <Button size="lg" className="h-14 text-lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
        {submitting ? "در حال ثبت…" : "ثبت وزن"}
      </Button>
    </div>
  );
}
