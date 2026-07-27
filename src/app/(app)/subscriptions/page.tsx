"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Check, Gift, Copy } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { useFarmPlan } from "@/lib/hooks/use-farm-plan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatJalali, todayIso } from "@/lib/jalali";
import { toPersianDigits } from "@/lib/jalali";
import { PLAN_ORDER, PLAN_LABELS, PLAN_LIMITS, daysRemaining, isExpired } from "@/lib/subscription-plans";
import { PAYMENT_PROVIDERS, paymentProvider } from "@/lib/payments/provider";
import type { SubscriptionPlan, PaymentProviderId } from "@/lib/supabase/types";

const PLAN_CAPABILITIES: Record<SubscriptionPlan, string[]> = {
  free: ["۳۰ دام", "یک مزرعه", "داشبورد پایه", "ثبت دام", "ثبت زایمان"],
  silver: ["۲۰۰ دام", "یک مزرعه", "گزارش‌ها", "مدیریت خوراک"],
  gold: ["۱۰۰۰ دام", "سه مزرعه", "دستیار هوشمند", "گزارشات پیشرفته"],
  professional: ["دام نامحدود", "مزرعه نامحدود", "هوش ژنتیکی", "شجره‌نامه", "پشتیبانی ویژه", "دسترسی به بازار گله‌یار"],
};

function generateReferralCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function SubscriptionsPage() {
  const { profile, session } = useAuth();
  const farmId = profile?.farm_id;
  const { plan, subscriptionExpiresAt, loading } = useFarmPlan();
  const today = todayIso();

  const [upgradeTarget, setUpgradeTarget] = useState<SubscriptionPlan | null>(null);
  const [paying, setPaying] = useState<PaymentProviderId | null>(null);

  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [redeemInput, setRedeemInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase
      .from("referral_codes")
      .select("code")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setReferralCode(data.code);
      });
  }, [session]);

  async function ensureReferralCode() {
    if (!session || referralCode) return;
    const code = generateReferralCode();
    const { error } = await supabase.from("referral_codes").insert({ user_id: session.user.id, code });
    if (error) {
      toast.error(`ساخت کد معرف ناموفق بود: ${error.message}`);
      return;
    }
    setReferralCode(code);
  }

  async function copyReferralCode() {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      toast.success("کد معرف کپی شد");
    } catch {
      toast.error("کپی ناموفق بود");
    }
  }

  async function redeemCode() {
    if (!redeemInput.trim()) return;
    setRedeeming(true);
    const { data, error } = await supabase.rpc("redeem_referral_code", { p_code: redeemInput.trim().toUpperCase() });
    setRedeeming(false);
    if (error) {
      toast.error(`ثبت کد ناموفق بود: ${error.message}`);
      return;
    }
    if (data) {
      toast.success("کد معرف با موفقیت ثبت شد — ۳۰ روز اشتراک رایگان برای معرف‌کننده فعال شد.");
      setRedeemInput("");
    } else {
      toast.error("این کد نامعتبر است یا قبلاً استفاده شده.");
    }
  }

  async function pay(providerId: PaymentProviderId) {
    if (!farmId || !upgradeTarget) return;
    setPaying(providerId);
    try {
      const { data: inserted } = await supabase
        .from("payment_transactions")
        .insert({
          farm_id: farmId,
          plan: upgradeTarget,
          amount: 0,
          provider: providerId,
          status: "pending",
          created_by: session?.user.id,
        })
        .select("id")
        .single();
      const result = await paymentProvider(providerId).initiate(0, `${window.location.origin}/subscriptions`);
      toast.info(result.message);
      // No real gateway exists yet, so initiate() always resolves ok:false —
      // self-cancel the pending row now instead of leaving it dangling
      // forever. Only "pending" can transition here at all (RLS: an owner
      // can never set their own row to "success", see migration 0023).
      if (!result.ok && inserted) {
        await supabase.from("payment_transactions").update({ status: "failed" }).eq("id", inserted.id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "خطا در شروع پرداخت");
    } finally {
      setPaying(null);
    }
  }

  const remaining = daysRemaining(subscriptionExpiresAt, today);
  const expired = plan !== "free" && isExpired(subscriptionExpiresAt, today);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Crown className="size-6 text-primary" />
        <h1 className="text-xl font-bold">اشتراک‌ها</h1>
      </div>

      {expired && (
        <Card className="border-destructive">
          <CardContent className="p-4 text-sm text-destructive">
            اشتراک پلن {PLAN_LABELS[plan]} شما منقضی شده و اکنون در سطح پلن رایگان هستید — برای بازگرداندن امکانات، پلن را تمدید کنید.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>مدیریت اشتراک</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-center">
          <div className="flex flex-col rounded-xl bg-muted p-3">
            <span className="text-xs text-muted-foreground">پلن فعلی</span>
            <span className="text-lg font-bold text-primary">{loading ? "…" : PLAN_LABELS[plan]}</span>
          </div>
          <div className="flex flex-col rounded-xl bg-muted p-3">
            <span className="text-xs text-muted-foreground">باقی‌مانده</span>
            <span className="text-lg font-bold">
              {remaining !== null ? `${toPersianDigits(Math.max(remaining, 0))} روز` : "نامحدود"}
            </span>
          </div>
          <div className="col-span-2 flex justify-between rounded-xl bg-muted p-3 text-sm">
            <span className="text-muted-foreground">تاریخ تمدید</span>
            <span className="font-semibold">
              {subscriptionExpiresAt ? formatJalali(subscriptionExpiresAt.slice(0, 10)) : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">پلن‌های گله‌یار</h2>
        {PLAN_ORDER.map((p) => {
          const isCurrent = p === plan;
          return (
            <Card key={p} className={isCurrent ? "border-primary" : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{PLAN_LABELS[p]}</span>
                  {isCurrent && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">پلن فعلی</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <ul className="flex flex-col gap-1.5 text-sm">
                  {PLAN_CAPABILITIES[p].map((cap) => (
                    <li key={cap} className="flex items-center gap-1.5">
                      <Check className="size-3.5 shrink-0 text-success" />
                      {cap}
                    </li>
                  ))}
                </ul>
                {!isCurrent && (
                  <Button size="lg" className="h-12" onClick={() => setUpgradeTarget(p)}>
                    ارتقا به {PLAN_LABELS[p]}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="size-4 text-primary" /> سیستم معرفی
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            یک دامدار دیگر را دعوت کنید — با ثبت کد شما، ۳۰ روز اشتراک رایگان به پلن شما اضافه می‌شود.
          </p>
          {referralCode ? (
            <div className="flex items-center gap-2">
              <Input value={referralCode} readOnly className="h-11 flex-1 text-center font-mono text-lg" />
              <Button size="icon" variant="secondary" onClick={copyReferralCode} aria-label="کپی کد">
                <Copy className="size-4" />
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={ensureReferralCode}>ساخت کد معرف من</Button>
          )}

          <div className="flex items-center gap-2 border-t border-border pt-3">
            <Input
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value)}
              placeholder="کد معرف دوستتان را وارد کنید"
              className="h-11 flex-1"
            />
            <Button onClick={redeemCode} disabled={redeeming || !redeemInput.trim()}>
              {redeeming ? "…" : "ثبت کد"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!upgradeTarget} onOpenChange={(open) => !open && setUpgradeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>پرداخت برای پلن {upgradeTarget ? PLAN_LABELS[upgradeTarget] : ""}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">درگاه پرداخت را انتخاب کنید:</p>
            {PAYMENT_PROVIDERS.map((provider) => (
              <Button
                key={provider.id}
                variant="outline"
                className="h-12 justify-between"
                disabled={paying === provider.id}
                onClick={() => pay(provider.id)}
              >
                {provider.label}
                {paying === provider.id && "…"}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUpgradeTarget(null)}>بستن</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <p className="text-center text-xs text-muted-foreground">
        سقف دام‌ها: {toPersianDigits(PLAN_LIMITS[plan].maxAnimals ?? "∞")} · سقف مزرعه‌ها: {toPersianDigits(PLAN_LIMITS[plan].maxFarms ?? "∞")}
      </p>
    </div>
  );
}
