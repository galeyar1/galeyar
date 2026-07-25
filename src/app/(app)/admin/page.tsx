"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toPersianDigits, todayIso } from "@/lib/jalali";
import { PLAN_ORDER, PLAN_LABELS } from "@/lib/subscription-plans";
import { MARKETPLACE_CATEGORY_LABELS } from "@/lib/marketplace";
import type {
  Farm,
  UserProfile,
  MarketplaceListing,
  Advertisement,
  PaymentTransaction,
  SubscriptionPlan,
  AdvertisementStatus,
} from "@/lib/supabase/types";

function AnalyticsTab() {
  const [stats, setStats] = useState<{
    totalUsers: number;
    activeUsers: number;
    premiumUsers: number;
    listings: number;
    monthlyRevenue: number;
  } | null>(null);

  useEffect(() => {
    async function load() {
      const monthKey = todayIso().slice(0, 7);
      const [{ count: totalUsers }, { count: activeUsers }, { data: farms }, { count: listings }, { data: payments }] =
        await Promise.all([
          supabase.from("users").select("id", { count: "exact", head: true }),
          supabase.from("users").select("id", { count: "exact", head: true }).not("farm_id", "is", null),
          supabase.from("farms").select("plan"),
          supabase.from("marketplace_listings").select("id", { count: "exact", head: true }).eq("status", "active"),
          supabase.from("payment_transactions").select("amount, status, created_at").eq("status", "success"),
        ]);
      const premiumUsers = (farms ?? []).filter((f) => f.plan !== "free").length;
      const monthlyRevenue = ((payments ?? []) as Pick<PaymentTransaction, "amount" | "created_at">[])
        .filter((p) => p.created_at.slice(0, 7) === monthKey)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      setStats({ totalUsers: totalUsers ?? 0, activeUsers: activeUsers ?? 0, premiumUsers, listings: listings ?? 0, monthlyRevenue });
    }
    void load();
  }, []);

  if (!stats) return <p className="p-4 text-center text-muted-foreground">در حال بارگذاری…</p>;

  const cards = [
    { label: "کل کاربران", value: stats.totalUsers },
    { label: "کاربران فعال", value: stats.activeUsers },
    { label: "کاربران پرمیوم", value: stats.premiumUsers },
    { label: "آگهی‌های بازار", value: stats.listings },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="p-4 text-center">
            <div className="text-lg font-bold text-primary">{toPersianDigits(c.value)}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </CardContent>
        </Card>
      ))}
      <Card className="col-span-2">
        <CardContent className="p-4 text-center">
          <div className="text-lg font-bold text-primary">{toPersianDigits(stats.monthlyRevenue.toLocaleString())} تومان</div>
          <div className="text-xs text-muted-foreground">درآمد این ماه</div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlansTab() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase.from("farms").select("*").order("created_at", { ascending: false });
    setFarms(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function changePlan(farmId: string, plan: SubscriptionPlan) {
    const { error } = await supabase.from("farms").update({ plan }).eq("id", farmId);
    if (error) {
      toast.error(`تغییر پلن ناموفق بود: ${error.message}`);
      return;
    }
    toast.success("پلن به‌روزرسانی شد");
    void load();
  }

  if (loading) return <p className="p-4 text-center text-muted-foreground">در حال بارگذاری…</p>;

  return (
    <ul className="flex flex-col gap-2">
      {farms.map((farm) => (
        <li key={farm.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-col">
            <span className="font-semibold">{farm.farm_name}</span>
            <span className="text-xs text-muted-foreground">{farm.province ?? "—"}</span>
          </div>
          <Select value={farm.plan} onValueChange={(v) => changePlan(farm.id, v as SubscriptionPlan)}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PLAN_ORDER.map((p) => (
                <SelectItem key={p} value={p}>{PLAN_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </li>
      ))}
    </ul>
  );
}

function ListingsTab() {
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from("marketplace_listings")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setListings(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function removeListing(id: string) {
    const { error } = await supabase.from("marketplace_listings").update({ status: "removed" }).eq("id", id);
    if (error) {
      toast.error(`حذف آگهی ناموفق بود: ${error.message}`);
      return;
    }
    toast.success("آگهی حذف شد");
    void load();
  }

  if (loading) return <p className="p-4 text-center text-muted-foreground">در حال بارگذاری…</p>;

  return (
    <ul className="flex flex-col gap-2">
      {listings.map((listing) => (
        <li key={listing.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
          <div className="flex flex-col">
            <span className="font-semibold">{listing.title}</span>
            <span className="text-xs text-muted-foreground">
              {MARKETPLACE_CATEGORY_LABELS[listing.category]} · {listing.status}
            </span>
          </div>
          {listing.status !== "removed" && (
            <Button size="sm" variant="destructive" onClick={() => removeListing(listing.id)}>حذف</Button>
          )}
        </li>
      ))}
      {listings.length === 0 && <p className="text-center text-muted-foreground">آگهی‌ای ثبت نشده است.</p>}
    </ul>
  );
}

function AdvertisementsTab() {
  const { session } = useAuth();
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [title, setTitle] = useState("");
  const [sponsorName, setSponsorName] = useState("");
  const [body, setBody] = useState("");

  async function load() {
    const { data } = await supabase.from("advertisements").select("*").order("created_at", { ascending: false });
    setAds(data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createAd() {
    if (!title.trim() || !session) return;
    const { error } = await supabase.from("advertisements").insert({
      title: title.trim(),
      sponsor_name: sponsorName || null,
      body: body || null,
      status: "draft",
      created_by: session.user.id,
    });
    if (error) {
      toast.error(`ثبت تبلیغ ناموفق بود: ${error.message}`);
      return;
    }
    setTitle("");
    setSponsorName("");
    setBody("");
    toast.success("تبلیغ ثبت شد (حالت پیش‌نویس)");
    void load();
  }

  async function setStatus(id: string, status: AdvertisementStatus) {
    await supabase.from("advertisements").update({ status }).eq("id", id);
    void load();
  }

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader><CardTitle className="text-base">تبلیغ جدید</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان" className="h-10" />
          <Input value={sponsorName} onChange={(e) => setSponsorName(e.target.value)} placeholder="نام حامی" className="h-10" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="متن" rows={2} />
          <Button onClick={createAd} disabled={!title.trim()}>افزودن</Button>
        </CardContent>
      </Card>
      <ul className="flex flex-col gap-2">
        {ads.map((ad) => (
          <li key={ad.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
            <div className="flex flex-col">
              <span className="font-semibold">{ad.title}</span>
              <span className="text-xs text-muted-foreground">{ad.sponsor_name ?? "—"} · {ad.status}</span>
            </div>
            <Select value={ad.status} onValueChange={(v) => setStatus(ad.id, v as AdvertisementStatus)}>
              <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">پیش‌نویس</SelectItem>
                <SelectItem value="active">فعال</SelectItem>
                <SelectItem value="archived">آرشیو</SelectItem>
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => setUsers((data ?? []) as UserProfile[]));
  }, []);

  return (
    <ul className="flex flex-col gap-2">
      {users.map((u) => (
        <li key={u.id} className="flex flex-col gap-0.5 rounded-xl border border-border bg-card p-3">
          <span className="font-semibold">{u.full_name ?? "بدون نام"}</span>
          <span className="text-xs text-muted-foreground">
            {u.phone_number ?? "—"} · {u.role} {u.is_platform_admin ? "· مدیر پلتفرم" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminPanelPage() {
  const { profile, loading } = useAuth();

  if (loading) return null;
  if (!profile?.is_platform_admin) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-muted-foreground">
        <ShieldCheck className="size-8" />
        <p>دسترسی به این بخش محدود است.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-6 text-primary" />
        <h1 className="text-xl font-bold">پنل مدیریت</h1>
      </div>

      <Tabs defaultValue="analytics">
        <TabsList className="w-full">
          <TabsTrigger value="analytics">آمار</TabsTrigger>
          <TabsTrigger value="plans">مزارع/پلن‌ها</TabsTrigger>
          <TabsTrigger value="listings">آگهی‌ها</TabsTrigger>
          <TabsTrigger value="ads">تبلیغات</TabsTrigger>
          <TabsTrigger value="users">کاربران</TabsTrigger>
        </TabsList>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
        <TabsContent value="plans"><PlansTab /></TabsContent>
        <TabsContent value="listings"><ListingsTab /></TabsContent>
        <TabsContent value="ads"><AdvertisementsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
      </Tabs>
    </div>
  );
}
