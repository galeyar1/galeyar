"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Dna, AlertTriangle } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toPersianDigits } from "@/lib/jalali";
import { bestByGender, mostOffspring, type GeneticScoreResult } from "@/lib/genetics-light";
import { inbreedingWarning } from "@/lib/pedigree-ai";
import type { PedigreeAnimal } from "@/lib/pedigree";

function GeneticScoreCard({ title, result }: { title: string; result: GeneticScoreResult | null }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-xs text-muted-foreground">{title}</span>
        {result ? (
          <>
            <Link href={`/pedigree/view?id=${result.animal.id}`} className="text-lg font-bold text-primary">
              {result.animal.ear_tag}
            </Link>
            <span className="text-xs text-muted-foreground">
              {toPersianDigits(result.offspringCount)} فرزند
              {result.diversityScore !== null ? ` · تنوع ژنتیکی ${toPersianDigits(result.diversityScore)}٪` : ""}
            </span>
          </>
        ) : (
          <span className="text-sm text-muted-foreground">داده کافی نیست</span>
        )}
      </CardContent>
    </Card>
  );
}

export default function GeneticsAssistantPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;

  const animals = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows.filter((a) => !a.deleted_at) as PedigreeAnimal[];
  }, [farmId]);

  const bestRam = useMemo(() => bestByGender(animals ?? [], "male"), [animals]);
  const bestEwe = useMemo(() => bestByGender(animals ?? [], "female"), [animals]);
  const topOffspring = useMemo(() => mostOffspring(animals ?? []), [animals]);

  const warnings = useMemo(() => {
    const list = animals ?? [];
    const byId = new Map(list.map((a) => [a.id, a]));
    const result: { animal: PedigreeAnimal; message: string }[] = [];
    for (const a of list) {
      if (!a.father_id || !a.mother_id) continue;
      const father = byId.get(a.father_id);
      const mother = byId.get(a.mother_id);
      if (!father || !mother) continue;
      const warning = inbreedingWarning(father, mother, byId);
      if (warning) result.push({ animal: a, message: warning });
    }
    return result;
  }, [animals]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Dna className="size-6 text-primary" />
        <h1 className="text-xl font-bold">دستیار هوشمند ژنتیک</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        امتیاز ژنتیکی از ترکیب تعداد فرزندان و تنوع ژنتیکی محاسبه می‌شود — یک شاخص ساده و شفاف، نه یک مدل پیچیده اصلاح نژاد.
      </p>

      <div className="grid grid-cols-1 gap-3">
        <GeneticScoreCard title="بهترین قوچ/نر" result={bestRam} />
        <GeneticScoreCard title="بهترین میش/ماده" result={bestEwe} />
        <GeneticScoreCard title="بیشترین تعداد فرزند" result={topOffspring} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" /> هشدار همخونی
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {warnings.length === 0 ? (
            <p className="text-center text-muted-foreground">موردی یافت نشد.</p>
          ) : (
            warnings.map((w) => (
              <div key={w.animal.id} className="flex flex-col gap-0.5 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                <Link href={`/pedigree/view?id=${w.animal.id}`} className="font-semibold">
                  {w.animal.ear_tag}
                </Link>
                <span>{w.message}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
