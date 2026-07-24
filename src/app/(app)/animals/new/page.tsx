"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { useLiveQuery } from "dexie-react-hooks";

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
import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { createRecord, updateRecord } from "@/lib/sync/repository";
import { ANIMAL_TYPES_BY_SPECIES, SPECIES_LABELS, breedOptionsFor, DEFAULT_BREED } from "@/lib/animal-labels";
import { todayIso } from "@/lib/jalali";
import type { Species } from "@/lib/supabase/types";

const SPECIES_OPTIONS = Object.keys(SPECIES_LABELS) as Species[];

const schema = z.object({
  ear_tag: z.string().min(1, "شماره پلاک گوش الزامی است"),
  name: z.string().optional(),
  species: z.enum(["sheep", "goat", "cattle", "camel", "horse"]),
  animal_type: z.string().min(1, "انتخاب نوع و جنسیت دام الزامی است"),
  breed: z.string().optional(),
  birth_date: z
    .string()
    .optional()
    .refine((v) => !v || v <= todayIso(), { message: "تاریخ تولد نمی‌تواند در آینده باشد" }),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const EMPTY_VALUES: FormValues = {
  ear_tag: "",
  name: "",
  species: "sheep",
  animal_type: "",
  breed: DEFAULT_BREED,
  birth_date: "",
  notes: "",
};

function AnimalFormPage({ animalId }: { animalId: string | null }) {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const existing = useLiveQuery(
    () => (animalId ? db.animals.get(animalId) : undefined),
    [animalId]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        ear_tag: existing.ear_tag,
        name: existing.name ?? "",
        species: existing.species,
        animal_type: existing.animal_type ?? "",
        breed: existing.breed ?? "",
        birth_date: existing.birth_date ?? "",
        notes: existing.notes ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const species = form.watch("species");
  const typeOptions = ANIMAL_TYPES_BY_SPECIES[species];
  const breedOptions = breedOptionsFor(species);

  async function onSubmit(values: FormValues) {
    if (!profile?.farm_id || !session) {
      toast.error("جلسه کاربری معتبر نیست. لطفاً دوباره وارد شوید.");
      return;
    }
    setSubmitting(true);
    console.log("[animals/new] submitting", { animalId, values });

    const selectedType = typeOptions.find((t) => t.value === values.animal_type);

    const payload = {
      ear_tag: values.ear_tag,
      name: values.name || null,
      species: values.species,
      animal_type: values.animal_type || null,
      breed: values.breed || null,
      gender: selectedType?.gender ?? null,
      birth_date: values.birth_date || null,
      notes: values.notes || null,
    };

    try {
      if (animalId) {
        await updateRecord("animals", animalId, payload);
        console.log("[animals/new] update succeeded", animalId);
        toast.success("دام به‌روزرسانی شد");
        router.push(`/animals/view?id=${animalId}`);
      } else {
        const newId = await createRecord("animals", profile.farm_id, session.user.id, {
          ...payload,
          father_id: null,
          mother_id: null,
          status: "active",
          // Only animals auto-created from a birth record get a generated_id.
          generated_id: null,
          species_code: null,
          birth_year: null,
          offspring_number: null,
          gender_code: null,
        });
        console.log("[animals/new] create succeeded", newId);
        toast.success("دام با موفقیت ثبت شد");
        router.push("/animals");
      }
    } catch (error) {
      console.error("[animals/new] registration failed", error);
      toast.error(
        error instanceof Error ? error.message : "ثبت دام با خطا مواجه شد. لطفاً دوباره تلاش کنید."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{animalId ? "ویرایش دام" : "ثبت دام جدید"}</h1>

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
                    const options = breedOptionsFor(value as Species);
                    form.setValue("breed", options ? DEFAULT_BREED : "");
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
                <FormLabel className="text-base">نژاد{breedOptions ? "" : " (اختیاری)"}</FormLabel>
                <FormControl>
                  {breedOptions ? (
                    <Select onValueChange={field.onChange} value={field.value || DEFAULT_BREED}>
                      <SelectTrigger className="h-12 w-full text-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {breedOptions.map((b) => (
                          <SelectItem key={b} value={b}>
                            {b}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input {...field} className="h-12 text-lg" />
                  )}
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
            {submitting ? "در حال ثبت…" : animalId ? "ذخیره تغییرات" : "ثبت دام"}
          </Button>
        </form>
      </Form>
    </div>
  );
}

function AnimalFormInner() {
  const params = useSearchParams();
  return <AnimalFormPage animalId={params.get("id")} />;
}

export default function NewAnimalPage() {
  return (
    <Suspense fallback={null}>
      <AnimalFormInner />
    </Suspense>
  );
}
