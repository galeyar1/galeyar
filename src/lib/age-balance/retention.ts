import type { LifeStage } from "@/lib/age-balance/species-profiles";

/**
 * Individual Retention Analysis (spec sections 28-29). Deliberately never
 * produces a "should be removed" verdict — the strongest possible signal
 * is "نیازمند بررسی" (review recommended), always a human decision from
 * there. Age/life-stage is context only; the actual verdict is driven by
 * recorded health and reproductive performance, so an old-but-productive
 * animal and a young-but-struggling one are judged on their own record,
 * not their birth date.
 */

export type RetentionResult = "high_value" | "review_recommended" | "insufficient_data";

const SENIOR_STAGES: LifeStage[] = ["senior_breeding", "senior_monitoring"];
const BREEDING_AGE_STAGES: LifeStage[] = ["young_breeding", "mature_breeding", "senior_breeding", "senior_monitoring"];

export interface RetentionInput {
  lifeStage: LifeStage | null;
  gender: "male" | "female" | null;
  offspringCount: number;
  recentBirthOrUse: boolean;
  diseaseCount: number;
  geneticScore: number | null;
}

export interface RetentionAnalysis {
  result: RetentionResult;
  label: string;
  reasons: string[];
}

export function analyzeIndividualRetention(input: RetentionInput): RetentionAnalysis {
  const { lifeStage, offspringCount, recentBirthOrUse, diseaseCount, geneticScore } = input;

  const hasAnySignal = lifeStage !== null || offspringCount > 0 || diseaseCount > 0 || geneticScore !== null;
  if (!hasAnySignal) {
    return { result: "insufficient_data", label: "داده ناکافی", reasons: ["داده کافی برای ارزیابی این دام ثبت نشده است."] };
  }

  const reasons: string[] = [];
  let concernSignals = 0;

  if (diseaseCount >= 2) {
    concernSignals += 1;
    reasons.push("سوابق سلامت ثبت‌شده تکرارشونده است.");
  }

  const atBreedingAge = lifeStage !== null && BREEDING_AGE_STAGES.includes(lifeStage) && lifeStage !== "young_breeding";
  if (atBreedingAge && offspringCount === 0 && !recentBirthOrUse) {
    concernSignals += 1;
    reasons.push("با وجود سن مولدی، سابقه تولیدمثلی موفقی ثبت نشده است.");
  }

  if (geneticScore !== null && geneticScore < 30) {
    concernSignals += 1;
    reasons.push("امتیاز ژنتیکی ثبت‌شده پایین است.");
  }

  if (concernSignals === 0) {
    const positiveReasons: string[] = [];
    if (offspringCount >= 2) positiveReasons.push("سابقه تولیدمثلی مناسب دارد.");
    if (diseaseCount === 0) positiveReasons.push("سابقه سلامت مطلوبی دارد.");
    if (geneticScore !== null && geneticScore >= 60) positiveReasons.push("امتیاز ژنتیکی بالایی دارد.");

    const isSenior = lifeStage !== null && SENIOR_STAGES.includes(lifeStage);
    return {
      result: "high_value",
      label: isSenior ? "مولد مسن با عملکرد مناسب" : "ارزش نگهداری بالا",
      reasons: positiveReasons.length > 0 ? positiveReasons : ["نشانه‌ی نگران‌کننده‌ای در داده‌های ثبت‌شده یافت نشد."],
    };
  }

  return { result: "review_recommended", label: "نیازمند بررسی", reasons };
}
