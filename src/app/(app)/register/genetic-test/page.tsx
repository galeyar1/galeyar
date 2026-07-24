"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AnimalPicker } from "@/components/animal-picker";
import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { createRecord, updateRecord } from "@/lib/sync/repository";
import { todayIso } from "@/lib/jalali";
import { GENETIC_STATE_LABELS, type GeneticState, geneticScore } from "@/lib/genetics-prediction";

function GeneticTestForm({ recordId }: { recordId: string | null }) {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [animalId, setAnimalId] = useState("");
  const [labName, setLabName] = useState("");
  const [testDate, setTestDate] = useState(todayIso());
  const [result, setResult] = useState<GeneticState>("homozygous");
  const [notes, setNotes] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [applyToAnimal, setApplyToAnimal] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const existing = useLiveQuery(() => (recordId ? db.genetic_tests.get(recordId) : undefined), [recordId]);

  useEffect(() => {
    if (existing) {
      setAnimalId(existing.animal_id);
      setLabName(existing.laboratory_name);
      setTestDate(existing.test_date);
      setResult(existing.result as GeneticState);
      setNotes(existing.notes ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const canSubmit = animalId && labName.trim().length > 0;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);
    console.log("[register/genetic-test] submitting", { recordId, animalId, labName, result });

    try {
      let attachmentUrl: string | null = existing?.attachment_url ?? null;
      if (attachment) {
        if (!navigator.onLine) {
          toast.warning("چون آفلاین هستید، فایل پیوست بارگذاری نشد؛ آزمایش بدون پیوست ثبت می‌شود");
        } else {
          const path = `${profile.farm_id}/${animalId}/${Date.now()}-${attachment.name}`;
          const { error } = await supabase.storage.from("genetic-test-attachments").upload(path, attachment);
          if (error) {
            console.error("[register/genetic-test] attachment upload failed", error);
            toast.warning("بارگذاری فایل ناموفق بود؛ آزمایش بدون پیوست ثبت می‌شود");
          } else {
            attachmentUrl = path;
          }
        }
      }

      const payload = {
        animal_id: animalId,
        laboratory_name: labName.trim(),
        test_date: testDate,
        result,
        attachment_url: attachmentUrl,
        notes: notes || null,
      };

      if (recordId) {
        await updateRecord("genetic_tests", recordId, payload);
        toast.success("آزمایش ژنتیک به‌روزرسانی شد");
      } else {
        await createRecord("genetic_tests", profile.farm_id, session.user.id, payload);
        toast.success("آزمایش ژنتیک با موفقیت ثبت شد");
      }

      if (applyToAnimal) {
        const animal = await db.animals.get(animalId);
        const previousConfirmed = animal?.confirmed_genetics ?? null;
        await updateRecord("animals", animalId, {
          confirmed_genetics: result,
          genetics_source: "lab_confirmed",
          genetic_score: geneticScore(result),
        });
        // Best-effort audit log — same online-only trade-off as support
        // ticket messages; the confirmed_genetics update above is already
        // safely queued for offline sync regardless of whether this succeeds.
        if (navigator.onLine) {
          const { error: historyError } = await supabase.from("genetics_history").insert({
            farm_id: profile.farm_id,
            animal_id: animalId,
            previous_confirmed: previousConfirmed,
            new_confirmed: result,
            source: "lab_confirmed",
            changed_by: session.user.id,
          });
          if (historyError) console.error("[register/genetic-test] history log failed", historyError);
        }
        toast.success("ژنتیک دام بر اساس نتیجه آزمایشگاه به‌روزرسانی شد");
      }

      router.push("/register");
    } catch (error) {
      console.error("[register/genetic-test] failed", error);
      toast.error(error instanceof Error ? error.message : "ثبت آزمایش ژنتیک با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-5 text-primary" />
        <h1 className="text-xl font-bold">{recordId ? "ویرایش آزمایش ژنتیک" : "ثبت آزمایش ژنتیک"}</h1>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">دام *</label>
        <AnimalPicker farmId={profile?.farm_id} value={animalId} onChange={setAnimalId} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">نام آزمایشگاه *</label>
        <Input value={labName} onChange={(e) => setLabName(e.target.value)} className="h-12 text-lg" placeholder="مثلاً: آزمایشگاه ژنتیک دامی ایران" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">تاریخ آزمایش</label>
        <PersianDatePicker value={testDate} onChange={(iso) => setTestDate(iso ?? todayIso())} className="h-12 text-lg" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">نتیجه</label>
        <Select value={result} onValueChange={(v) => setResult(v as GeneticState)}>
          <SelectTrigger className="h-12 w-full text-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(GENETIC_STATE_LABELS) as GeneticState[]).map((s) => (
              <SelectItem key={s} value={s}>{GENETIC_STATE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input text-muted-foreground">
        {attachment ? attachment.name : "پیوست گواهی ژنتیک، آزمایش خون یا PDF (اختیاری)"}
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="flex flex-col gap-2">
        <label className="text-base">یادداشت</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted p-3">
        <span>به‌روزرسانی ژنتیک تأییدشده دام با این نتیجه</span>
        <Switch checked={applyToAnimal} onCheckedChange={setApplyToAnimal} />
      </div>

      <Button size="lg" className="h-14 text-lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
        {submitting ? "در حال ثبت…" : recordId ? "ذخیره تغییرات" : "ثبت آزمایش"}
      </Button>
    </div>
  );
}

function GeneticTestFormInner() {
  const params = useSearchParams();
  return <GeneticTestForm recordId={params.get("id")} />;
}

export default function NewGeneticTestPage() {
  return (
    <Suspense fallback={null}>
      <GeneticTestFormInner />
    </Suspense>
  );
}
