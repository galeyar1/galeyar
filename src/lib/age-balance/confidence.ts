import type { ConfidenceLevel } from "@/lib/age-balance/species-profiles";

export interface DataQualityInput {
  totalAnimals: number;
  animalsWithBirthDate: number;
  animalsWithBreed: number;
  animalsWithWeight: number;
}

export interface MissingDataItem {
  label: string;
  count: number;
}

export interface DataQualityResult {
  /** 0-100, a rough completeness score — shown to the farmer, never silently hidden (spec section 36). */
  qualityPercent: number;
  confidence: ConfidenceLevel;
  missing: MissingDataItem[];
}

/**
 * Confidence is driven mainly by known birth dates (the age engine's core
 * input) — breed and weight matter too but less. A very small herd is
 * capped at "insufficient" regardless of completeness, since percentages
 * over a handful of animals are statistically meaningless. This function
 * never returns a confidence higher than the data actually supports; the
 * UI is responsible for using cautious language ("برآورد اولیه") whenever
 * confidence is anything but "high" (spec section 37).
 */
export function assessDataQuality(input: DataQualityInput): DataQualityResult {
  const { totalAnimals, animalsWithBirthDate, animalsWithBreed, animalsWithWeight } = input;

  if (totalAnimals === 0) {
    return { qualityPercent: 0, confidence: "insufficient", missing: [] };
  }

  const birthDateShare = animalsWithBirthDate / totalAnimals;
  const breedShare = animalsWithBreed / totalAnimals;
  const weightShare = animalsWithWeight / totalAnimals;
  const qualityPercent = Math.round((birthDateShare * 0.6 + breedShare * 0.15 + weightShare * 0.25) * 100);

  let confidence: ConfidenceLevel;
  if (totalAnimals < 5 || birthDateShare < 0.3) confidence = "insufficient";
  else if (birthDateShare < 0.6 || qualityPercent < 50) confidence = "low";
  else if (birthDateShare < 0.85 || qualityPercent < 75) confidence = "medium";
  else confidence = "high";

  const missing: MissingDataItem[] = [];
  const missingBirthDate = totalAnimals - animalsWithBirthDate;
  if (missingBirthDate > 0) missing.push({ label: "تاریخ تولد", count: missingBirthDate });
  const missingWeight = totalAnimals - animalsWithWeight;
  if (missingWeight > 0) missing.push({ label: "وزن", count: missingWeight });
  const missingBreed = totalAnimals - animalsWithBreed;
  if (missingBreed > 0) missing.push({ label: "نژاد", count: missingBreed });

  return { qualityPercent, confidence, missing };
}

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  high: "بالا",
  medium: "متوسط",
  low: "پایین",
  insufficient: "ناکافی",
};

/** UI copy must soften its claim once confidence drops — never present a low-confidence estimate as a definite fact (spec section 37). */
export function confidenceQualifier(confidence: ConfidenceLevel): string {
  return confidence === "high" ? "" : "برآورد اولیه — ";
}
