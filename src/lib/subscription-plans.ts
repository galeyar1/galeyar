import type { SubscriptionPlan } from "@/lib/supabase/types";

/**
 * GALEYAR v3.0 subscription plans — capabilities exactly as specced. Text
 * plan values (not a Postgres enum) on farms.plan, matching every prior
 * round's precedent for growing state lists.
 */

export const PLAN_ORDER: SubscriptionPlan[] = ["free", "silver", "gold", "professional"];

export const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  free: "رایگان",
  silver: "نقره‌ای",
  gold: "طلایی",
  professional: "حرفه‌ای",
};

export interface PlanLimits {
  /** null = unlimited. */
  maxAnimals: number | null;
  maxFarms: number | null;
}

export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: { maxAnimals: 30, maxFarms: 1 },
  silver: { maxAnimals: 200, maxFarms: 1 },
  gold: { maxAnimals: 1000, maxFarms: 3 },
  professional: { maxAnimals: null, maxFarms: null },
};

export type SubscriptionFeature =
  | "reports"
  | "feed_management"
  | "ai_assistant"
  | "advanced_reports"
  | "genetic_intelligence"
  | "pedigree"
  | "premium_support"
  | "marketplace_access"
  | "inbreeding_detection"
  | "advanced_forecasting"
  | "financial_intelligence";

export const FEATURE_LABELS: Record<SubscriptionFeature, string> = {
  reports: "گزارش‌ها",
  feed_management: "مدیریت خوراک",
  ai_assistant: "دستیار هوشمند",
  advanced_reports: "گزارشات پیشرفته",
  genetic_intelligence: "هوش ژنتیکی",
  pedigree: "شجره‌نامه",
  premium_support: "پشتیبانی ویژه",
  marketplace_access: "دسترسی به بازار گله‌یار",
  inbreeding_detection: "تشخیص همخونی",
  advanced_forecasting: "پیش‌بینی پیشرفته",
  financial_intelligence: "هوش مالی",
};

/** Every feature available at a plan, cumulative (each tier keeps everything below it). */
const PLAN_FEATURES: Record<SubscriptionPlan, SubscriptionFeature[]> = {
  free: [],
  silver: ["reports", "feed_management"],
  gold: ["reports", "feed_management", "ai_assistant", "advanced_reports"],
  professional: [
    "reports",
    "feed_management",
    "ai_assistant",
    "advanced_reports",
    "genetic_intelligence",
    "pedigree",
    "premium_support",
    "marketplace_access",
    "inbreeding_detection",
    "advanced_forecasting",
    "financial_intelligence",
  ],
};

export function hasFeature(plan: SubscriptionPlan, feature: SubscriptionFeature): boolean {
  return PLAN_FEATURES[plan].includes(feature);
}

/** The cheapest plan that unlocks a feature — used for the upgrade prompt's target and copy. */
export function requiredPlanForFeature(feature: SubscriptionFeature): SubscriptionPlan {
  for (const plan of PLAN_ORDER) {
    if (hasFeature(plan, feature)) return plan;
  }
  return "professional";
}

/** e.g. "این قابلیت فقط در پلن حرفه‌ای در دسترس است." */
export function lockedFeatureMessage(feature: SubscriptionFeature): string {
  const plan = requiredPlanForFeature(feature);
  return `این قابلیت فقط در پلن ${PLAN_LABELS[plan]} در دسترس است.`;
}

export function planLimits(plan: SubscriptionPlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function isAtAnimalLimit(plan: SubscriptionPlan, currentActiveCount: number): boolean {
  const { maxAnimals } = PLAN_LIMITS[plan];
  return maxAnimals !== null && currentActiveCount >= maxAnimals;
}

export function isAtFarmLimit(plan: SubscriptionPlan, currentFarmCount: number): boolean {
  const { maxFarms } = PLAN_LIMITS[plan];
  return maxFarms !== null && currentFarmCount >= maxFarms;
}

export function nextPlan(plan: SubscriptionPlan): SubscriptionPlan | null {
  const index = PLAN_ORDER.indexOf(plan);
  return index >= 0 && index < PLAN_ORDER.length - 1 ? PLAN_ORDER[index + 1] : null;
}

/** Whole days left until expiration, or null when there's no expiration set (e.g. the free plan). */
export function daysRemaining(expiresAt: string | null, today: string): number | null {
  if (!expiresAt) return null;
  const diffMs = new Date(expiresAt).getTime() - new Date(today).getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function isExpired(expiresAt: string | null, today: string): boolean {
  const remaining = daysRemaining(expiresAt, today);
  return remaining !== null && remaining < 0;
}

/**
 * The plan actually in effect right now — falls back to "free" once
 * subscription_expires_at has passed, since farms.plan itself is never
 * automatically reset (no cron/trigger does that). Every limit/feature
 * check (isAtAnimalLimit, isAtFarmLimit, hasFeature, planLimits) should
 * gate on this, not on the raw plan column, or an expired paid farm keeps
 * full paid-tier access forever.
 */
export function effectivePlan(plan: SubscriptionPlan, expiresAt: string | null, today: string): SubscriptionPlan {
  return isExpired(expiresAt, today) ? "free" : plan;
}
