"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { FarmForm } from "@/components/farm-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { useFarmPlan } from "@/lib/hooks/use-farm-plan";
import { isAtFarmLimit, PLAN_LIMITS, PLAN_LABELS } from "@/lib/subscription-plans";
import { toPersianDigits } from "@/lib/jalali";

export default function NewFarmPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { effectivePlan: plan, loading: planLoading } = useFarmPlan();
  const [farmCount, setFarmCount] = useState<number | null>(null);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("farm_members")
      .select("farm_id", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .then(({ count }) => setFarmCount(count ?? 0));
  }, [session]);

  if (planLoading || farmCount === null) return null;

  if (isAtFarmLimit(plan, farmCount)) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-xl font-bold">ساخت مزرعه جدید</h1>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Lock className="size-8 text-muted-foreground" />
            <p className="text-base font-semibold">
              پلن {PLAN_LABELS[plan]} شما اجازه ثبت حداکثر {toPersianDigits(PLAN_LIMITS[plan].maxFarms ?? 0)} مزرعه را می‌دهد.
            </p>
            <Button asChild>
              <Link href="/subscriptions">ارتقا پلن</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">ساخت مزرعه جدید</h1>
      <p className="text-sm text-muted-foreground">
        بعد از ثبت، به‌طور خودکار به این مزرعه جدید سوییچ می‌کنید.
      </p>
      <FarmForm submitLabel="ساخت مزرعه" onSuccess={() => router.push("/dashboard")} />
    </div>
  );
}
