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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { createRecord, updateRecord } from "@/lib/sync/repository";
import { ANIMAL_TYPES_BY_SPECIES, SPECIES_LABELS, breedOptionsFor, DEFAULT_BREED } from "@/lib/animal-labels";
import { ACQUISITION_TYPE_LABELS } from "@/lib/acquisition-type";
import { estimateBirthDateFromAgeMonths, isValidAgeMonths, MAX_AGE_MONTHS } from "@/lib/animal-age";
import { todayIso, toPersianDigits } from "@/lib/jalali";
import { canBePregnant, computeExpectedBirthDate, MAX_PREGNANCY_MONTH } from "@/lib/pregnancy";
import { useFarmPlan } from "@/lib/hooks/use-farm-plan";
import { isAtAnimalLimit, PLAN_LABELS } from "@/lib/subscription-plans";
import { BulkRegisterWizard } from "./bulk-register-wizard";
import type { AcquisitionType, Species } from "@/lib/supabase/types";

const SPECIES_OPTIONS = Object.keys(SPECIES_LABELS) as Species[];
const ACQUISITION_OPTIONS: AcquisitionType[] = ["purchase", "born_on_farm", "transfer", "other"];

const schema = z
  .object({
    ear_tag: z.string().min(1, "شماره پلاک گوش الزامی است"),
    name: z.string().optional(),
    species: z.enum(["sheep", "goat", "cattle", "camel", "horse"]),
    animal_type: z.string().min(1, "انتخاب نوع و جنسیت دام الزامی است"),
    breed: z.string().optional(),
    ageEntryMode: z.enum(["birth_date", "age_months"]),
    birth_date: z
      .string()
      .optional()
      .refine((v) => !v || v <= todayIso(), { message: "تاریخ تولد نمی‌تواند در آینده باشد" }),
    age_months: z.string().optional(),
    weight: z.string().optional(),
    is_pregnant: z.boolean().optional(),
    pregnancy_month: z.string().optional(),
    acquisition_type: z.enum(["purchase", "born_on_farm", "transfer", "other"]),
    purchase_price: z.string().optional(),
    purchase_date: z.string().optional(),
    seller: z.string().optional(),
    purchase_notes: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((v) => v.ageEntryMode !== "age_months" || !v.age_months || isValidAgeMonths(v.age_months), {
    message: `سن باید بین ۰ تا ${MAX_AGE_MONTHS} ماه باشد`,
    path: ["age_months"],
  })
  .refine((v) => !v.weight || (Number(v.weight) > 0 && Number.isFinite(Number(v.weight))), {
    message: "وزن باید عددی بزرگ‌تر از صفر باشد",
    path: ["weight"],
  })
  .refine((v) => !v.purchase_price || Number(v.purchase_price) >= 0, {
    message: "قیمت خرید نمی‌تواند منفی باشد",
    path: ["purchase_price"],
  });

type FormValues = z.infer<typeof schema>;

const EMPTY_VALUES: FormValues = {
  ear_tag: "",
  name: "",
  species: "sheep",
  animal_type: "",
  breed: DEFAULT_BREED,
  ageEntryMode: "birth_date",
  birth_date: "",
  age_months: "",
  weight: "",
  is_pregnant: false,
  pregnancy_month: "",
  acquisition_type: "other",
  purchase_price: "",
  purchase_date: todayIso(),
  seller: "",
  purchase_notes: "",
  notes: "",
};

function AnimalFormPage({ animalId }: { animalId: string | null }) {
  const router = useRouter();
  const { profile, session } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");

  const existing = useLiveQuery(
    () => (animalId ? db.animals.get(animalId) : undefined),
    [animalId]
  );

  const { effectivePlan: plan, limits, loading: planLoading } = useFarmPlan();
  const activeAnimalCount = useLiveQuery(async () => {
    if (!profile?.farm_id) return null;
    const rows = await db.animals.where("farm_id").equals(profile.farm_id).toArray();
    return rows.filter((a) => !a.deleted_at && a.status === "active").length;
  }, [profile?.farm_id]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  });

  useEffect(() => {
    if (existing) {
      form.reset({
        ...EMPTY_VALUES,
        ear_tag: existing.ear_tag,
        name: existing.name ?? "",
        species: existing.species,
        animal_type: existing.animal_type ?? "",
        breed: existing.breed ?? "",
        // Editing always shows the exact birth_date field — age-in-months is
        // only a creation-time input convenience, never re-derived on edit.
        ageEntryMode: "birth_date",
        birth_date: existing.birth_date ?? "",
        is_pregnant: existing.is_pregnant ?? false,
        pregnancy_month: existing.pregnancy_month ? String(existing.pregnancy_month) : "",
        acquisition_type: (existing.acquisition_type as FormValues["acquisition_type"]) ?? "other",
        notes: existing.notes ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const species = form.watch("species");
  const animalType = form.watch("animal_type");
  const isPregnant = form.watch("is_pregnant");
  const ageEntryMode = form.watch("ageEntryMode");
  const acquisitionType = form.watch("acquisition_type");
  const typeOptions = ANIMAL_TYPES_BY_SPECIES[species];
  const breedOptions = breedOptionsFor(species);
  const pregnancyEligible = canBePregnant(species, animalType);
  const maxPregnancyMonth = MAX_PREGNANCY_MONTH[species];

  // If the species/type changes away from a pregnancy-eligible one, clear
  // any pregnancy state instead of silently keeping stale hidden data.
  useEffect(() => {
    if (!pregnancyEligible && (form.getValues("is_pregnant") || form.getValues("pregnancy_month"))) {
      form.setValue("is_pregnant", false);
      form.setValue("pregnancy_month", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pregnancyEligible]);

  async function onSubmit(values: FormValues) {
    if (!profile?.farm_id || !session) {
      toast.error("جلسه کاربری معتبر نیست. لطفاً دوباره وارد شوید.");
      return;
    }
    setSubmitting(true);
    console.log("[animals/new] submitting", { animalId, values });

    const selectedType = typeOptions.find((t) => t.value === values.animal_type);
    const eligible = canBePregnant(values.species, values.animal_type);
    const pregnant = eligible && !!values.is_pregnant && !!values.pregnancy_month;
    const pregnancyMonthNum = pregnant ? Number(values.pregnancy_month) : null;

    // Age-in-months is only ever a creation-time input convenience — edit
    // mode always uses ageEntryMode "birth_date", so this only estimates
    // when the user actually picked that mode while registering.
    const usingAgeMonths =
      !animalId && values.ageEntryMode === "age_months" && values.age_months && isValidAgeMonths(values.age_months);
    const birthDate = usingAgeMonths
      ? estimateBirthDateFromAgeMonths(Number(values.age_months), todayIso())
      : values.birth_date || null;

    const payload = {
      ear_tag: values.ear_tag,
      name: values.name || null,
      species: values.species,
      animal_type: values.animal_type || null,
      breed: values.breed || null,
      gender: selectedType?.gender ?? null,
      birth_date: birthDate,
      birth_date_is_estimated: !!usingAgeMonths,
      is_pregnant: pregnant,
      pregnancy_month: pregnancyMonthNum,
      expected_birth_date: pregnant
        ? computeExpectedBirthDate(values.species, pregnancyMonthNum!, todayIso())
        : null,
      acquisition_type: values.acquisition_type,
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
          batch_id: null,
          status: "active",
          // Only animals auto-created from a birth record get a generated_id
          // or a predicted genetics value.
          generated_id: null,
          species_code: null,
          birth_year: null,
          offspring_number: null,
          gender_code: null,
          predicted_genetics: null,
          confirmed_genetics: null,
          genetics_source: null,
          genetic_score: null,
        });

        if (values.weight && Number(values.weight) > 0) {
          await createRecord("weight_records", profile.farm_id, session.user.id, {
            animal_id: newId,
            weight: Number(values.weight),
            record_date: todayIso(),
          });
        }

        if (values.acquisition_type === "purchase" && values.purchase_price && Number(values.purchase_price) >= 0) {
          await createRecord("financial_transactions", profile.farm_id, session.user.id, {
            type: "expense",
            category: "animal_purchase",
            amount: Number(values.purchase_price),
            transaction_date: values.purchase_date || todayIso(),
            description: values.purchase_notes || null,
            party_name: values.seller || null,
            animal_id: newId,
            batch_id: null,
            due_date: null,
            is_settled: true,
          });
        }

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

  if (!animalId && !planLoading && typeof activeAnimalCount === "number" && isAtAnimalLimit(limits, activeAnimalCount)) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-xl font-bold">ثبت دام جدید</h1>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <Lock className="size-8 text-muted-foreground" />
            <p className="text-base font-semibold">
              پلن {PLAN_LABELS[plan]} شما اجازه ثبت حداکثر {toPersianDigits(limits.maxAnimals ?? 0)} دام فعال را می‌دهد.
            </p>
            <Button asChild>
              <Link href="/subscriptions">ارتقا پلن</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold">{animalId ? "ویرایش دام" : "ثبت دام جدید"}</h1>

      {!animalId && (
        <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "bulk")}>
          <TabsList className="w-full">
            <TabsTrigger value="single" className="flex-1">
              ثبت تکی
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex-1">
              ثبت گروهی
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {!animalId && mode === "bulk" ? (
        <BulkRegisterWizard />
      ) : (
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

          {animalId ? (
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
          ) : (
            <div className="flex flex-col gap-2">
              <FormField
                control={form.control}
                name="ageEntryMode"
                render={({ field }) => (
                  <Tabs value={field.value} onValueChange={field.onChange}>
                    <TabsList className="w-full">
                      <TabsTrigger value="birth_date" className="flex-1">
                        تاریخ تولد
                      </TabsTrigger>
                      <TabsTrigger value="age_months" className="flex-1">
                        سن به ماه
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              />

              {ageEntryMode === "birth_date" ? (
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
              ) : (
                <FormField
                  control={form.control}
                  name="age_months"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">سن به ماه (اختیاری)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" inputMode="numeric" min={0} className="h-12 text-lg" />
                      </FormControl>
                      <FormMessage />
                      {!!field.value && isValidAgeMonths(field.value) && (
                        <p className="text-xs text-muted-foreground">
                          تاریخ تولد تقریبی: {estimateBirthDateFromAgeMonths(Number(field.value), todayIso())}
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}

          <FormField
            control={form.control}
            name="acquisition_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-base">نحوه ورود به گله</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="h-12 w-full text-lg">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ACQUISITION_OPTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {ACQUISITION_TYPE_LABELS[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          {!animalId && acquisitionType === "purchase" && (
            <Card>
              <CardContent className="flex flex-col gap-3 p-4">
                <h3 className="font-semibold">اطلاعات خرید (اختیاری)</h3>

                <FormField
                  control={form.control}
                  name="purchase_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">قیمت خرید (تومان)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" inputMode="numeric" className="h-12 text-lg" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchase_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">تاریخ خرید</FormLabel>
                      <FormControl>
                        <PersianDatePicker
                          value={field.value}
                          onChange={(iso) => field.onChange(iso ?? todayIso())}
                          className="h-12 text-lg"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="seller"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">فروشنده (اختیاری)</FormLabel>
                      <FormControl>
                        <Input {...field} className="h-12 text-lg" />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="purchase_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm text-muted-foreground">توضیحات خرید (اختیاری)</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {!animalId && (
            <FormField
              control={form.control}
              name="weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base">وزن (کیلوگرم، اختیاری)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" inputMode="decimal" className="h-12 text-lg" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {pregnancyEligible && (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted p-3">
              <FormField
                control={form.control}
                name="is_pregnant"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between gap-2">
                    <FormLabel className="text-base">آبستن</FormLabel>
                    <FormControl>
                      <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isPregnant && (
                <FormField
                  control={form.control}
                  name="pregnancy_month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">ماه آبستنی</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 w-full text-lg">
                            <SelectValue placeholder="انتخاب کنید" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: maxPregnancyMonth }, (_, i) => i + 1).map((m) => (
                            <SelectItem key={m} value={String(m)}>
                              ماه {toPersianDigits(m)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}
            </div>
          )}

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
      )}
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
