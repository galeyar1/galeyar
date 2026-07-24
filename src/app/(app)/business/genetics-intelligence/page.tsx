"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Dna, AlertTriangle, Sparkles } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { updateRecord } from "@/lib/sync/repository";
import { AnimalPicker } from "@/components/animal-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toPersianDigits } from "@/lib/jalali";
import {
  GENETIC_STATE_LABELS,
  GENETICS_SOURCE_LABELS,
  geneticScore as genotypeScore,
  predictOffspringGenetics,
  computeAiAccuracy,
  type GeneticState,
} from "@/lib/genetics-prediction";
import { offspringCount } from "@/lib/genetics-light";
import { commonAncestors, inbreedingWarning } from "@/lib/pedigree-ai";
import { computePedigreeFarmStats } from "@/lib/pedigree-stats";
import { DEFAULT_SHEEP_TWIN_RATES } from "@/lib/herd-growth";
import type { PedigreeAnimal } from "@/lib/pedigree";

const MIXED_BREED_STATES: GeneticState[] = ["romanov_asaf", "shall", "shall_romanov", "lacaune", "afshari", "other"];

interface GeneticsAnimal extends PedigreeAnimal {
  predicted_genetics: string | null;
  confirmed_genetics: string | null;
  genetic_score: number | null;
}

function effectiveGenetics(a: GeneticsAnimal): GeneticState {
  return ((a.confirmed_genetics ?? a.predicted_genetics ?? "unknown") as GeneticState) || "unknown";
}

