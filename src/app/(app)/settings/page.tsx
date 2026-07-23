"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IRAN_PROVINCES } from "@/lib/iran-provinces";
import { ROLE_LABELS } from "@/lib/role-labels";
import { normalizeIranianPhone } from "@/lib/auth/phone";
import { formatJalali } from "@/lib/jalali";
import type { Farm, FarmInvite, UserProfile, UserRole } from "@/lib/supabase/types";

const INVITABLE_ROLES: UserRole[] = ["operator", "vet", "consultant"];

export default function SettingsPage() {
  const router = useRouter();
  const { profile, session, signOut, refreshProfile } = useAuth();
  const isOwner = profile?.role === "owner";

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [farm, setFarm] = useState<Farm | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<FarmInvite[]>([]);
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("operator");

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
  }, [profile?.full_name]);

  async function loadFarmData() {
    if (!profile?.farm_id) return;
    const [{ data: farmData }, { data: userRows }, { data: inviteRows }] = await Promise.all([
      supabase.from("farms").select("*").eq("id", profile.farm_id).single(),
      supabase.from("users").select("*").eq("farm_id", profile.farm_id),
      isOwner
        ? supabase
            .from("farm_invites")
            .select("*")
            .eq("farm_id", profile.farm_id)
            .is("accepted_at", null)
        : Promise.resolve({ data: [] }),
    ]);
    setFarm(farmData ?? null);
    setMembers(userRows ?? []);
    setInvites(inviteRows ?? []);
  }

  useEffect(() => {
    void loadFarmData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.farm_id]);

  async function saveProfile() {
    if (!session) return;
    const { error } = await supabase.from("users").update({ full_name: fullName }).eq("id", session.user.id);
    if (error) return toast.error("ذخیره نام ناموفق بود");
    await refreshProfile();
    toast.success("نام ذخیره شد");
  }

  async function saveFarm() {
    if (!farm || !isOwner) return;
    const { error } = await supabase
      .from("farms")
      .update({ farm_name: farm.farm_name, province: farm.province, city: farm.city })
      .eq("id", farm.id);
    if (error) return toast.error("ذخیره اطلاعات مزرعه ناموفق بود");
    toast.success("اطلاعات مزرعه ذخیره شد");
  }

  async function sendInvite() {
    const normalized = normalizeIranianPhone(invitePhone);
    if (!normalized || !profile?.farm_id || !session) {
      toast.error("شماره موبایل معتبر نیست");
      return;
    }
    const { error } = await supabase.from("farm_invites").insert({
      farm_id: profile.farm_id,
      phone_number: normalized,
      role: inviteRole,
      invited_by: session.user.id,
    });
    if (error) return toast.error("دعوت ناموفق بود (شاید قبلاً ثبت شده)");
    setInvitePhone("");
    toast.success("دعوت‌نامه ارسال شد. با اولین ورود این شماره به گله‌یار، فعال می‌شود.");
    void loadFarmData();
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">تنظیمات</h1>

      <Card>
        <CardHeader>
          <CardTitle>پروفایل من</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted-foreground">نام و نام خانوادگی</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-12 text-lg" />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted-foreground">
              {profile?.phone_number ? "شماره موبایل" : "ایمیل"}
            </label>
            <Input value={profile?.phone_number ?? profile?.email ?? ""} disabled className="h-12 text-lg" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">نقش:</span>
            <Badge>{profile ? ROLE_LABELS[profile.role] : ""}</Badge>
          </div>
          <Button onClick={saveProfile}>ذخیره پروفایل</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>اطلاعات دامداری</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted-foreground">نام دامداری</label>
            <Input
              value={farm?.farm_name ?? ""}
              disabled={!isOwner}
              onChange={(e) => setFarm((f) => (f ? { ...f, farm_name: e.target.value } : f))}
              className="h-12 text-lg"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted-foreground">استان</label>
            <Select
              value={farm?.province ?? ""}
              onValueChange={(v) => setFarm((f) => (f ? { ...f, province: v } : f))}
              disabled={!isOwner}
            >
              <SelectTrigger className="h-12 w-full text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IRAN_PROVINCES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted-foreground">شهرستان</label>
            <Input
              value={farm?.city ?? ""}
              disabled={!isOwner}
              onChange={(e) => setFarm((f) => (f ? { ...f, city: e.target.value } : f))}
              className="h-12 text-lg"
            />
          </div>
          {isOwner && <Button onClick={saveFarm}>ذخیره اطلاعات دامداری</Button>}
        </CardContent>
      </Card>

      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>اعضای تیم</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-lg bg-muted p-3">
                  <span>{m.full_name || m.phone_number || m.email}</span>
                  <Badge variant="secondary">{ROLE_LABELS[m.role]}</Badge>
                </li>
              ))}
            </ul>

            {invites.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-muted-foreground">دعوت‌های در انتظار</span>
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                    <span>{inv.phone_number}</span>
                    <span className="text-muted-foreground">
                      {ROLE_LABELS[inv.role]} · {formatJalali(inv.created_at.slice(0, 10))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <label className="text-sm text-muted-foreground">افزودن عضو جدید</label>
              <Input
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
                placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                className="h-12 text-lg"
                dir="ltr"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as UserRole)}>
                <SelectTrigger className="h-12 w-full text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITABLE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={sendInvite}>ارسال دعوت</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        variant="outline"
        className="h-12 text-lg"
        onClick={() => signOut().then(() => router.push("/auth/login"))}
      >
        <LogOut className="size-5" /> خروج از حساب
      </Button>
    </div>
  );
}
