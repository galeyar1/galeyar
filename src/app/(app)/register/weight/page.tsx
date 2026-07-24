"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { AnimalPicker } from "@/components/animal-picker";
import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { createRecord, updateRecord } from "@/lib/sync/repository";
import { todayIso, toPersianDigits } from "@/lib/jalali";
import { cn } from "@/lib/utils";

const QUICK_WEIGHTS = [5, 10, 20, 35, 40, 60, 90];

function WeightForm({ recordId }: { recordId: string | null }) {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [animalId, setAnimalId] = useState("");
  const [weight, setWeight] = useState("");
  const [recordDate, setRecordDate] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);

  const existing = useLiveQuery(() => (recordId ? db.weight_records.get(recordId) : undefined), [recordId]);

  useEffect(() => {
    if (existing) {
      setAnimalId(existing.animal_id);
      setWeight(existing.weight.toString());
      setRecordDate(existing.record_date);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const canSubmit = animalId && weight !== "" && Number(weight) > 0;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);
    console.log("[register/weight] submitting", { recordId, animalId, weight, recordDate });

    const payload = {
      animal_id: animalId,
      weight: Number(weight),
      record_date: recordDate,
    };

    try {
      if (recordId) {
        await updateRecord("weight_records", recordId, payload);
        toast.success("وزن به‌روزرسانی شد");
      } else {
        await createRecord("weight_records", profile.farm_id, session.user.id, payload);
        toast.success("وزن با موفقیت ثبت شد");
      }
      router.push("/register");
    } catch (error) {
      console.error("[register/weight] failed", error);
      toast.error(error instanceof Error ? error.message : "ثبت وزن با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">{recordId ? "ویرایش وزن" : "ثبت وزن"}</h1>

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
        {submitting ? "در حال ثبت…" : recordId ? "ذخیره تغییرات" : "ثبت وزن"}
      </Button>
    </div>
  );
}

function WeightFormInner() {
  const params = useSearchParams();
  return <WeightForm recordId={params.get("id")} />;
}

export default function NewWeightRecordPage() {
  return (
    <Suspense fallback={null}>
      <WeightFormInner />
    </Suspense>
  );
}
