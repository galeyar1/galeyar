"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import type { SubscriptionPlan } from "@/lib/supabase/types";

export interface FarmPlanInfo {
  plan: SubscriptionPlan;
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
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setPlan((data.plan as SubscriptionPlan) ?? "free");
          setSubscriptionStartedAt(data.subscription_started_at ?? null);
          setSubscriptionExpiresAt(data.subscription_expires_at ?? null);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [farmId, nonce]);

  return { plan, subscriptionStartedAt, subscriptionExpiresAt, loading, refresh: () => setNonce((n) => n + 1) };
}
