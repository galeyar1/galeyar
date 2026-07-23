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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth/auth-provider";
import { IRAN_PROVINCES } from "@/lib/iran-provinces";

const schema = z.object({
  farm_name: z.string().min(2, "نام مزرعه را وارد کنید"),
  province: z.string().min(1, "استان را انتخاب کنید"),
  city: z.string().min(1, "شهرستان را وارد کنید"),
});

type FormValues = z.infer<typeof schema>;

export default function CreateFarmPage() {
  const router = useRouter();
  const { session, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { farm_name: "", province: "", city: "" },
  });

  async function onSubmit(values: FormValues) {
    if (!session) {
      router.push("/auth/login");
      return;
    }

    setSubmitting(true);

    // Generated client-side and inserted without .select(): right after this
    // insert, current_farm_id() (used by farms_select_own's RLS policy) is
    // still null — the user hasn't been attached to a farm yet — so asking
    // PostgREST to return the row via RETURNING fails the SELECT policy on
    // it and the whole insert rolls back. Not needing the row back sidesteps
    // that chicken-and-egg problem entirely.
    const farmId = crypto.randomUUID();

    const { error: farmError } = await supabase
      .from("farms")
      .insert({ id: farmId, farm_name: values.farm_name, province: values.province, city: values.city });

    if (farmError) {
      setSubmitting(false);
      toast.error("ثبت مزرعه ناموفق بود. دوباره تلاش کنید.");
      return;
    }

    const { error: userError } = await supabase
      .from("users")
      .update({ farm_id: farmId })
      .eq("id", session.user.id);

    setSubmitting(false);

    if (userError) {
      toast.error("اتصال مزرعه به حساب شما ناموفق بود.");
      return;
    }

    await refreshProfile();
    toast.success("مزرعه با موفقیت ثبت شد.");
    router.push("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-background px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold text-primary">ثبت مزرعه شما</h1>
        <p className="text-muted-foreground">اطلاعات پایه دامداری را وارد کنید</p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full max-w-sm flex-col gap-5"
        >
          <FormField
            control={form.control}
            name="farm_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">نام مزرعه</FormLabel>
                <FormControl>
                  <Input {...field} className="h-12 text-lg" placeholder="دامداری آفتاب" autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="province"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">استان</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12 w-full text-lg">
                      <SelectValue placeholder="انتخاب استان" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {IRAN_PROVINCES.map((province) => (
                      <SelectItem key={province} value={province}>
                        {province}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">شهرستان</FormLabel>
                <FormControl>
                  <Input {...field} className="h-12 text-lg" placeholder="مثلا: مرودشت" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" className="h-14 text-lg" disabled={submitting}>
            {submitting ? "در حال ثبت…" : "ثبت مزرعه و ادامه"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
