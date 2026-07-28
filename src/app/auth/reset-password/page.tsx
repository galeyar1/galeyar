"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

const schema = z
  .object({
    password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "تکرار رمز عبور با رمز عبور جدید یکسان نیست",
    path: ["confirmPassword"],
  });

type Values = z.infer<typeof schema>;

type Step = "checking" | "ready" | "invalid" | "success";

/**
 * The Supabase client has detectSessionInUrl:false (see supabase/client.ts),
 * so the recovery link's tokens are never parsed automatically — this page
 * does it manually. Supabase's recovery links can arrive either as
 * implicit-flow hash tokens (#access_token&refresh_token&type=recovery) or,
 * depending on project auth settings, a PKCE ?code= query param; both are
 * handled so this works regardless of which the project is configured for.
 */
function useRecoverySession(): Step {
  const [step, setStep] = useState<Step>("checking");

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (!cancelled) setStep("ready");
        return;
      }

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (!cancelled) setStep(error ? "invalid" : "ready");
        return;
      }

      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (!cancelled) setStep(error ? "invalid" : "ready");
        return;
      }

      if (!cancelled) setStep("invalid");
    }

    void resolve();

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) setStep("ready");
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return step;
}

function ResetPasswordForm() {
  const router = useRouter();
  const step = useRecoverySession();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: Values) {
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: values.password });
    setSubmitting(false);

    if (error) {
      toast.error("تغییر رمز عبور ناموفق بود. لطفاً دوباره تلاش کنید.");
      return;
    }

    setDone(true);
    toast.success("رمز عبور شما با موفقیت تغییر کرد.");

    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) {
      router.push("/auth/login");
      return;
    }
    const { data: profile } = await supabase.from("users").select("farm_id").eq("id", userId).single();
    setTimeout(() => router.push(profile?.farm_id ? "/dashboard" : "/onboarding/farm"), 1200);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardContent className="flex flex-col gap-4 p-6">
        {step === "checking" && (
          <div className="flex flex-col items-center gap-3 p-4 text-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-muted-foreground">در حال بررسی لینک بازیابی…</p>
          </div>
        )}

        {step === "invalid" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <XCircle className="size-10 text-destructive" />
            <h1 className="text-lg font-bold">لینک نامعتبر یا منقضی‌شده</h1>
            <p className="text-muted-foreground">
              این لینک بازیابی رمز عبور نامعتبر است، قبلاً استفاده شده یا منقضی شده است.
            </p>
            <Button asChild className="w-full">
              <Link href="/auth/forgot-password">درخواست لینک جدید</Link>
            </Button>
          </div>
        )}

        {step === "ready" && !done && (
          <>
            <h1 className="text-lg font-bold">تنظیم رمز عبور جدید</h1>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">رمز عبور جدید</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" dir="ltr" className="h-12 text-lg" autoFocus />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">تکرار رمز عبور جدید</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" dir="ltr" className="h-12 text-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" size="lg" className="h-12 text-lg" disabled={submitting}>
                  {submitting ? "در حال ثبت…" : "ثبت رمز عبور جدید"}
                </Button>
              </form>
            </Form>
          </>
        )}

        {done && (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="size-10 text-success" />
            <h1 className="text-lg font-bold">رمز عبور شما با موفقیت تغییر کرد.</h1>
            <p className="text-muted-foreground">در حال انتقال…</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-12">
      <Logo variant="full" size={200} />
      <ResetPasswordForm />
    </div>
  );
}
