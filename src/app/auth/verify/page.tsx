"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { toPersianDigits } from "@/lib/jalali";

const schema = z.object({
  code: z.string().min(4, "کد را کامل وارد کنید").max(8),
});

type FormValues = z.infer<typeof schema>;

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") ?? "";
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: "" },
  });

  async function onSubmit(values: FormValues) {
    if (!phone) {
      toast.error("شماره موبایل یافت نشد، دوباره از ابتدا وارد شوید.");
      router.push("/auth/login");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: values.code,
      type: "sms",
    });

    if (error || !data.user) {
      setSubmitting(false);
      toast.error("کد وارد شده نادرست یا منقضی شده است.");
      return;
    }

    const { data: profile } = await supabase
      .from("users")
      .select("farm_id")
      .eq("id", data.user.id)
      .single();

    setSubmitting(false);
    router.push(profile?.farm_id ? "/dashboard" : "/onboarding/farm");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold text-primary">تایید شماره موبایل</h1>
        <p className="text-muted-foreground">
          کد ارسال شده به {phone ? toPersianDigits(phone) : "شماره شما"} را وارد کنید
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full max-w-sm flex-col gap-5"
        >
          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">کد تایید</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    inputMode="numeric"
                    placeholder="—  —  —  —  —"
                    className="h-14 text-center text-2xl tracking-[0.5em]"
                    dir="ltr"
                    autoFocus
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" className="h-14 text-lg" disabled={submitting}>
            {submitting ? "در حال بررسی…" : "تایید و ورود"}
          </Button>
        </form>
      </Form>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}
