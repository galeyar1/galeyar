"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/logo";
import { ROLE_LABELS } from "@/lib/role-labels";
import type { UserRole } from "@/lib/supabase/types";

interface InvitePreview {
  ok: boolean;
  email?: string;
  role?: UserRole;
  status?: "pending" | "accepted" | "expired" | "cancelled";
  farm_name?: string;
  error?: string;
}

type Step = "loading" | "preview" | "accepting" | "success" | "error";

function AcceptInviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const { session, profile, refreshProfile, loading: authLoading } = useAuth();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [step, setStep] = useState<Step>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStep("error");
      setErrorMessage("لینک دعوت نامعتبر است.");
      return;
    }
    supabase.rpc("get_invite_by_token", { p_token: token }).then(({ data }) => {
      const result = data as InvitePreview;
      setPreview(result);
      if (!result?.ok) {
        setStep("error");
        setErrorMessage("این دعوت‌نامه یافت نشد.");
      } else if (result.status !== "pending") {
        setStep("error");
        setErrorMessage(
          result.status === "expired"
            ? "این دعوت‌نامه منقضی شده است. از مالک مزرعه بخواهید دوباره دعوت کند."
            : result.status === "cancelled"
              ? "این دعوت‌نامه لغو شده است."
              : "این دعوت‌نامه قبلاً پذیرفته شده است."
        );
      } else {
        setStep("preview");
      }
    });
  }, [token]);

  // Once authenticated (either just logged in, or a fresh signup that the
  // handle_new_auth_user trigger may have already auto-accepted), try the
  // acceptance RPC — it safely no-ops if the trigger got there first.
  useEffect(() => {
    if (authLoading || step !== "preview" || !session || !token) return;
    void acceptNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, step, session, token]);

  async function acceptNow() {
    if (!token) return;
    setStep("accepting");
    const { data } = await supabase.rpc("accept_farm_invite", { p_token: token });
    const result = data as { ok: boolean; error?: string };

    await refreshProfile();

    if (result?.ok) {
      setStep("success");
      return;
    }

    // A fresh signup's own auth trigger may have already accepted this
    // exact invite before this RPC ran — check whether that's actually
    // what happened (their farm_id now matches) before treating it as a
    // real failure.
    const { data: freshProfile } = await supabase.from("users").select("farm_id").eq("id", session?.user.id ?? "").maybeSingle();
    if (freshProfile?.farm_id) {
      setStep("success");
      return;
    }

    setStep("error");
    setErrorMessage(
      result?.error === "email_mismatch"
        ? "این دعوت برای ایمیل دیگری ارسال شده — با همان ایمیل وارد شوید."
        : result?.error === "expired"
          ? "این دعوت‌نامه منقضی شده است."
          : "پذیرفتن دعوت ناموفق بود."
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-12">
      <Logo variant="full" size={180} />

      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
          {(step === "loading" || step === "accepting") && (
            <>
              <Loader2 className="size-10 animate-spin text-primary" />
              <p className="text-muted-foreground">در حال بررسی دعوت‌نامه…</p>
            </>
          )}

          {step === "preview" && preview?.ok && (
            <>
              <h1 className="text-xl font-bold">دعوت به گله‌یار</h1>
              <p className="text-muted-foreground">
                شما به عنوان <strong className="text-foreground">{ROLE_LABELS[preview.role as UserRole]}</strong> برای همکاری در مزرعه‌ی «
                <strong className="text-foreground">{preview.farm_name}</strong>» دعوت شده‌اید.
              </p>
              {session ? (
                <Button size="lg" className="h-12 w-full text-lg" onClick={acceptNow}>
                  پذیرفتن دعوت
                </Button>
              ) : (
                <div className="flex w-full flex-col gap-2">
                  <Button asChild size="lg" className="h-12 text-lg">
                    <Link href={`/auth/login?token=${token}`}>ورود یا ثبت‌نام و پذیرفتن دعوت</Link>
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {preview.email ? `با ایمیل «${preview.email}» وارد شوید یا ثبت‌نام کنید.` : "با هر حساب کاربری که مایلید وارد شوید یا ثبت‌نام کنید."}
                  </p>
                </div>
              )}
            </>
          )}

          {step === "success" && (
            <>
              <CheckCircle2 className="size-12 text-success" />
              <h1 className="text-xl font-bold">دعوت با موفقیت پذیرفته شد</h1>
              <p className="text-muted-foreground">اکنون عضو این مزرعه هستید.</p>
              <Button size="lg" className="h-12 w-full text-lg" onClick={() => router.push(profile?.farm_id ? "/dashboard" : "/onboarding/farm")}>
                رفتن به داشبورد
              </Button>
            </>
          )}

          {step === "error" && (
            <>
              <XCircle className="size-12 text-destructive" />
              <h1 className="text-xl font-bold">مشکلی پیش آمد</h1>
              <p className="text-muted-foreground">{errorMessage}</p>
              <Button variant="outline" asChild className="w-full">
                <Link href="/auth/login">رفتن به صفحه‌ی ورود</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteInner />
    </Suspense>
  );
}
