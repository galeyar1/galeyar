"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { todayIso } from "@/lib/jalali";

export default function NewBirthRecordPage() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [motherId, setMotherId] = useState("");
  const [fatherId, setFatherId] = useState("");
  const [offspringCount, setOffspringCount] = useState("1");
  const [gender, setGender] = useState("mixed");
  const [notes, setNotes] = useState("");
  const [birthDate, setBirthDate] = useState(todayIso());
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = motherId && Number(offspringCount) > 0;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);

    await createRecord("birth_records", profile.farm_id, session.user.id, {
      mother_id: motherId,
      father_id: fatherId || null,
      offspring_count: Number(offspringCount),
      gender,
      birth_date: birthDate,
      notes: notes || null,
    });

    setSubmitting(false);
    toast.success("زایمان با موفقیت ثبت شد");
    router.push("/register");
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">ثبت زایمان</h1>

      <div className="flex flex-col gap-2">
        <label className="text-base">مادر *</label>
        <AnimalPicker farmId={profile?.farm_id} value={motherId} onChange={setMotherId} filter="female" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">پدر (اختیاری)</label>
        <AnimalPicker farmId={profile?.farm_id} value={fatherId} onChange={setFatherId} filter="male" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">تاریخ زایمان</label>
        <PersianDatePicker value={birthDate} onChange={(iso) => setBirthDate(iso ?? todayIso())} className="h-12 text-lg" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">تعداد نوزاد *</label>
        <Input
          type="number"
          inputMode="numeric"
          min="1"
          value={offspringCount}
          onChange={(e) => setOffspringCount(e.target.value)}
          className="h-14 text-xl"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">جنسیت نوزاد(ان)</label>
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger className="h-12 w-full text-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">نر</SelectItem>
            <SelectItem value="female">ماده</SelectItem>
            <SelectItem value="mixed">مختلط</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-base">یادداشت</label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <Button size="lg" className="h-14 text-lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
        {submitting ? "در حال ثبت…" : "ثبت زایمان"}
      </Button>
    </div>
  );
}
