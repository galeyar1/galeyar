"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnimalPicker } from "@/components/animal-picker";
import { AnimalMultiPicker } from "@/components/animal-multi-picker";
import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { createRecord, updateRecord } from "@/lib/sync/repository";
import { todayIso, toPersianDigits } from "@/lib/jalali";
import type { DewormingType } from "@/lib/supabase/types";

const DEWORMING_TYPE_LABELS: Record<DewormingType, string> = {
  internal: "داخلی",
  external: "خارجی",
};

function DewormingForm({ recordId }: { recordId: string | null }) {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [animalId, setAnimalId] = useState("");
  const [animalIds, setAnimalIds] = useState<string[]>([]);
  const [dewormingType, setDewormingType] = useState<DewormingType>("internal");
  const [productName, setProductName] = useState("");
  const [dateGiven, setDateGiven] = useState(todayIso());
  const [nextDueDate, setNextDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existing = useLiveQuery(() => (recordId ? db.deworming_records.get(recordId) : undefined), [recordId]);

  useEffect(() => {
    if (existing) {
      setAnimalId(existing.animal_id);
      setDewormingType(existing.deworming_type);
      setProductName(existing.product_name);
      setDateGiven(existing.date_given);
      setNextDueDate(existing.next_due_date ?? "");
      setNotes(existing.notes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  // Editing an existing record is inherently single-animal (it already
  // belongs to one animal); only a brand-new submission can be a group.
  const canSubmit = recordId ? !!animalId && productName.trim().length > 0 : animalIds.length > 0 && productName.trim().length > 0;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    const farmId = profile.farm_id;
    setSubmitting(true);
    console.log("[register/deworming] submitting", { recordId, animalId, animalIds, dewormingType, productName, dateGiven });

    const shared = {
      deworming_type: dewormingType,
      product_name: productName.trim(),
      date_given: dateGiven,
      next_due_date: nextDueDate || null,
      notes: notes || null,
    };

    try {
      if (recordId) {
        await updateRecord("deworming_records", recordId, { ...shared, animal_id: animalId });
        toast.success("ضدانگل به‌روزرسانی شد");
      } else {
        // A group identifier only matters (and is only created) for an
        // actual group submission — a single-animal record stays exactly
        // as before, with no batch concept attached.
        const treatmentBatchId = animalIds.length > 1 ? crypto.randomUUID() : null;
        await Promise.all(
          animalIds.map((id) =>
            createRecord("deworming_records", farmId, session.user.id, {
              ...shared,
              animal_id: id,
              treatment_batch_id: treatmentBatchId,
            })
          )
        );
        toast.success(
          animalIds.length > 1 ? `ضدانگل برای ${toPersianDigits(animalIds.length)} دام ثبت شد` : "ضدانگل با موفقیت ثبت شد"
        );
      }
      router.push("/register");
    } catch (error) {
      console.error("[register/deworming] failed", error);
      toast.error(error instanceof Error ? error.message : "ثبت ضدانگل با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">{recordId ? "ویرایش ضد انگل" : "ثبت ضد انگل"}</h1>

      <div className="flex flex-col gap-2">
        <label className="text-base">{recordId ? "دام *" : "انتخاب دام‌ها *"}</label>
        {recordId ? (
          <AnimalPicker farmId={profile?.farm_id} value={animalId} onChange={setAnimalId} />
        ) : (
          <AnimalMultiPicker farmId={profile?.farm_id} selectedIds={animalIds} onChange={setAnimalIds} />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">نوع</label>
        <Select value={dewormingType} onValueChange={(v) => setDewormingType(v as DewormingType)}>
          <SelectTrigger className="h-12 w-full text-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(DEWORMING_TYPE_LABELS) as DewormingType[]).map((t) => (
              <SelectItem key={t} value={t}>{DEWORMING_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">نام دارو *</label>
        <Input
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="h-12 text-lg"
          placeholder="نام محصول ضد انگل"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">تاریخ مصرف</label>
        <PersianDatePicker value={dateGiven} onChange={(iso) => setDateGiven(iso ?? todayIso())} className="h-12 text-lg" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">سررسید بعدی (اختیاری)</label>
        <PersianDatePicker value={nextDueDate} onChange={(iso) => setNextDueDate(iso ?? "")} className="h-12 text-lg" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">یادداشت</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <Button size="lg" className="h-14 text-lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
        {submitting
          ? "در حال ثبت…"
          : recordId
            ? "ذخیره تغییرات"
            : animalIds.length > 1
              ? `ثبت ضد انگل برای ${toPersianDigits(animalIds.length)} دام`
              : "ثبت ضد انگل"}
      </Button>
    </div>
  );
}

function DewormingFormInner() {
  const params = useSearchParams();
  return <DewormingForm recordId={params.get("id")} />;
}

export default function NewDewormingRecordPage() {
  return (
    <Suspense fallback={null}>
      <DewormingFormInner />
    </Suspense>
  );
}
