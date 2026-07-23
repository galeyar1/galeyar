"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
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
import { useAuth } from "@/lib/auth/auth-provider";
import { createRecord } from "@/lib/sync/repository";
import { ANIMAL_TYPES_BY_SPECIES, SPECIES_LABELS } from "@/lib/animal-labels";
import type { Species } from "@/lib/supabase/types";

const SPECIES_OPTIONS = Object.keys(SPECIES_LABELS) as Species[];

const schema = z.object({
  ear_tag: z.string().min(1, "شماره پلاک گوش الزامی است"),
  name: z.string().optional(),
  species: z.enum(["sheep", "goat", "cattle", "camel"]),
  animal_type: z.string().optional(),
  breed: z.string().optional(),
  birth_date: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewAnimalPage() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ear_tag: "",
      name: "",
      species: "sheep",
      animal_type: "",
      breed: "",
      birth_date: "",
      notes: "",
    },
  });

  const species = form.watch("species");
  const typeOptions = ANIMAL_TYPES_BY_SPECIES[species];

  async function onSubmit(values: FormValues) {
    if (!profile?.farm_id || !session) return;
    setSubmitting(true);

    const selectedType = typeOptions.find((t) => t.value === values.animal_type);

    await createRecord("animals", profile.farm_id, session.user.id, {
      ear_tag: values.ear_tag,
      name: values.name || null,
      species: values.species,
      animal_type: values.animal_type || null,
      breed: values.breed || null,
      gender: selectedType?.gender ?? null,
      birth_date: values.birth_date || null,
      father_id: null,
      mother_id: null,
      status: "active",
      notes: values.notes || null,
    });

    setSubmitting(false);
    toast.success("دام با موفقیت ثبت شد");
    router.push("/animals");
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">ثبت دام جدید</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <FormField
            control={form.control}
            name="ear_tag"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">شماره پلاک گوش *</FormLabel>
                <FormControl>
                  <Input {...field} className="h-12 text-lg" autoFocus />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="species"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">گونه</FormLabel>
                <Select
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.setValue("animal_type", "");
                  }}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger className="h-12 w-full text-lg">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SPECIES_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SPECIES_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="animal_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">نوع</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12 w-full text-lg">
                      <SelectValue placeholder="انتخاب کنید" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {typeOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">نام (اختیاری)</FormLabel>
                <FormControl>
                  <Input {...field} className="h-12 text-lg" />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="breed"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">نژاد (اختیاری)</FormLabel>
                <FormControl>
                  <Input {...field} className="h-12 text-lg" />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="birth_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">تاریخ تولد (اختیاری)</FormLabel>
                <FormControl>
                  <PersianDatePicker
                    value={field.value}
                    onChange={(iso) => field.onChange(iso ?? "")}
                    className="h-12 text-lg"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">یادداشت (اختیاری)</FormLabel>
                <FormControl>
                  <Textarea {...field} rows={3} />
                </FormControl>
              </FormItem>
            )}
          />

          <Button type="submit" size="lg" className="h-14 text-lg" disabled={submitting}>
            {submitting ? "در حال ثبت…" : "ثبت دام"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
