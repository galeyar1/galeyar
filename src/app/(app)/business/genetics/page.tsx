"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Dna, AlertTriangle } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toPersianDigits } from "@/lib/jalali";
import { growthScore, fertilityScore, healthScore, geneticsScore, buildAdvancedProfile, type AdvancedGeneticProfile } from "@/lib/genetics-advanced";
import { recommendedMates, inbreedingWarning } from "@/lib/pedigree-ai";
import { computePedigreeFarmStats } from "@/lib/pedigree-stats";
import type { PedigreeAnimal } from "@/lib/pedigree";

interface ScoredAnimal {
  animal: PedigreeAnimal;
  profile: AdvancedGeneticProfile;
}

function ProfileCard({ title, scored }: { title: string; scored: ScoredAnimal | null }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {scored ? (
          <div className="flex flex-col gap-2">
            <Link href={`/pedigree/view?id=${scored.animal.id}`} className="text-lg font-bold text-primary">
              {scored.animal.ear_tag}
            </Link>
            <div className="grid grid-cols-5 gap-1 text-center text-xs">
              <div><div className="font-bold">{toPersianDigits(scored.profile.genetics)}</div>ژنتیک</div>
              <div><div className="font-bold">{toPersianDigits(scored.profile.growth)}</div>رشد</div>
              <div><div className="font-bold">{toPersianDigits(scored.profile.fertility)}</div>باروری</div>
              <div><div className="font-bold">{toPersianDigits(scored.profile.health)}</div>سلامت</div>
              <div><div className="font-bold text-primary">{toPersianDigits(scored.profile.overall)}</div>کلی</div>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">داده کافی نیست.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdvancedGeneticsPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;

  const data = useLiveQuery(async () => {
    if (!farmId) return null;
    const [animals, weights, births, diseases] = await Promise.all([
      db.animals.where("farm_id").equals(farmId).toArray(),
      db.weight_records.where("farm_id").equals(farmId).toArray(),
      db.birth_records.where("farm_id").equals(farmId).toArray(),
      db.disease_records.where("farm_id").equals(farmId).toArray(),
    ]);

    const live = animals.filter((a) => !a.deleted_at) as PedigreeAnimal[];
    const weightsByAnimal = new Map<string, { weight: number; record_date: string }[]>();
    for (const w of weights) {
      if (w.deleted_at) continue;
      const list = weightsByAnimal.get(w.animal_id) ?? [];
      list.push({ weight: w.weight, record_date: w.record_date });
      weightsByAnimal.set(w.animal_id, list);
    }
    const birthCountByMother = new Map<string, number>();
    for (const b of births) {
      if (b.deleted_at) continue;
      birthCountByMother.set(b.mother_id, (birthCountByMother.get(b.mother_id) ?? 0) + 1);
    }
    const diseaseCountByAnimal = new Map<string, number>();
    for (const d of diseases) {
      if (d.deleted_at) continue;
      diseaseCountByAnimal.set(d.animal_id, (diseaseCountByAnimal.get(d.animal_id) ?? 0) + 1);
    }

    const scored: ScoredAnimal[] = live
      .filter((a) => a.status !== "dead")
      .map((a) => {
        const profile = buildAdvancedProfile({
          genetics: geneticsScore(a, live),
          growth: growthScore(weightsByAnimal.get(a.id) ?? []),
          fertility: fertilityScore(birthCountByMother.get(a.id) ?? 0),
          health: healthScore(diseaseCountByAnimal.get(a.id) ?? 0),
        });
        return { animal: a, profile };
      });

    const bestRam = scored.filter((s) => s.animal.gender === "male").sort((a, b) => b.profile.overall - a.profile.overall)[0] ?? null;
    const bestEwe = scored.filter((s) => s.animal.gender === "female").sort((a, b) => b.profile.overall - a.profile.overall)[0] ?? null;

    const pedigreeStats = computePedigreeFarmStats(live);

    const byId = new Map(live.map((a) => [a.id, a]));
    const warnings: { animal: PedigreeAnimal; message: string }[] = [];
    for (const a of live) {
      if (!a.father_id || !a.mother_id) continue;
      const father = byId.get(a.father_id);
      const mother = byId.get(a.mother_id);
      if (!father || !mother) continue;
      const warning = inbreedingWarning(father, mother, byId);
      if (warning) warnings.push({ animal: a, message: warning });
    }

    const bestRamCandidates = live.filter((a) => a.gender === "female");
    const recommendedForBestRam = bestRam ? recommendedMates(bestRam.animal, bestRamCandidates, byId) : [];

    return { bestRam, bestEwe, pedigreeStats, warnings, recommendedForBestRam };
  }, [farmId]);

  const warnings = useMemo(() => data?.warnings ?? [], [data]);

  if (!data) {
    return <p className="p-4 text-center text-muted-foreground">در حال بارگذاری…</p>;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Dna className="size-6 text-primary" />
        <h1 className="text-xl font-bold">هوش ژنتیکی پیشرفته</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        هر امتیاز از ۰ تا ۱۰۰ است و از داده‌های واقعی ثبت‌شده (وزن، زایمان، بیماری، شجره‌نامه) محاسبه می‌شود.
      </p>

      <ProfileCard title="بهترین قوچ/نر" scored={data.bestRam} />
      <ProfileCard title="بهترین میش/ماده" scored={data.bestEwe} />

      <Card>
        <CardHeader><CardTitle>بهترین دودمان</CardTitle></CardHeader>
        <CardContent>
          {data.pedigreeStats.largestBloodline ? (
            <p>
              <strong className="text-primary">{data.pedigreeStats.largestBloodline.rootEarTag}</strong> با{" "}
              {toPersianDigits(data.pedigreeStats.largestBloodline.descendantCount)} نسل ثبت‌شده
            </p>
          ) : (
            <p className="text-muted-foreground">داده کافی نیست.</p>
          )}
        </CardContent>
      </Card>

      {data.recommendedForBestRam.length > 0 && data.bestRam && (
        <Card>
          <CardHeader><CardTitle>جفت‌گیری پیشنهادی برای {data.bestRam.animal.ear_tag}</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {data.recommendedForBestRam.map((m) => (
              <div key={m.animal.id} className="flex justify-between text-sm">
                <Link href={`/pedigree/view?id=${m.animal.id}`} className="text-primary">{m.animal.ear_tag}</Link>
                <span className="text-muted-foreground">ضریب همخونی {toPersianDigits(Math.round(m.coefficient * 100))}٪</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="size-4 text-destructive" /> هشدار همخونی</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {warnings.length === 0 ? (
            <p className="text-center text-muted-foreground">موردی یافت نشد.</p>
          ) : (
            warnings.map((w) => (
              <div key={w.animal.id} className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                <Link href={`/pedigree/view?id=${w.animal.id}`} className="font-semibold">{w.animal.ear_tag}</Link>: {w.message}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
