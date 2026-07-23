"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

const schema = z.object({
  phone: z.string().refine(isValidIranianPhone, {
    message: "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷)",
  }),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "" },
  });

  async function onSubmit(values: FormValues) {
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
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold text-primary">گله‌یار</h1>
        <p className="text-muted-foreground">دستیار هوشمند مدیریت دامداری</p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full max-w-sm flex-col gap-5"
        >
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
    </div>
  );
}
