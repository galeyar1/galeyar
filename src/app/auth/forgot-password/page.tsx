"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

const schema = z.object({
  email: z.string().email("ایمیل معتبر نیست"),
});

type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: Values) {
    setSubmitting(true);
    // resetPasswordForEmail never reveals whether the account exists — the
    // same generic message is shown regardless of the result, and no error
    // branch here should ever say "email not found".
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setSubmitting(false);
    setSent(true);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-12">
      <Logo variant="full" size={200} />

      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-4 p-6">
          {sent ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="size-10 text-success" />
              <h1 className="text-lg font-bold">بازیابی رمز عبور</h1>
              <p className="text-muted-foreground">
                اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی رمز عبور برای شما ارسال خواهد شد.
              </p>
              <Button variant="outline" asChild className="w-full">
                <Link href="/auth/login">بازگشت به ورود</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-lg font-bold">بازیابی رمز عبور</h1>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base">ایمیل حساب کاربری</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" dir="ltr" className="h-12 text-lg" autoFocus />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="lg" className="h-12 text-lg" disabled={submitting}>
                    {submitting ? "در حال ارسال…" : "ارسال لینک بازیابی"}
                  </Button>
                  <Link href="/auth/login" className="text-center text-sm text-muted-foreground">
                    بازگشت به ورود
                  </Link>
                </form>
              </Form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
