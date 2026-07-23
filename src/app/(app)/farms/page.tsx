"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Check } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { triggerSync } from "@/lib/sync/engine";
import { canSwitchToFarm, type FarmMembershipLike } from "@/lib/farm-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Farm } from "@/lib/supabase/types";

export default function FarmsPage() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuth();
  const isOwner = profile?.role === "owner";
  const [farms, setFarms] = useState<Farm[]>([]);
  const [memberships, setMemberships] = useState<FarmMembershipLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  async function loadFarms() {
    if (!session) return;
    if (isOwner) {
      const { data } = await supabase
        .from("farm_members")
        .select("farm_id, user_id, farms(*)")
        .eq("user_id", session.user.id);
      const rows = (data ?? []) as unknown as { farm_id: string; user_id: string; farms: Farm }[];
      setFarms(rows.map((row) => row.farms).filter(Boolean));
      setMemberships(rows.map((row) => ({ farm_id: row.farm_id, user_id: row.user_id })));
    } else if (profile?.farm_id) {
      const { data } = await supabase.from("farms").select("*").eq("id", profile.farm_id).single();
      setFarms(data ? [data] : []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadFarms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, profile?.farm_id]);

  async function switchTo(farmId: string) {
    if (!session || farmId === profile?.farm_id) return;
    if (!canSwitchToFarm(memberships, session.user.id, farmId)) {
      toast.error("شما عضو این مزرعه نیستید");
      return;
    }
    setSwitching(farmId);
    const { error } = await supabase.from("users").update({ farm_id: farmId }).eq("id", session.user.id);
    setSwitching(null);
    if (error) {
      toast.error(`سوییچ مزرعه ناموفق بود: ${error.message}`);
      return;
    }
    await refreshProfile();
    void triggerSync();
    toast.success("مزرعه فعال تغییر کرد");
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">مزرعه‌های من</h1>
        {isOwner && (
          <Button asChild size="sm">
            <Link href="/farms/new">
              <Plus className="size-4" />
              مزرعه جدید
            </Link>
          </Button>
        )}
      </div>

      {!loading && farms.length === 0 && (
        <p className="text-center text-muted-foreground">مزرعه‌ای یافت نشد.</p>
      )}

      <ul className="flex flex-col gap-2">
        {farms.map((farm) => {
          const isCurrent = farm.id === profile?.farm_id;
          return (
            <li key={farm.id}>
              <Card className={isCurrent ? "border-primary" : undefined}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-lg font-semibold">{farm.farm_name}</span>
                    <span className="text-sm text-muted-foreground">
                      {farm.province}
                      {farm.city ? ` · ${farm.city}` : ""}
                    </span>
                  </div>
                  {isCurrent ? (
                    <span className="flex items-center gap-1 text-sm text-primary">
                      <Check className="size-4" />
                      فعال
                    </span>
                  ) : (
                    isOwner && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => switchTo(farm.id)}
                        disabled={switching === farm.id}
                      >
                        {switching === farm.id ? "در حال سوییچ…" : "سوییچ"}
                      </Button>
                    )
                  )}
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
