"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Camera } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnimalPicker } from "@/components/animal-picker";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { createRecord, updateRecord } from "@/lib/sync/repository";
import { supabase } from "@/lib/supabase/client";
import { todayIso } from "@/lib/jalali";
import { feverAlertLevel, suggestedQuarantineDays } from "@/lib/disease-alerts";
import type { DiseaseType } from "@/lib/supabase/types";

const DISEASE_LABELS: Record<DiseaseType, string> = {
  respiratory: "تنفسی",
  digestive: "گوارشی",
  fever: "تب",
  infectious: "عفونی",
  lameness: "لنگش",
  other: "سایر",
};

function DiseaseForm({ recordId }: { recordId: string | null }) {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [animalId, setAnimalId] = useState("");
  const [diseaseType, setDiseaseType] = useState<DiseaseType>("respiratory");
  const [description, setDescription] = useState("");
  const [recordDate, setRecordDate] = useState(todayIso());
  const [image, setImage] = useState<File | null>(null);
  const [bodyTemperature, setBodyTemperature] = useState("");
  const [quarantine, setQuarantine] = useState(false);
  const [quarantineUntil, setQuarantineUntil] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const existing = useLiveQuery(() => (recordId ? db.disease_records.get(recordId) : undefined), [recordId]);

  useEffect(() => {
    if (existing) {
      setAnimalId(existing.animal_id);
      setDiseaseType(existing.disease_type);
      setDescription(existing.description ?? "");
      setRecordDate(existing.record_date);
      setBodyTemperature(existing.body_temperature?.toString() ?? "");
      setQuarantine(!!existing.quarantine_until);
      setQuarantineUntil(existing.quarantine_until ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  // Suggest a quarantine end date once the farmer turns quarantine on, based
  // on the disease type — they can still override the date freely.
  useEffect(() => {
    if (!quarantine || quarantineUntil) return;
    const suggestedDays = suggestedQuarantineDays(diseaseType) ?? 14;
    const d = new Date(recordDate);
    d.setDate(d.getDate() + suggestedDays);
    setQuarantineUntil(d.toISOString().slice(0, 10));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quarantine]);

  const feverLevel = feverAlertLevel(bodyTemperature ? Number(bodyTemperature) : null);
  const canSubmit = animalId && diseaseType;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);
    console.log("[register/disease] submitting", { recordId, animalId, diseaseType, recordDate, hasImage: !!image });

    try {
      let imageUrl: string | null = existing?.image_url ?? null;
      if (image) {
        if (!navigator.onLine) {
          toast.warning("چون آفلاین هستید، عکس بارگذاری نشد؛ گزارش بدون عکس ثبت می‌شود");
        } else {
          const path = `${profile.farm_id}/${animalId}/${Date.now()}-${image.name}`;
          const { error } = await supabase.storage.from("disease-images").upload(path, image);
          if (error) {
            console.error("[register/disease] image upload failed", error);
            toast.warning("بارگذاری عکس ناموفق بود؛ گزارش بدون عکس ثبت می‌شود");
          } else {
            imageUrl = path;
          }
        }
      }

      const payload = {
        animal_id: animalId,
        disease_type: diseaseType,
        description: description || null,
        image_url: imageUrl,
        record_date: recordDate,
        body_temperature: bodyTemperature ? Number(bodyTemperature) : null,
        quarantine_until: quarantine ? quarantineUntil || null : null,
      };

      if (recordId) {
        await updateRecord("disease_records", recordId, payload);
        toast.success("بیماری به‌روزرسانی شد");
      } else {
        await createRecord("disease_records", profile.farm_id, session.user.id, payload);
        toast.success("بیماری با موفقیت ثبت شد");
      }
      router.push("/register");
    } catch (error) {
      console.error("[register/disease] failed", error);
      toast.error(error instanceof Error ? error.message : "ثبت بیماری با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">{recordId ? "ویرایش بیماری" : "ثبت بیماری"}</h1>

      <div className="flex flex-col gap-2">
        <label className="text-base">دام *</label>
        <AnimalPicker farmId={profile?.farm_id} value={animalId} onChange={setAnimalId} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">نوع بیماری *</label>
        <Select value={diseaseType} onValueChange={(v) => setDiseaseType(v as DiseaseType)}>
          <SelectTrigger className="h-12 w-full text-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DISEASE_LABELS) as DiseaseType[]).map((key) => (
              <SelectItem key={key} value={key}>
                {DISEASE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">تاریخ</label>
        <PersianDatePicker value={recordDate} onChange={(iso) => setRecordDate(iso ?? todayIso())} className="h-12 text-lg" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">دمای بدن (اختیاری، سانتی‌گراد)</label>
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="مثلاً ۳۹.۲"
          value={bodyTemperature}
          onChange={(e) => setBodyTemperature(e.target.value)}
          className="h-12 text-lg"
        />
        {feverLevel && (
          <p className={feverLevel === "emergency" ? "text-sm font-semibold text-destructive" : "text-sm text-warning"}>
            {feverLevel === "emergency" ? "هشدار اورژانسی: تب بسیار بالا" : "هشدار: تب بالاتر از حد طبیعی"}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted p-3">
        <span>قرنطینه</span>
        <Switch checked={quarantine} onCheckedChange={setQuarantine} />
      </div>
      {quarantine && (
        <div className="flex flex-col gap-2">
          <label className="text-base">پایان قرنطینه</label>
          <PersianDatePicker
            value={quarantineUntil}
            onChange={(iso) => setQuarantineUntil(iso ?? "")}
            className="h-12 text-lg"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-base">یادداشت</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">عکس (اختیاری)</label>
        <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input text-muted-foreground">
          <Camera className="size-5" />
          {image ? image.name : existing?.image_url ? "عکس قبلی موجود است — برای تغییر انتخاب کنید" : "افزودن عکس"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => setImage(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <Button size="lg" className="h-14 text-lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
        {submitting ? "در حال ثبت…" : recordId ? "ذخیره تغییرات" : "ثبت بیماری"}
      </Button>
    </div>
  );
}

function DiseaseFormInner() {
  const params = useSearchParams();
  return <DiseaseForm recordId={params.get("id")} />;
}

export default function NewDiseaseRecordPage() {
  return (
    <Suspense fallback={null}>
      <DiseaseFormInner />
    </Suspense>
  );
}
