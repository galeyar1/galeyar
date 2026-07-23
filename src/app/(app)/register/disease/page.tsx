"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { useAuth } from "@/lib/auth/auth-provider";
import { createRecord } from "@/lib/sync/repository";
import { supabase } from "@/lib/supabase/client";
import { todayIso } from "@/lib/jalali";
import type { DiseaseType } from "@/lib/supabase/types";

const DISEASE_LABELS: Record<DiseaseType, string> = {
  respiratory: "تنفسی",
  digestive: "گوارشی",
  fever: "تب",
  infectious: "عفونی",
  lameness: "لنگش",
  other: "سایر",
};

export default function NewDiseaseRecordPage() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [animalId, setAnimalId] = useState("");
  const [diseaseType, setDiseaseType] = useState<DiseaseType>("respiratory");
  const [description, setDescription] = useState("");
  const [recordDate, setRecordDate] = useState(todayIso());
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = animalId && diseaseType;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);

    let imageUrl: string | null = null;
    if (image) {
      if (!navigator.onLine) {
        toast.warning("چون آفلاین هستید، عکس بارگذاری نشد؛ گزارش بدون عکس ثبت می‌شود");
      } else {
        const path = `${profile.farm_id}/${animalId}/${Date.now()}-${image.name}`;
        const { error } = await supabase.storage.from("disease-images").upload(path, image);
        if (!error) imageUrl = path;
      }
    }

    await createRecord("disease_records", profile.farm_id, session.user.id, {
      animal_id: animalId,
      disease_type: diseaseType,
      description: description || null,
      image_url: imageUrl,
      record_date: recordDate,
    });

    setSubmitting(false);
    toast.success("بیماری با موفقیت ثبت شد");
    router.push("/register");
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">ثبت بیماری</h1>

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
        <label className="text-base">یادداشت</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">عکس (اختیاری)</label>
        <label className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input text-muted-foreground">
          <Camera className="size-5" />
          {image ? image.name : "افزودن عکس"}
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
        {submitting ? "در حال ثبت…" : "ثبت بیماری"}
      </Button>
    </div>
  );
}
