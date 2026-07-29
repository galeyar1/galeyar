"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

import { db } from "@/lib/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import { toPersianDigits } from "@/lib/jalali";
import {
  computeHerdCompositionAlert,
  isBreedingMale,
  isBreedingFemale,
  rankMaleReviewCandidates,
  type MaleReviewCandidate,
} from "@/lib/herd-alerts";
import type { PedigreeAnimal } from "@/lib/pedigree";
import type { Species } from "@/lib/supabase/types";

const MAX_CANDIDATES_SHOWN = 5;

function reviewScoreLabel(score: number | null): string {
  if (score === null) return "—";
  return `${toPersianDigits(score)}٪`;
}

function CandidateCard({
  candidate,
  onDismiss,
  onSnooze,
}: {
  candidate: MaleReviewCandidate;
  onDismiss: () => void;
  onSnooze: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <Link href={`/pedigree/view?id=${candidate.animal.id}`} className="text-lg font-semibold text-primary">
          پلاک {candidate.animal.ear_tag}
        </Link>
        <Badge variant={candidate.reviewScore !== null && candidate.reviewScore >= 60 ? "destructive" : "secondary"}>
          امتیاز بررسی: {reviewScoreLabel(candidate.reviewScore)}
        </Badge>
      </div>

      {candidate.reasons.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
          {candidate.reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">دلیل مشخصی برای بررسی این دام ثبت نشده — صرفاً به‌خاطر نسبت گله فهرست شده است.</p>
      )}

      {candidate.dataQualityNote && <p className="text-xs text-warning">{candidate.dataQualityNote}</p>}

      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
        {candidate.factors.diversityScore !== null && <span>سهم تنوع ژنتیکی: {toPersianDigits(candidate.factors.diversityScore)}٪</span>}
        {candidate.factors.geneticScore !== null && <span>امتیاز ژنتیکی: {toPersianDigits(candidate.factors.geneticScore)}</span>}
        <span>تعداد فرزند: {toPersianDigits(candidate.factors.offspringCount)}</span>
        {candidate.factors.ageYears !== null && <span>سن: {toPersianDigits(Math.round(candidate.factors.ageYears))} سال</span>}
        {candidate.factors.diseaseCount > 0 && <span>سوابق بیماری: {toPersianDigits(candidate.factors.diseaseCount)} مورد</span>}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/animals/view?id=${candidate.animal.id}`}>مشاهده دام</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/animals">شروع فرایند فروش</Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={onSnooze}>
          یادآوری بعداً
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          نادیده گرفتن پیشنهاد
        </Button>
      </div>
    </div>
  );
}

export function HerdCompositionAlert({ farmId }: { farmId: string | null | undefined }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expandedSpecies, setExpandedSpecies] = useState<Species | null>(null);
  const [comparingSpecies, setComparingSpecies] = useState<Species | null>(null);

  const data = useLiveQuery(async () => {
    if (!farmId) return null;
    const [animalRows, diseaseRows] = await Promise.all([
      db.animals.where("farm_id").equals(farmId).toArray(),
      db.disease_records.where("farm_id").equals(farmId).toArray(),
    ]);
    return {
      animals: animalRows.filter((a) => !a.deleted_at) as (PedigreeAnimal & {
        species: Species;
        animal_type: string | null;
        status: string;
        genetic_score: number | null;
        birth_date: string | null;
      })[],
      diseaseCountByAnimalId: diseaseRows.reduce((map, d) => {
        if (!d.deleted_at) map.set(d.animal_id, (map.get(d.animal_id) ?? 0) + 1);
        return map;
      }, new Map<string, number>()),
    };
  }, [farmId]);

  const alertsBySpecies = useMemo(() => {
    if (!data) return [];
    const speciesPresent = [...new Set(data.animals.filter((a) => a.status === "active").map((a) => a.species))];
    return speciesPresent
      .map((species) => ({ species, alert: computeHerdCompositionAlert(data.animals, species) }))
      .filter((x): x is { species: Species; alert: NonNullable<ReturnType<typeof computeHerdCompositionAlert>> } => x.alert !== null);
  }, [data]);

  const candidatesBySpecies = useMemo(() => {
    if (!data) return new Map<Species, MaleReviewCandidate[]>();
    const byId = new Map(data.animals.map((a) => [a.id, a as PedigreeAnimal]));
    const result = new Map<Species, MaleReviewCandidate[]>();
    for (const { species } of alertsBySpecies) {
      const males = data.animals.filter((a) => a.species === species && a.status === "active" && isBreedingMale(species, a.animal_type));
      const females = data.animals.filter((a) => a.species === species && a.status === "active" && isBreedingFemale(species, a.animal_type));
      const ranked = rankMaleReviewCandidates(males, females, byId, data.diseaseCountByAnimalId).filter(
        (c) => !dismissed.has(c.animal.id)
      );
      result.set(species, ranked);
    }
    return result;
  }, [data, alertsBySpecies, dismissed]);

  if (alertsBySpecies.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning" /> ترکیب گله نیاز به بررسی دارد
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {alertsBySpecies.map(({ species, alert }) => {
          const candidates = (candidatesBySpecies.get(species) ?? []).slice(0, MAX_CANDIDATES_SHOWN);
          const expanded = expandedSpecies === species;
          const comparing = comparingSpecies === species;
          if (candidates.length === 0) return null;

          return (
            <div key={species} className="flex flex-col gap-2 rounded-xl bg-muted p-3">
              <p className="text-sm">
                تعداد {SPECIES_LABELS[species]} نر مولد ({toPersianDigits(alert.breedingMaleCount)}) نسبت به تعداد ماده‌های مولد (
                {toPersianDigits(alert.breedingFemaleCount)}) بالا است — نسبت گله بالاتر از نیاز فعلی است.{" "}
                {toPersianDigits(candidates.length)} دام برای بررسی بیشتر شناسایی شده‌اند.
              </p>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setExpandedSpecies(expanded ? null : species)}>
                  {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  مشاهده پیشنهادها
                </Button>
                {candidates.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setComparingSpecies(comparing ? null : species)}>
                    مقایسه دام‌ها
                  </Button>
                )}
              </div>

              {expanded && (
                <div className="flex flex-col gap-2">
                  {candidates.map((c) => (
                    <CandidateCard
                      key={c.animal.id}
                      candidate={c}
                      onDismiss={() => setDismissed((prev) => new Set(prev).add(c.animal.id))}
                      onSnooze={() => setDismissed((prev) => new Set(prev).add(c.animal.id))}
                    />
                  ))}
                </div>
              )}

              {comparing && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px] text-start text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="p-2 text-start">پلاک</th>
                        <th className="p-2 text-start">امتیاز بررسی</th>
                        <th className="p-2 text-start">تنوع ژنتیکی</th>
                        <th className="p-2 text-start">فرزندان</th>
                        <th className="p-2 text-start">سوابق بیماری</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((c) => (
                        <tr key={c.animal.id} className="border-b border-border/50">
                          <td className="p-2 font-semibold">{c.animal.ear_tag}</td>
                          <td className="p-2">{reviewScoreLabel(c.reviewScore)}</td>
                          <td className="p-2">{c.factors.diversityScore !== null ? `${toPersianDigits(c.factors.diversityScore)}٪` : "—"}</td>
                          <td className="p-2">{toPersianDigits(c.factors.offspringCount)}</td>
                          <td className="p-2">{toPersianDigits(c.factors.diseaseCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
