import type { FeedType } from "@/lib/supabase/types";

/** Per-animal-per-day kg amounts, by feed type, for one built-in ration template. */
export type RationAmounts = Partial<Record<FeedType, number>>;

export type RationTemplateId = "traditional" | "fattening" | "pregnant_ewe" | "lactating_ewe" | "lamb";

export interface RationTemplate {
  id: RationTemplateId;
  label: string;
  amounts: RationAmounts;
}

export const RATION_TEMPLATES: Record<RationTemplateId, RationTemplate> = {
  traditional: { id: "traditional", label: "سنتی", amounts: { hay: 1.0, straw: 0.5 } },
  fattening: { id: "fattening", label: "پرواری", amounts: { hay: 0.8, barley: 0.6, concentrate: 0.4 } },
  pregnant_ewe: { id: "pregnant_ewe", label: "میش آبستن", amounts: { hay: 1.2, barley: 0.3, concentrate: 0.2 } },
  lactating_ewe: { id: "lactating_ewe", label: "میش شیرده", amounts: { hay: 1.5, barley: 0.4, concentrate: 0.3 } },
  lamb: { id: "lamb", label: "بره", amounts: { hay: 0.3, concentrate: 0.2 } },
};

export type Season = "summer" | "winter";

/** Winter raises forage needs (extra energy for warmth); summer is the baseline. Applied only to hay/straw. */
const WINTER_FORAGE_MULTIPLIER = 1.15;

function seasonalAmounts(amounts: RationAmounts, season: Season): RationAmounts {
  if (season === "summer") return amounts;
  const adjusted: RationAmounts = { ...amounts };
  if (adjusted.hay) adjusted.hay = Number((adjusted.hay * WINTER_FORAGE_MULTIPLIER).toFixed(2));
  if (adjusted.straw) adjusted.straw = Number((adjusted.straw * WINTER_FORAGE_MULTIPLIER).toFixed(2));
  return adjusted;
}

/**
 * Total daily consumption suggested for a template across a headcount,
 * e.g. suggestedDailyConsumption(RATION_TEMPLATES.pregnant_ewe, 61, "winter").
 * Matches the spec's phrasing: "For N ewes, recommended hay consumption is X kg/day."
 */
export function suggestedDailyConsumption(
  template: RationTemplate,
  headcount: number,
  season: Season = "summer"
): RationAmounts {
  const perAnimal = seasonalAmounts(template.amounts, season);
  const total: RationAmounts = {};
  for (const [feedType, perAnimalAmount] of Object.entries(perAnimal) as [FeedType, number][]) {
    total[feedType] = Number((perAnimalAmount * headcount).toFixed(1));
  }
  return total;
}

/** Combines suggestions across several groups (e.g. ewes on one template, lambs on another) into one total. */
export function combineRationTotals(totals: RationAmounts[]): RationAmounts {
  const combined: RationAmounts = {};
  for (const total of totals) {
    for (const [feedType, amount] of Object.entries(total) as [FeedType, number][]) {
      combined[feedType] = Number(((combined[feedType] ?? 0) + amount).toFixed(1));
    }
  }
  return combined;
}
