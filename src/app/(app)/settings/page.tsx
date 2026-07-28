"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, X, Copy } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { Farm, FarmInvite, FarmInviteStatus, UserProfile, UserRole } from "@/lib/supabase/types";

const INVITABLE_ROLES: UserRole[] = ["operator", "vet", "consultant"];
const INVITE_STATUS_LABELS: Record<FarmInviteStatus, string> = {
  pending: "در انتظار",
  accepted: "پذیرفته‌شده",
  expired: "منقضی‌شده",
  cancelled: "لغوشده",
};

export default function SettingsPage() {
  const router = useRouter();
  const { profile, session, signOut, refreshProfile } = useAuth();
  const isOwner = profile?.role === "owner";

  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [farm, setFarm] = useState<Farm | null>(null);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [invites, setInvites] = useState<FarmInvite[]>([]);
  const [inviteMethod, setInviteMethod] = useState<"phone" | "link">("link");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("operator");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");

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
            .in("status", ["pending", "expired"])
            .order("created_at", { ascending: false })
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
    if (error) {
      toast.error(`ذخیره نام ناموفق بود: ${error.message}`);
      return;
    }
    await refreshProfile();
    toast.success("نام ذخیره شد");
  }

  async function saveFarm() {
    if (!farm || !isOwner) return;
    const { error } = await supabase
      .from("farms")
      .update({ farm_name: farm.farm_name, province: farm.province, city: farm.city })
      .eq("id", farm.id);
    if (error) {
      toast.error(`ذخیره اطلاعات مزرعه ناموفق بود: ${error.message}`);
      return;
    }
    toast.success("اطلاعات مزرعه ذخیره شد");
  }

  async function sendPhoneInvite() {
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
    if (error) {
      toast.error(`دعوت ناموفق بود: ${error.message}`);
      return;
    }
    setInvitePhone("");
    toast.success("دعوت‌نامه ارسال شد. با اولین ورود این شماره به گله‌یار، فعال می‌شود.");
    void loadFarmData();
  }

  function buildInviteLink(token: string): string {
    return `${window.location.origin}/auth/accept-invite?token=${token}`;
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  // No email is sent — the owner shares this link manually (WhatsApp/Telegram/
  // in person). email is left null on purpose: accept_farm_invite only
  // enforces an email match when one was actually set on the invite, so
  // whoever opens the link can sign up or log in with any account of their
  // choosing and still gets the farm/role attached.
  async function createInviteLink() {
    if (!profile?.farm_id || !session) return;
    setSendingInvite(true);
    const { data, error } = await supabase
      .from("farm_invites")
      .insert({
        farm_id: profile.farm_id,
        role: inviteRole,
        invited_by: session.user.id,
        invitee_name: inviteName.trim() || null,
      })
      .select("token")
      .single();
    setSendingInvite(false);
    if (error || !data) {
      toast.error(`ساخت لینک دعوت ناموفق بود: ${error?.message}`);
      return;
    }
    const link = buildInviteLink(data.token);
    setGeneratedLink(link);
    setInviteName("");
    const copied = await copyToClipboard(link);
    toast.success(copied ? "لینک دعوت ساخته و در کلیپ‌بورد کپی شد." : "لینک دعوت ساخته شد.");
    void loadFarmData();
  }

  async function copyInviteLink(invite: FarmInvite) {
    const link = buildInviteLink(invite.token);
    const copied = await copyToClipboard(link);
    toast[copied ? "success" : "info"](copied ? "لینک کپی شد." : link);
  }

  async function cancelInvite(invite: FarmInvite) {
    const { error } = await supabase.from("farm_invites").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", invite.id);
    if (error) {
      toast.error(`لغو دعوت ناموفق بود: ${error.message}`);
      return;
    }
    toast.success("دعوت لغو شد.");
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
          {isOwner && (
            <Button variant="outline" asChild>
              <Link href="/farms">مدیریت مزرعه‌ها و سوییچ</Link>
            </Button>
          )}
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
                  <div key={inv.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span dir={inv.phone_number && !inv.invitee_name ? "ltr" : undefined}>
                        {inv.invitee_name || inv.phone_number || inv.email || "دعوت با لینک"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ROLE_LABELS[inv.role]} · {formatJalali(inv.created_at.slice(0, 10))}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={inv.status === "expired" ? "secondary" : "default"}>{INVITE_STATUS_LABELS[inv.status]}</Badge>
                      {inv.status === "pending" && !inv.phone_number && (
                        <Button variant="ghost" size="icon-sm" aria-label="کپی لینک دعوت" onClick={() => copyInviteLink(inv)}>
                          <Copy className="size-4" />
                        </Button>
                      )}
                      {inv.status === "pending" && (
                        <Button variant="ghost" size="icon-sm" aria-label="لغو دعوت" onClick={() => cancelInvite(inv)}>
                          <X className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <label className="text-sm text-muted-foreground">دعوت عضو جدید</label>
              <Tabs value={inviteMethod} onValueChange={(v) => setInviteMethod(v as "phone" | "link")}>
                <TabsList className="w-full">
                  <TabsTrigger value="link" className="flex-1">لینک دعوت</TabsTrigger>
                  <TabsTrigger value="phone" className="flex-1">شماره موبایل</TabsTrigger>
                </TabsList>
              </Tabs>

              {inviteMethod === "phone" && (
                <Input
                  value={invitePhone}
                  onChange={(e) => setInvitePhone(e.target.value)}
                  placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                  className="h-12 text-lg"
                  dir="ltr"
                />
              )}

              {inviteMethod === "link" && (
                <Input
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="نام فرد (اختیاری — مثلاً: علی رضایی)"
                  className="h-12 text-lg"
                />
              )}

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

              {inviteMethod === "link" && (
                <p className="text-xs text-muted-foreground">
                  با این نقش یک لینک ورود ساخته می‌شود؛ آن را برای فرد موردنظر ارسال کنید — با باز کردنش می‌تواند ثبت‌نام یا وارد شود و مستقیم با همین نقش به مزرعه اضافه می‌شود.
                </p>
              )}

              <Button onClick={inviteMethod === "link" ? createInviteLink : sendPhoneInvite} disabled={sendingInvite}>
                {sendingInvite ? "در حال ساخت…" : inviteMethod === "link" ? "ساخت و کپی لینک دعوت" : "ارسال دعوت"}
              </Button>

              {inviteMethod === "link" && generatedLink && (
                <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <span className="text-xs text-muted-foreground">لینک دعوت ساخته‌شده — این را برای فرد موردنظر بفرستید:</span>
                  <div className="flex items-center gap-2">
                    <Input value={generatedLink} readOnly dir="ltr" className="h-10 flex-1 text-sm" onFocus={(e) => e.target.select()} />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label="کپی لینک"
                      onClick={async () => {
                        const copied = await copyToClipboard(generatedLink);
                        toast[copied ? "success" : "info"](copied ? "لینک کپی شد." : generatedLink);
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
              )}
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
