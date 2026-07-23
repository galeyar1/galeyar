"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { supabase } from "@/lib/supabase/client";
import { isValidIranianPhone, normalizeIranianPhone } from "@/lib/auth/phone";
import { Logo } from "@/components/logo";

const phoneSchema = z.object({
  phone: z.string().refine(isValidIranianPhone, {
    message: "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷)",
  }),
});

const emailSchema = z.object({
  email: z.string().email("ایمیل معتبر نیست"),
  password: z.string().min(6, "رمز عبور باید حداقل ۶ کاراکتر باشد"),
});

type PhoneValues = z.infer<typeof phoneSchema>;
type EmailValues = z.infer<typeof emailSchema>;

function PhoneLoginForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<PhoneValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: "" },
  });

  async function onSubmit(values: PhoneValues) {
    const phone = normalizeIranianPhone(values.phone);
    if (!phone) return;

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({ phone });
    setSubmitting(false);

    if (error) {
      toast.error("ارسال کد ناموفق بود. دوباره تلاش کنید.");
      return;
    }

    router.push(`/auth/verify?phone=${encodeURIComponent(phone)}`);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">شماره موبایل</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  inputMode="numeric"
                  placeholder="۰۹۱۲۱۲۳۴۵۶۷"
                  className="h-14 text-center text-xl tracking-widest"
                  dir="ltr"
                  autoFocus
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="lg" className="h-14 text-lg" disabled={submitting}>
          {submitting ? "در حال ارسال…" : "دریافت کد ورود"}
        </Button>
      </form>
    </Form>
  );
}

function EmailLoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "", password: "" },
  });

  async function routeAfterAuth(userId: string) {
    const { data: profile } = await supabase.from("users").select("farm_id").eq("id", userId).single();
    router.push(profile?.farm_id ? "/dashboard" : "/onboarding/farm");
  }

  async function onSubmit(values: EmailValues) {
    setSubmitting(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });
      setSubmitting(false);

      if (error) {
        toast.error(error.message === "User already registered" ? "این ایمیل قبلاً ثبت‌نام کرده — وارد شوید" : "ثبت‌نام ناموفق بود");
        return;
      }
      if (!data.session) {
        toast.info("برای فعال‌سازی، ایمیل خود را بررسی کنید.");
        return;
      }
      await routeAfterAuth(data.session.user.id);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setSubmitting(false);

    if (error || !data.session) {
      toast.error("ایمیل یا رمز عبور نادرست است.");
      return;
    }
    await routeAfterAuth(data.session.user.id);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">ایمیل</FormLabel>
              <FormControl>
                <Input {...field} type="email" dir="ltr" className="h-12 text-lg" autoFocus />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-base">رمز عبور</FormLabel>
              <FormControl>
                <Input {...field} type="password" dir="ltr" className="h-12 text-lg" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="lg" className="h-14 text-lg" disabled={submitting}>
          {submitting ? "در حال بررسی…" : mode === "signup" ? "ثبت‌نام" : "ورود"}
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          className="text-sm text-primary"
        >
          {mode === "signup" ? "قبلاً ثبت‌نام کرده‌اید؟ وارد شوید" : "حساب ندارید؟ ثبت‌نام کنید"}
        </button>
      </form>
    </Form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo variant="full" size={220} />
      </div>

      <Tabs defaultValue="phone" className="w-full max-w-sm">
        <TabsList className="w-full">
          <TabsTrigger value="phone" className="flex-1">شماره موبایل</TabsTrigger>
          <TabsTrigger value="email" className="flex-1">ایمیل (موقت)</TabsTrigger>
        </TabsList>
        <TabsContent value="phone" className="mt-4">
          <PhoneLoginForm />
        </TabsContent>
        <TabsContent value="email" className="mt-4">
          <EmailLoginForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
