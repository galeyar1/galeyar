"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { CalendarClock, AlertTriangle, Info, ChevronLeft } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AgeGauge } from "@/components/age-gauge";
import { toPersianDigits, formatJalali, todayIso } from "@/lib/jalali";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import { analyzeHerdAgeBalance, type AgeBalanceAnimalInput } from "@/lib/age-balance/engine";
import { generateAgeBalanceAlerts, explainAgeBalance, PRIORITY_LABELS, type AlertPriority } from "@/lib/age-balance/explain";
import { analyzeIndividualRetention } from "@/lib/age-balance/retention";
import { classifyLifeStage, LIFE_STAGE_LABELS } from "@/lib/age-balance/life-stage";
import { resolveAgeProfile } from "@/lib/age-balance/profile-resolver";
import { YOUTH_INDEX_BANDS, AGE_BALANCE_BANDS } from "@/lib/age-balance/gauge-bands";
import { CONFIDENCE_LABELS, confidenceQualifier } from "@/lib/age-balance/confidence";
import { DEFAULT_MORTALITY_RATES } from "@/lib/herd-growth";

const ALERT_PRIORITY_STYLE: Record<AlertPriority, string> = {
  info: "border-border bg-muted",
  attention: "border-warning/40 bg-warning/10",
  warning: "border-destructive/40 bg-destructive/10",
  critical: "border-destructive bg-destructive/15",
};

type GrowthObjective = "maintain" | "grow" | "reduce";

