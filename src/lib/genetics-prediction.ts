/**
 * Genetic Intelligence: genotype prediction (a real single-locus Punnett
 * square over Homozygous/Heterozygous/Local — not a lookup table pretending
 * to be genetics), named-breed cross rules, scoring, and AI-accuracy
 * tracking. Every offspring's predicted_genetics is an independent random
 * draw from the distribution (not the modal outcome) — that's why twin
 * offspring from the same parents can predict differently, matching the
 * spec's own worked example (SH-125-05-M1 predicted Homozygous, its twin
 * SH-125-05-F1 predicted Heterozygous).
 */

export type GeneticState =
  | "unknown"
  | "local"
  | "heterozygous"
  | "homozygous"
  | "romanov"
  | "romanov_asaf"
  | "shall"
  | "shall_romanov"
  | "lacaune"
  | "afshari"
  | "other";

export const GENETIC_STATE_LABELS: Record<GeneticState, string> = {
  unknown: "نامشخص",
  local: "محلی",
  heterozygous: "هتروزیگوت",
  homozygous: "هموزیگوت",
  romanov: "رومانوف",
  romanov_asaf: "رومانوف-اصف",
  shall: "شال",
  shall_romanov: "شال-رومانوف",
  lacaune: "لاکن",
  afshari: "افشاری",
  other: "سایر",
};

export type GeneticsSource = "ai_prediction" | "lab_confirmed" | "user_edited";

export const GENETICS_SOURCE_LABELS: Record<GeneticsSource, string> = {
  ai_prediction: "پیش‌بینی هوش مصنوعی",
  lab_confirmed: "تأیید آزمایشگاه",
  user_edited: "ویرایش کاربر",
};

/** Section 8's worked scores; شال/نامشخص/سایر aren't scored in the spec, given reasonable neutral defaults. */
export const GENETIC_SCORES: Record<GeneticState, number> = {
  homozygous: 100,
  romanov: 95,
  romanov_asaf: 92,
  shall_romanov: 90,
  lacaune: 85,
  heterozygous: 80,
  afshari: 75,
  shall: 70,
  local: 50,
  other: 40,
  unknown: 0,
};

export function geneticScore(state: GeneticState): number {
  return GENETIC_SCORES[state];
}

export type GeneticDistribution = Partial<Record<GeneticState, number>>;

type Allele = "A" | "a";
const ALLELE_TRIAD: GeneticState[] = ["homozygous", "heterozygous", "local"];

function alleleDistribution(state: GeneticState): Partial<Record<Allele, number>> {
  if (state === "homozygous") return { A: 1 };
  if (state === "heterozygous") return { A: 0.5, a: 0.5 };
  return { a: 1 }; // local
}

/** The classic Homozygous/Heterozygous/Local single-locus cross (spec section 3), derived from real allele combinatorics rather than a lookup table. */
function predictTriadCross(father: GeneticState, mother: GeneticState): GeneticDistribution {
  const fatherAlleles = alleleDistribution(father);
  const motherAlleles = alleleDistribution(mother);
  const result: GeneticDistribution = {};
  for (const [a1, p1] of Object.entries(fatherAlleles) as [Allele, number][]) {
    for (const [a2, p2] of Object.entries(motherAlleles) as [Allele, number][]) {
      const genotype: GeneticState = a1 === "A" && a2 === "A" ? "homozygous" : a1 === "a" && a2 === "a" ? "local" : "heterozygous";
      result[genotype] = (result[genotype] ?? 0) + p1 * p2;
    }
  }
  return result;
}

/**
 * Named-breed crosses (spec section 4). Only the pairs the spec actually
 * defines with an enum-representable result are implemented as real rules;
 * "Romanov × Asaf" and "HM × Romanov/Shall" reference either an input state
 * ("Asaf") or output labels ("HM-R", "HM-SH") outside the fixed 11-state
 * enum from section 1, so they fall through to the "سایر" (mixed/other)
 * bucket rather than inventing new states.
 */
