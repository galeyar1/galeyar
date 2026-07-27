"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useFarmPlan } from "@/lib/hooks/use-farm-plan";
import {
  lockedFeatureMessage,
  requiredPlanForFeature,
  PLAN_LABELS,
  type SubscriptionFeature,
} from "@/lib/subscription-plans";

export function LockedFeatureCard({ feature }: { feature: SubscriptionFeature }) {
  const requiredPlan = requiredPlanForFeature(feature);
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <Lock className="size-8 text-muted-foreground" />
        <p className="text-base font-semibold">{lockedFeatureMessage(feature)}</p>
        <Button asChild>
          <Link href="/subscriptions">ارتقا به پلن {PLAN_LABELS[requiredPlan]}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Wraps a page/section: renders children only if the current farm's plan unlocks `feature`, otherwise a paywall. */
export function FeatureGate({ feature, children }: { feature: SubscriptionFeature; children: React.ReactNode }) {
  const { features, loading } = useFarmPlan();
  if (loading) return null;
  if (!features.includes(feature)) return <LockedFeatureCard feature={feature} />;
  return <>{children}</>;
}