export default function HerdAgeBalancePage() {
  const { profile, session } = useAuth();
  const farmId = profile?.farm_id;

  const [growthObjective, setGrowthObjective] = useState<GrowthObjective>("maintain");
  const [growthTargetPercent, setGrowthTargetPercent] = useState("");
  const [savingObjective, setSavingObjective] = useState(false);
  const [recordingSnapshot, setRecordingSnapshot] = useState(false);
  const [snapshots, setSnapshots] = useState<{ snapshot_date: string; age_balance_score: number; youth_index: number }[]>([]);
  const [expandedStage, setExpandedStage] = useState<string | null>(null);

  useEffect(() => {
    if (!farmId) return;
    supabase
      .from("farms")
      .select("herd_growth_objective, herd_growth_target_percent")
      .eq("id", farmId)
      .single()
      .then(({ data }) => {
        if (data?.herd_growth_objective) setGrowthObjective(data.herd_growth_objective as GrowthObjective);
        if (data?.herd_growth_target_percent) setGrowthTargetPercent(String(data.herd_growth_target_percent));
      });
    supabase
      .from("herd_age_snapshots")
      .select("snapshot_date, age_balance_score, youth_index")
      .eq("farm_id", farmId)
      .order("snapshot_date", { ascending: true })
      .then(({ data }) => setSnapshots(data ?? []));
  }, [farmId]);

  const rawData = useLiveQuery(async () => {
    if (!farmId) return null;
    const [animalRows, weightRows, birthRows, diseaseRows] = await Promise.all([
      db.animals.where("farm_id").equals(farmId).toArray(),
      db.weight_records.where("farm_id").equals(farmId).toArray(),
      db.birth_records.where("farm_id").equals(farmId).toArray(),
      db.disease_records.where("farm_id").equals(farmId).toArray(),
    ]);

    const active = animalRows.filter((a) => !a.deleted_at && a.status === "active");

    const latestWeightByAnimalId = new Map<string, number>();
    const latestWeightDateByAnimalId = new Map<string, string>();
    for (const w of weightRows) {
      if (w.deleted_at) continue;
      const prevDate = latestWeightDateByAnimalId.get(w.animal_id);
      if (!prevDate || w.record_date > prevDate) {
        latestWeightByAnimalId.set(w.animal_id, w.weight);
        latestWeightDateByAnimalId.set(w.animal_id, w.record_date);
      }
    }

    const birthRecordDatesByMother = new Map<string, string[]>();
    for (const b of birthRows) {
      if (b.deleted_at) continue;
      const list = birthRecordDatesByMother.get(b.mother_id) ?? [];
      list.push(b.birth_date);
      birthRecordDatesByMother.set(b.mother_id, list);
    }

    const diseaseCountByAnimalId = new Map<string, number>();
    for (const d of diseaseRows) {
      if (d.deleted_at) continue;
      diseaseCountByAnimalId.set(d.animal_id, (diseaseCountByAnimalId.get(d.animal_id) ?? 0) + 1);
    }

    const genderOf = (g: string | null): "male" | "female" | null => (g === "male" || g === "female" ? g : null);

    const animals: AgeBalanceAnimalInput[] = active.map((a) => ({
      id: a.id,
      ear_tag: a.ear_tag,
      name: a.name,
      species: a.species,
      breed: a.breed,
      gender: genderOf(a.gender),
      animal_type: a.animal_type,
      birth_date: a.birth_date,
      is_pregnant: a.is_pregnant,
    }));

    const geneticScoreByAnimalId = new Map(active.map((a) => [a.id, a.genetic_score]));

    return { animals, latestWeightByAnimalId, birthRecordDatesByMother, diseaseCountByAnimalId, geneticScoreByAnimalId };
  }, [farmId]);

  const result = useMemo(() => {
    if (!rawData) return null;
    return analyzeHerdAgeBalance({
      animals: rawData.animals,
      latestWeightByAnimalId: rawData.latestWeightByAnimalId,
      birthRecordDatesByMother: rawData.birthRecordDatesByMother,
      growthObjective,
      growthTargetPercent: growthTargetPercent ? Number(growthTargetPercent) : null,
      referenceDateIso: todayIso(),
    });
  }, [rawData, growthObjective, growthTargetPercent]);

  const alerts = useMemo(() => (result ? generateAgeBalanceAlerts(result) : []), [result]);
  const explanation = useMemo(() => (result ? explainAgeBalance(result) : ""), [result]);

  const reviewCandidates = useMemo(() => {
    if (!result || !rawData) return [];
    return result.seniorReviewAnimals.map((a) => {
      const profile = resolveAgeProfile(a.species, a.breed);
      const stage = classifyLifeStage(a.birth_date, profile);
      const offspringIds = rawData.birthRecordDatesByMother.get(a.id) ?? [];
      const analysis = analyzeIndividualRetention({
        lifeStage: stage,
        gender: a.gender,
        offspringCount: offspringIds.length,
        recentBirthOrUse: offspringIds.length > 0,
        diseaseCount: rawData.diseaseCountByAnimalId.get(a.id) ?? 0,
        geneticScore: rawData.geneticScoreByAnimalId.get(a.id) ?? null,
      });
      return { animal: a, analysis };
    });
  }, [result, rawData]);

  async function saveGrowthObjective() {
    if (!farmId) return;
    setSavingObjective(true);
    const { error } = await supabase
      .from("farms")
      .update({
        herd_growth_objective: growthObjective,
        herd_growth_target_percent: growthObjective === "grow" && growthTargetPercent ? Number(growthTargetPercent) : null,
      })
      .eq("id", farmId);
    setSavingObjective(false);
    if (error) {
      toast.error(`ذخیره هدف رشد گله ناموفق بود: ${error.message}`);
      return;
    }
    toast.success("هدف رشد گله ذخیره شد");
  }

  async function recordSnapshot() {
    if (!farmId || !session || !result || result.ageBalanceScore === null || result.youthIndex === null) return;
    setRecordingSnapshot(true);
    const { error } = await supabase.from("herd_age_snapshots").insert({
      farm_id: farmId,
      youth_index: result.youthIndex,
      age_balance_score: result.ageBalanceScore,
      replacement_coverage_percent: result.replacement.coveragePercent,
      component_scores: result.components,
      confidence: result.confidence,
      model_version: result.modelVersion,
      created_by: session.user.id,
    });
    setRecordingSnapshot(false);
    if (error) {
      toast.error(`ثبت عکس فوری ناموفق بود: ${error.message}`);
      return;
    }
    toast.success("عکس فوری وضعیت فعلی ثبت شد");
    const { data } = await supabase
      .from("herd_age_snapshots")
      .select("snapshot_date, age_balance_score, youth_index")
      .eq("farm_id", farmId)
      .order("snapshot_date", { ascending: true });
    setSnapshots(data ?? []);
  }

  if (!result) {
    return <div className="p-4 text-center text-muted-foreground">در حال بارگذاری…</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-6 text-primary" />
        <h1 className="text-xl font-bold">تعادل سنی گله</h1>
      </div>

      {result.confidence === "insufficient" ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            داده کافی برای تحلیل دقیق ساختار سنی گله وجود ندارد. برای دام‌های بیشتری تاریخ تولد ثبت کنید تا این تحلیل فعال شود.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Data quality panel — spec section 36-37 */}
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">کیفیت داده تحلیل: {toPersianDigits(result.dataQuality.qualityPercent)}٪</span>
                <Badge variant={result.confidence === "high" ? "default" : "secondary"}>
                  اطمینان: {CONFIDENCE_LABELS[result.confidence]}
                </Badge>
              </div>
              {result.dataQuality.missing.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  داده‌ی ناقص: {result.dataQuality.missing.map((m) => `${m.label} (${toPersianDigits(m.count)} دام)`).join("، ")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Gauges */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">شاخص جوانی گله</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center pb-4">
                <AgeGauge value={result.youthIndex ?? 0} bands={YOUTH_INDEX_BANDS} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">تعادل سنی</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center pb-4">
                <AgeGauge value={result.ageBalanceScore ?? 0} bands={AGE_BALANCE_BANDS} />
              </CardContent>
            </Card>
          </div>

          {/* Components */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">اجزای امتیاز تعادل سنی</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: "ساختار جمعیت مولد", value: result.components.breedingStructure },
                { label: "پوشش جایگزینی", value: result.components.replacementCoverage },
                { label: "ریسک سنی", value: result.components.ageRisk },
                { label: "پایداری تولیدمثلی", value: result.components.reproductiveSustainability },
              ].map((c) => (
                <div key={c.label} className="flex justify-between rounded-lg bg-muted p-2">
                  <span>{c.label}</span>
                  <span className="font-semibold">{c.value !== null ? toPersianDigits(c.value) : "—"}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Replacement coverage */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">پوشش جایگزینی</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between rounded-lg bg-muted p-2">
                <span>نیاز پیش‌بینی‌شده (۱۲ ماه آینده)</span>
                <span className="font-semibold">{toPersianDigits(result.replacement.replacementNeed)} رأس</span>
              </div>
              <div className="flex justify-between rounded-lg bg-muted p-2">
                <span>ماده جایگزین مناسب شناسایی‌شده</span>
                <span className="font-semibold">{toPersianDigits(result.replacement.eligibleReplacementFemales)} رأس</span>
              </div>
              {result.replacement.coveragePercent !== null ? (
                <div className="flex justify-between rounded-lg bg-primary/10 p-2 text-primary">
                  <span>پوشش</span>
                  <span className="font-bold">
                    {toPersianDigits(result.replacement.coveragePercent)}٪ — {result.replacement.coverageBand}
                  </span>
                </div>
              ) : (
                <p className="text-center text-muted-foreground">بر اساس ساختار فعلی، نیازی به جایگزینی پیش‌بینی نشده است.</p>
              )}
            </CardContent>
          </Card>

          {/* Breeding structure by species */}
          {result.breedingStructureBySpecies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">ساختار جمعیت مولد به تفکیک گونه</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                {result.breedingStructureBySpecies.map((s) => (
                  <div key={s.species} className="flex items-center justify-between rounded-lg bg-muted p-2">
                    <span>{SPECIES_LABELS[s.species]}</span>
                    <span>
                      {toPersianDigits(s.breedingMales)} نر · {toPersianDigits(s.breedingFemales)} ماده
                      {s.ratio !== null && <span className="text-muted-foreground"> (۱ به {toPersianDigits(s.ratio)})</span>}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Age distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">توزیع سنی گله</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {result.ageDistribution.map((bucket) => (
                <div key={bucket.stage} className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setExpandedStage(expandedStage === bucket.stage ? null : bucket.stage)}
                    className="flex items-center justify-between rounded-lg bg-muted p-2 text-sm"
                  >
                    <span>{LIFE_STAGE_LABELS[bucket.stage]}</span>
                    <span className="font-semibold">
                      {toPersianDigits(bucket.count)} رأس · {toPersianDigits(bucket.percent)}٪
                    </span>
                  </button>
                  {expandedStage === bucket.stage && (
                    <div className="flex flex-wrap gap-1.5 px-2">
                      {bucket.animalIds.slice(0, 30).map((id) => {
                        const a = rawData?.animals.find((x) => x.id === id);
                        return (
                          <Link
                            key={id}
                            href={`/animals/view?id=${id}`}
                            className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          >
                            {a?.ear_tag ?? id}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* AI explanation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">تحلیل هوشمند</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-7">{explanation}</p>
            </CardContent>
          </Card>

          {/* Alerts */}
          {alerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">هشدارها</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {alerts.map((a) => (
                  <div key={a.id} className={`flex flex-col gap-1 rounded-xl border p-3 ${ALERT_PRIORITY_STYLE[a.priority]}`}>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-semibold">
                        {a.priority === "info" ? <Info className="size-4" /> : <AlertTriangle className="size-4" />}
                        {a.title}
                      </span>
                      <Badge variant="secondary">{PRIORITY_LABELS[a.priority]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{a.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Animals to review — grouped, never one alert per animal */}
          {reviewCandidates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {toPersianDigits(reviewCandidates.length)} دام وارد گروه سنی نیازمند بررسی شده‌اند
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {reviewCandidates.map(({ animal, analysis }) => (
                  <Link
                    key={animal.id}
                    href={`/animals/view?id=${animal.id}`}
                    className="flex items-center justify-between rounded-lg bg-muted p-2 text-sm"
                  >
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        پلاک {animal.ear_tag}
                        {animal.name ? ` — ${animal.name}` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {SPECIES_LABELS[animal.species]}
                        {animal.breed ? ` · ${animal.breed}` : ""}
                      </span>
                    </div>
                    <Badge variant={analysis.result === "high_value" ? "default" : analysis.result === "review_recommended" ? "destructive" : "secondary"}>
                      {analysis.label}
                    </Badge>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Historical trend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">روند تعادل سنی</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {snapshots.length >= 2 ? (
                <div className="flex flex-col gap-1 text-sm">
                  {snapshots.map((s) => (
                    <div key={s.snapshot_date} className="flex justify-between rounded-lg bg-muted p-2">
                      <span>{formatJalali(s.snapshot_date)}</span>
                      <span>
                        تعادل: {toPersianDigits(s.age_balance_score)} · جوانی: {toPersianDigits(s.youth_index)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  داده کافی برای نمایش روند تاریخی وجود ندارد — با ثبت دوره‌ای عکس فوری، این روند در طول زمان شکل می‌گیرد.
                </p>
              )}
              <Button variant="outline" onClick={recordSnapshot} disabled={recordingSnapshot}>
                {recordingSnapshot ? "در حال ثبت…" : "ثبت عکس فوری وضعیت فعلی"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Farm growth objective — spec section 31/49 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">هدف رشد گله</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Select value={growthObjective} onValueChange={(v) => setGrowthObjective(v as GrowthObjective)}>
            <SelectTrigger className="h-11 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="maintain">حفظ اندازه فعلی گله</SelectItem>
              <SelectItem value="grow">افزایش اندازه گله</SelectItem>
              <SelectItem value="reduce">کاهش اندازه گله</SelectItem>
            </SelectContent>
          </Select>
          {growthObjective === "grow" && (
            <Input
              type="number"
              inputMode="numeric"
              placeholder="درصد رشد هدف (مثلاً ۲۰)"
              value={growthTargetPercent}
              onChange={(e) => setGrowthTargetPercent(e.target.value)}
              className="h-11"
            />
          )}
          <p className="text-xs text-muted-foreground">
            نرخ تلفات پیش‌فرض این مزرعه: {toPersianDigits(Math.round((DEFAULT_MORTALITY_RATES.average ?? 0.08) * 100))}٪ (قابل تنظیم در دستیار رشد گله).
          </p>
          <Button onClick={saveGrowthObjective} disabled={savingObjective} variant="outline">
            {savingObjective ? "در حال ذخیره…" : "ذخیره هدف رشد گله"}
          </Button>
        </CardContent>
      </Card>

      {result.confidence !== "high" && result.confidence !== "insufficient" && (
        <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
          <ChevronLeft className="size-3.5" />
          {confidenceQualifier(result.confidence)}برای دقت بیشتر، تاریخ تولد و وزن دام‌های بیشتری را ثبت کنید.
        </p>
      )}
    </div>
  );
}