function predictBreedCross(father: GeneticState, mother: GeneticState): GeneticDistribution {
  if (father === mother) return { [father]: 1 };

  const pair = [father, mother].sort().join("+");
  if (pair === ["local", "romanov"].sort().join("+")) return { romanov: 0.5, local: 0.5 };
  if (pair === ["local", "shall"].sort().join("+")) return { shall: 0.5, local: 0.5 };
  if (pair === ["local", "lacaune"].sort().join("+")) return { lacaune: 0.5, local: 0.5 };
  if (pair === ["local", "afshari"].sort().join("+")) return { afshari: 0.5, local: 0.5 };
  if (pair === ["romanov", "shall"].sort().join("+")) return { shall_romanov: 1 };

  return { other: 1 };
}

/**
 * Predicts the offspring genetic-state distribution for one mating.
 * Returns null when either parent's state can't be meaningfully bred from
 * (unknown/other) — callers should treat that as "cannot predict".
 */
const NAMED_BREEDS: GeneticState[] = ["romanov", "romanov_asaf", "shall", "shall_romanov", "lacaune", "afshari"];

export function predictOffspringGenetics(father: GeneticState, mother: GeneticState): GeneticDistribution | null {
  if (father === "unknown" || father === "other" || mother === "unknown" || mother === "other") return null;

  // "local" legitimately belongs to both sets (it's the recessive allele in
  // the triad *and* a valid partner in a named-breed cross) — checking the
  // Punnett-square triad first means Local x Local / Local x Homozygous /
  // Local x Heterozygous always resolve there, and only a genuine named
  // breed (never in the triad) falls through to the breed-cross check.
  const fatherInTriad = ALLELE_TRIAD.includes(father);
  const motherInTriad = ALLELE_TRIAD.includes(mother);
  if (fatherInTriad && motherInTriad) return predictTriadCross(father, mother);

  const fatherBreedable = NAMED_BREEDS.includes(father) || father === "local";
  const motherBreedable = NAMED_BREEDS.includes(mother) || mother === "local";
  if (fatherBreedable && motherBreedable) return predictBreedCross(father, mother);

  // One side is a named breed, the other is Homozygous/Heterozygous —
  // not one of the spec's defined combinations (its two examples for this
  // case use output labels outside the fixed enum). Classified as mixed.
  return { other: 1 };
}

/** Weighted random draw from a distribution — this is what makes each individual offspring's prediction independent, not just the modal outcome. */
export function sampleGeneticState(distribution: GeneticDistribution, random: () => number = Math.random): GeneticState {
  const entries = Object.entries(distribution) as [GeneticState, number][];
  const total = entries.reduce((sum, [, p]) => sum + p, 0);
  let roll = random() * total;
  for (const [state, p] of entries) {
    roll -= p;
    if (roll <= 0) return state;
  }
  return entries[entries.length - 1]?.[0] ?? "unknown";
}

/** Convenience: predict + sample in one call, falling back to "unknown" when parents can't be bred from. */
export function predictAndSampleOffspringGenetics(
  father: GeneticState,
  mother: GeneticState,
  random: () => number = Math.random
): GeneticState {
  const distribution = predictOffspringGenetics(father, mother);
  return distribution ? sampleGeneticState(distribution, random) : "unknown";
}

export interface AiAccuracyResult {
  totalPredictions: number;
  confirmedPredictions: number;
  matchingPredictions: number;
  accuracyPercent: number | null;
}

/** Section 13: how often the AI's predicted_genetics matched what was later confirmed. */
export function computeAiAccuracy(
  animals: { predicted_genetics: GeneticState | null; confirmed_genetics: GeneticState | null }[]
): AiAccuracyResult {
  const totalPredictions = animals.filter((a) => a.predicted_genetics !== null).length;
  const confirmed = animals.filter((a) => a.predicted_genetics !== null && a.confirmed_genetics !== null);
  const matching = confirmed.filter((a) => a.predicted_genetics === a.confirmed_genetics);
  return {
    totalPredictions,
    confirmedPredictions: confirmed.length,
    matchingPredictions: matching.length,
    accuracyPercent: confirmed.length > 0 ? Math.round((matching.length / confirmed.length) * 100) : null,
  };
}
