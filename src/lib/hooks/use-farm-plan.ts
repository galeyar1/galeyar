"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { db } from "@/lib/db/schema";
import { effectivePlan as computeEffectivePlan, PLAN_LIMITS, PLAN_FEATURES_FALLBACK, type PlanLimits } from "@/lib/subscription-plans";
import { todayIso } from "@/lib/jalali";
import type { SubscriptionPlan } from "@/lib/supabase/types";

export interface FarmPlanInfo {
  /** The plan stored on farms.plan — for display ("شما پلن X را خریداری کرده‌اید"), even if expired. */
  plan: SubscriptionPlan;
  /** plan, or "free" if subscription_expires_at has passed — use this for every limit/feature gate. */
  effectivePlan: SubscriptionPlan;
  /** Live limits for effectivePlan from the admin-editable plans table — falls back to the hardcoded defaults if the fetch fails or the plan row is missing. */
  limits: PlanLimits;
  /** Live feature keys for effectivePlan — same fallback behavior as limits. */
  features: string[];
  subscriptionStartedAt: string | null;
  subscriptionExpiresAt: string | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * The current farm's subscription plan. Lives on farms.plan (not the user
 * profile — a plan belongs to the farm, not the person), so this is a
 * small dedicated online-only fetch rather than something auth-provider
 * already carries, same pattern as feed_inventory's direct Supabase reads.
 */
export function useFarmPlan(): FarmPlanInfo {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [subscriptionStartedAt, setSubscriptionStartedAt] = useState<string | null>(null);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [limits, setLimits] = useState<PlanLimits>(PLAN_LIMITS.free);
  const [features, setFeatures] = useState<string[]>(PLAN_FEATURES_FALLBACK.free);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!farmId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    supabase
      .from("farms")
      .select("plan, subscription_started_at, subscription_expires_at")
      .eq("id", farmId)
      .single()
      .then(async ({ data }) => {
        if (cancelled || !data) {
          setLoading(false);
          return;
        }
        const rawPlan = (data.plan as SubscriptionPlan) ?? "free";
        setPlan(rawPlan);
        setSubscriptionStartedAt(data.subscription_started_at ?? null);
        setSubscriptionExpiresAt(data.subscription_expires_at ?? null);

        const effective = computeEffectivePlan(rawPlan, data.subscription_expires_at ?? null, todayIso());

        const { data: planRow } = await supabase
          .from("plans")
          .select("key, max_animals, max_farms, features")
          .eq("key", effective)
          .maybeSingle();

        if (cancelled) return;

        if (planRow) {
          const liveLimits = { maxAnimals: planRow.max_animals, maxFarms: planRow.max_farms };
          setLimits(liveLimits);
          setFeatures((planRow.features as string[]) ?? []);
          void db.plans_cache.put({
            id: effective,
            key: effective,
            name: effective,
            description: null,
            price: 0,
            currency: "IRT",
            duration_days: null,
            max_animals: planRow.max_animals,
            max_farms: planRow.max_farms,
            features: (planRow.features as string[]) ?? [],
            is_active: true,
            sort_order: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        } else {
          const cached = await db.plans_cache.get(effective);
          if (cached) {
            setLimits({ maxAnimals: cached.max_animals, maxFarms: cached.max_farms });
            setFeatures(cached.features);
          } else {
            setLimits(PLAN_LIMITS[effective]);
            setFeatures(PLAN_FEATURES_FALLBACK[effective]);
          }
        }

        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [farmId, nonce]);

  return {
    plan,
    effectivePlan: computeEffectivePlan(plan, subscriptionExpiresAt, todayIso()),
    limits,
    features,
    subscriptionStartedAt,
    subscriptionExpiresAt,
    loading,
    refresh: () => setNonce((n) => n + 1),
  };
}
