"use client";

import { useState } from "react";
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
import { triggerSync } from "@/lib/sync/engine";

const schema = z.object({
  farm_name: z.string().min(2, "نام مزرعه را وارد کنید"),
  province: z.string().min(1, "استان را انتخاب کنید"),
  city: z.string().min(1, "شهرستان را وارد کنید"),
});

type FormValues = z.infer<typeof schema>;

interface FarmFormProps {
  submitLabel: string;
  onSuccess: () => void;
}

/**
 * Creates a farm and switches the owner into it. Used both for the very
 * first farm (onboarding, users.farm_id: null -> value) and for an owner
 * adding another farm later (users.farm_id: A -> B) — the two only differ
 * in what was true before the insert, not in what this component does:
 * insert farms, register a farm_members row (satisfies the "farm_id can
 * only change to a farm you belong to" guard), then point users.farm_id at
 * the new farm.
 */
export function FarmForm({ submitLabel, onSuccess }: FarmFormProps) {
  const { session, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { farm_name: "", province: "", city: "" },
  });

  async function onSubmit(values: FormValues) {
    if (!session) return;
    setSubmitting(true);

    // Generated client-side and inserted without .select(): right after this
    // insert, current_farm_id() (used by farms_select_own's RLS policy) may
    // still point at a different farm — asking PostgREST to return the row
    // via RETURNING would fail the SELECT policy on it. Not needing the row
    // back sidesteps that entirely.
    const farmId = crypto.randomUUID();

    const { error: farmError } = await supabase
      .from("farms")
      .insert({ id: farmId, farm_name: values.farm_name, province: values.province, city: values.city });

    if (farmError) {
      setSubmitting(false);
      toast.error(`ثبت مزرعه ناموفق بود: ${farmError.message}`);
      return;
    }

    const { error: memberError } = await supabase
      .from("farm_members")
      .insert({ farm_id: farmId, user_id: session.user.id });

    if (memberError) {
      setSubmitting(false);
      toast.error(`ثبت عضویت مزرعه ناموفق بود: ${memberError.message}`);
      return;
    }

    const { error: userError } = await supabase
      .from("users")
      .update({ farm_id: farmId })
      .eq("id", session.user.id);

    setSubmitting(false);

    if (userError) {
      toast.error(`اتصال مزرعه به حساب شما ناموفق بود: ${userError.message}`);
      return;
    }

    await refreshProfile();
    void triggerSync();
    toast.success("مزرعه با موفقیت ثبت شد.");
    onSuccess();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full max-w-sm flex-col gap-5">
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
          {submitting ? "در حال ثبت…" : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
