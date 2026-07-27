"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Check, PauseCircle, PlayCircle, Trash2 } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { triggerSync } from "@/lib/sync/engine";
import { canSwitchToFarm, type FarmMembershipLike } from "@/lib/farm-access";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DeleteFarmDialog } from "@/components/delete-farm-dialog";
import type { Farm } from "@/lib/supabase/types";

export default function FarmsPage() {
  const router = useRouter();
  const { profile, session, refreshProfile } = useAuth();
  const isOwner = profile?.role === "owner";
  const [farms, setFarms] = useState<Farm[]>([]);
  const [memberships, setMemberships] = useState<FarmMembershipLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Farm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Farm | null>(null);

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

  /** After deactivating/deleting the CURRENT farm, move the user onto another farm they still have (preferring an active one), or clear farm_id entirely — the (app) layout's own guard then redirects to onboarding on its own once profile.farm_id is null, so no manual redirect is needed here. */
  async function moveOffFarm(farmId: string, remainingFarms: Farm[]) {
    if (!session || farmId !== profile?.farm_id) return;
    const next = remainingFarms.find((f) => f.id !== farmId && f.is_active) ?? remainingFarms.find((f) => f.id !== farmId);
    await supabase.from("users").update({ farm_id: next?.id ?? null }).eq("id", session.user.id);
    await refreshProfile();
    if (next) void triggerSync();
  }

  async function toggleActive(farm: Farm) {
    const nextActive = !farm.is_active;
    const { error } = await supabase
      .from("farms")
      .update({ is_active: nextActive, deactivated_at: nextActive ? null : new Date().toISOString() })
      .eq("id", farm.id);
    if (error) {
      toast.error(`${nextActive ? "فعال‌سازی مجدد" : "غیرفعال‌سازی"} مزرعه ناموفق بود: ${error.message}`);
      return;
    }
    if (!nextActive) await moveOffFarm(farm.id, farms);
    toast.success(nextActive ? "مزرعه دوباره فعال شد." : "مزرعه غیرفعال شد.");
    setDeactivateTarget(null);
    void loadFarms();
  }

  async function deleteFarm(farm: Farm) {
    const remaining = farms.filter((f) => f.id !== farm.id);
    const { error } = await supabase.from("farms").delete().eq("id", farm.id);
    if (error) {
      toast.error(`حذف مزرعه ناموفق بود: ${error.message}`);
      return;
    }
    await moveOffFarm(farm.id, remaining);
    toast.success("مزرعه حذف شد.");
    void loadFarms();
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
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold">{farm.farm_name}</span>
                      {!farm.is_active && <Badge variant="destructive">غیرفعال</Badge>}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {farm.province}
                      {farm.city ? ` · ${farm.city}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-sm text-primary">
                        <Check className="size-4" />
                        مزرعه‌ی جاری
                      </span>
                    )}
                    {!isCurrent && farm.is_active && isOwner && (
                      <Button size="sm" variant="outline" onClick={() => switchTo(farm.id)} disabled={switching === farm.id}>
                        {switching === farm.id ? "در حال سوییچ…" : "سوییچ"}
                      </Button>
                    )}
                    {isOwner && (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={farm.is_active ? "غیرفعال کردن مزرعه" : "فعال کردن مجدد مزرعه"}
                          title={farm.is_active ? "غیرفعال کردن مزرعه" : "فعال کردن مجدد مزرعه"}
                          onClick={() => (farm.is_active ? setDeactivateTarget(farm) : toggleActive(farm))}
                        >
                          {farm.is_active ? <PauseCircle className="size-4 text-muted-foreground" /> : <PlayCircle className="size-4 text-success" />}
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="حذف مزرعه"
                          title="حذف مزرعه"
                          onClick={() => setDeleteTarget(farm)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title="غیرفعال کردن مزرعه"
        description={`مزرعه‌ی «${deactivateTarget?.farm_name ?? ""}» غیرفعال می‌شود. تمام داده‌های دام‌ها و تاریخچه‌ی آن حفظ می‌شود و هر زمان می‌توانید دوباره آن را فعال کنید.${
          deactivateTarget?.id === profile?.farm_id ? " چون این مزرعه‌ی جاری شماست، در صورت وجود مزرعه‌ی فعال دیگر، به آن سوییچ می‌کنید." : ""
        }`}
        confirmLabel="غیرفعال کردن مزرعه"
        confirmBusyLabel="در حال ثبت…"
        confirmVariant="default"
        showIcon={false}
        onConfirm={() => { if (deactivateTarget) void toggleActive(deactivateTarget); }}
      />

      <DeleteFarmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        farmName={deleteTarget?.farm_name ?? ""}
        onConfirm={() => { if (deleteTarget) void deleteFarm(deleteTarget); }}
      />
    </div>
  );
}