function GeneticsOverrideEditor({ farmId }: { farmId: string }) {
  const { session } = useAuth();
  const [animalId, setAnimalId] = useState("");
  const [confirmedValue, setConfirmedValue] = useState<GeneticState>("homozygous");
  const [saving, setSaving] = useState(false);

  const animal = useLiveQuery(() => (animalId ? db.animals.get(animalId) : undefined), [animalId]);

  async function save() {
    if (!animal || !session) return;
    setSaving(true);
    try {
      const previousConfirmed = animal.confirmed_genetics ?? null;
      await updateRecord("animals", animal.id, {
        confirmed_genetics: confirmedValue,
        genetics_source: "user_edited",
        genetic_score: genotypeScore(confirmedValue),
      });
      if (navigator.onLine) {
        const { error } = await supabase.from("genetics_history").insert({
          farm_id: farmId,
          animal_id: animal.id,
          previous_confirmed: previousConfirmed,
          new_confirmed: confirmedValue,
          source: "user_edited",
          changed_by: session.user.id,
        });
        if (error) console.error("[genetics-intelligence] history log failed", error);
      }
      toast.success("ژنتیک دام به‌روزرسانی شد");
      setAnimalId("");
    } catch (error) {
      console.error("[genetics-intelligence] override failed", error);
      toast.error(error instanceof Error ? error.message : "به‌روزرسانی ژنتیک با خطا مواجه شد.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ویرایش دستی ژنتیک</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <AnimalPicker farmId={farmId} value={animalId} onChange={setAnimalId} />
        {animal && (
          <>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center text-sm">
              <div>
                <div className="text-xs text-muted-foreground">پیش‌بینی</div>
                <div className="font-semibold">
                  {animal.predicted_genetics ? GENETIC_STATE_LABELS[animal.predicted_genetics as GeneticState] : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">تأییدشده</div>
                <div className="font-semibold">
                  {animal.confirmed_genetics ? GENETIC_STATE_LABELS[animal.confirmed_genetics as GeneticState] : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">منبع</div>
                <div className="font-semibold">
                  {animal.genetics_source ? GENETICS_SOURCE_LABELS[animal.genetics_source as keyof typeof GENETICS_SOURCE_LABELS] : "—"}
                </div>
              </div>
            </div>
            <Select value={confirmedValue} onValueChange={(v) => setConfirmedValue(v as GeneticState)}>
              <SelectTrigger className="h-12 w-full text-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(GENETIC_STATE_LABELS) as GeneticState[]).map((s) => (
                  <SelectItem key={s} value={s}>{GENETIC_STATE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={save} disabled={saving}>
              {saving ? "در حال ذخیره…" : "به‌روزرسانی ژنتیک"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function GeneticIntelligencePage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;

  const animals = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows.filter((a) => !a.deleted_at) as unknown as GeneticsAnimal[];
  }, [farmId]);

  const active = useMemo(() => (animals ?? []).filter((a) => a.status === "active"), [animals]);

  const report = useMemo(() => {
    const counts: Record<string, number> = { homozygous: 0, heterozygous: 0, local: 0, romanov: 0, mixed: 0, unknown: 0 };
    for (const a of active) {
      const state = effectiveGenetics(a);
      if (state === "homozygous") counts.homozygous += 1;
      else if (state === "heterozygous") counts.heterozygous += 1;
      else if (state === "local") counts.local += 1;
      else if (state === "romanov") counts.romanov += 1;
      else if (MIXED_BREED_STATES.includes(state)) counts.mixed += 1;
      else counts.unknown += 1;
    }
    return counts;
  }, [active]);

  const bestRam = useMemo(
    () =>
      active
        .filter((a) => a.gender === "male" && a.genetic_score !== null)
        .sort((a, b) => (b.genetic_score ?? 0) - (a.genetic_score ?? 0))[0] ?? null,
    [active]
  );
  const bestEwe = useMemo(
    () =>
      active
        .filter((a) => a.gender === "female" && a.genetic_score !== null)
        .sort((a, b) => (b.genetic_score ?? 0) - (a.genetic_score ?? 0))[0] ?? null,
    [active]
  );

  const highestOffspring = useMemo(() => {
    if (active.length === 0) return null;
    return [...active].sort((a, b) => offspringCount(b.id, active) - offspringCount(a.id, active))[0];
  }, [active]);

  const highestHmProducer = useMemo(() => {
    if (active.length === 0) return null;
    const hmOffspringCount = (id: string) =>
      active.filter((a) => (a.father_id === id || a.mother_id === id) && effectiveGenetics(a) === "homozygous").length;
    const ranked = [...active].map((a) => ({ animal: a, count: hmOffspringCount(a.id) })).sort((a, b) => b.count - a.count);
    return ranked[0]?.count > 0 ? ranked[0] : null;
  }, [active]);

  const pedigreeStats = useMemo(() => computePedigreeFarmStats(active as PedigreeAnimal[]), [active]);

  const accuracy = useMemo(
    () =>
      computeAiAccuracy(
        (animals ?? []).map((a) => ({
          predicted_genetics: a.predicted_genetics as GeneticState | null,
          confirmed_genetics: a.confirmed_genetics as GeneticState | null,
        }))
      ),
    [animals]
  );

  const inbreedingWarnings = useMemo(() => {
    const byId = new Map(active.map((a) => [a.id, a as PedigreeAnimal]));
    const warnings: { animal: GeneticsAnimal; message: string; relation: string }[] = [];
    for (const a of active) {
      if (!a.father_id || !a.mother_id) continue;
      const father = byId.get(a.father_id);
      const mother = byId.get(a.mother_id);
      if (!father || !mother) continue;
      const warning = inbreedingWarning(father, mother, byId);
      if (!warning) continue;
      const shared = commonAncestors(father.id, mother.id, byId);
      const closest = Math.min(...shared.map((s) => Math.max(s.depthA, s.depthB)));
      const relation = closest === 1 ? "پدر/مادر مشترک" : closest === 2 ? "پدربزرگ/مادربزرگ مشترک" : "جد مشترک";
      warnings.push({ animal: a, message: warning, relation });
    }
    return warnings;
  }, [active]);

  const breedingRecommendation = useMemo(() => {
    if (!bestRam) return null;
    const ramState = effectiveGenetics(bestRam);
    const eligibleEwes = active.filter((a) => a.gender === "female" && effectiveGenetics(a) === "heterozygous");
    if (ramState !== "homozygous" || eligibleEwes.length === 0) return null;
    const distribution = predictOffspringGenetics("homozygous", "heterozygous");
    const hmPercent = distribution ? Math.round((distribution.homozygous ?? 0) * 100) : null;
    return {
      ramEarTag: bestRam.ear_tag,
      eweCount: eligibleEwes.length,
      twinRate: DEFAULT_SHEEP_TWIN_RATES["محلی"] ?? 1.3,
      hmPercent,
    };
  }, [bestRam, active]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Dna className="size-6 text-primary" />
        <h1 className="text-xl font-bold">هوش ژنتیکی گله‌یار</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-primary">{bestRam?.ear_tag ?? "—"}</div>
            <div className="text-xs text-muted-foreground">بهترین قوچ</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-primary">{bestEwe?.ear_tag ?? "—"}</div>
            <div className="text-xs text-muted-foreground">بهترین میش</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-primary">
              {pedigreeStats.largestBloodline?.rootEarTag ?? "—"}
            </div>
            <div className="text-xs text-muted-foreground">بهترین دودمان</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-primary">
              {accuracy.accuracyPercent !== null ? `${toPersianDigits(accuracy.accuracyPercent)}٪` : "—"}
            </div>
            <div className="text-xs text-muted-foreground">دقت پیش‌بینی هوش مصنوعی</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-primary">{toPersianDigits(report.homozygous)}</div>
            <div className="text-xs text-muted-foreground">تعداد هموزیگوت (HM)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-primary">{toPersianDigits(report.heterozygous)}</div>
            <div className="text-xs text-muted-foreground">تعداد هتروزیگوت (H)</div>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardContent className={`p-4 text-center ${inbreedingWarnings.length > 0 ? "text-destructive" : ""}`}>
            <div className="text-lg font-bold">{toPersianDigits(inbreedingWarnings.length)}</div>
            <div className="text-xs">هشدار همخونی</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>گزارش ژنتیکی گله</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between rounded-lg bg-muted p-2"><span>هموزیگوت (HM)</span><span className="font-semibold">{toPersianDigits(report.homozygous)}</span></div>
          <div className="flex justify-between rounded-lg bg-muted p-2"><span>هتروزیگوت (H)</span><span className="font-semibold">{toPersianDigits(report.heterozygous)}</span></div>
          <div className="flex justify-between rounded-lg bg-muted p-2"><span>محلی</span><span className="font-semibold">{toPersianDigits(report.local)}</span></div>
          <div className="flex justify-between rounded-lg bg-muted p-2"><span>رومانوف</span><span className="font-semibold">{toPersianDigits(report.romanov)}</span></div>
          <div className="flex justify-between rounded-lg bg-muted p-2"><span>نژادهای ترکیبی</span><span className="font-semibold">{toPersianDigits(report.mixed)}</span></div>
          <div className="flex justify-between rounded-lg bg-muted p-2"><span>نامشخص</span><span className="font-semibold">{toPersianDigits(report.unknown)}</span></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>دام‌های برتر</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {highestOffspring && (
            <div className="flex justify-between rounded-lg bg-muted p-2">
              <span>بیشترین تعداد فرزند</span>
              <Link href={`/pedigree/view?id=${highestOffspring.id}`} className="font-semibold text-primary">
                {highestOffspring.ear_tag} ({toPersianDigits(offspringCount(highestOffspring.id, active))} فرزند)
              </Link>
            </div>
          )}
          {highestHmProducer && (
            <div className="flex justify-between rounded-lg bg-muted p-2">
              <span>بیشترین تولید HM</span>
              <Link href={`/pedigree/view?id=${highestHmProducer.animal.id}`} className="font-semibold text-primary">
                {highestHmProducer.animal.ear_tag} ({toPersianDigits(highestHmProducer.count)} فرزند HM)
              </Link>
            </div>
          )}
          {!highestOffspring && !highestHmProducer && (
            <p className="text-center text-muted-foreground">داده کافی نیست.</p>
          )}
        </CardContent>
      </Card>

      {breedingRecommendation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> پیشنهاد جفت‌گیری
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p>
              از <strong className="text-primary">{breedingRecommendation.ramEarTag}</strong> با{" "}
              {toPersianDigits(breedingRecommendation.eweCount)} میش هتروزیگوت استفاده کنید.
            </p>
            <p>نرخ دوقلوزایی پیش‌بینی‌شده: {toPersianDigits(breedingRecommendation.twinRate)}</p>
            {breedingRecommendation.hmPercent !== null && (
              <p>نوزادان پیش‌بینی‌شده HM: {toPersianDigits(breedingRecommendation.hmPercent)}٪</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" /> هشدار همخونی
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {inbreedingWarnings.length === 0 ? (
            <p className="text-center text-muted-foreground">موردی یافت نشد.</p>
          ) : (
            inbreedingWarnings.map((w) => (
              <div key={w.animal.id} className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
                <Link href={`/pedigree/view?id=${w.animal.id}`} className="font-semibold">{w.animal.ear_tag}</Link>
                : {w.relation} — {w.message}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {farmId && <GeneticsOverrideEditor farmId={farmId} />}
    </div>
  );
}
