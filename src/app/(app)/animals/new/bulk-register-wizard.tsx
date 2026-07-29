"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import { Lock, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PersianDatePicker } from "@/components/ui/persian-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { db } from "@/lib/db/schema";
import { useFarmPlan } from "@/lib/hooks/use-farm-plan";
import { isAtAnimalLimit, PLAN_LABELS } from "@/lib/subscription-plans";
import { ANIMAL_TYPES_BY_SPECIES, SPECIES_LABELS, breedOptionsFor, DEFAULT_BREED } from "@/lib/animal-labels";
import { ACQUISITION_TYPE_LABELS } from "@/lib/acquisition-type";
import { estimateBirthDateFromAgeMonths, isValidAgeMonths } from "@/lib/animal-age";
import { todayIso, toPersianDigits, isoToJalali, JALALI_MONTHS } from "@/lib/jalali";
import type { Animal, AcquisitionType, Species } from "@/lib/supabase/types";

type WizardStep = "shared" | "tags" | "preview" | "confirm" | "success";
type AgeMode = "birth_date" | "age_months";

interface PreviewAnimal {
  key: string;
  ear_tag: string;
  animal_type: string;
  breed: string;
  weight: string;
  birth_date: string;
  age_months: string;
  notes: string;
}

const ACQUISITION_OPTIONS: AcquisitionType[] = ["purchase", "born_on_farm", "transfer", "other"];
const SPECIES_OPTIONS = Object.keys(SPECIES_LABELS) as Species[];
const MAX_QUANTITY = 200;

function bulkErrorMessage(error?: string, tag?: string): string {
  switch (error) {
    case "not_authorized":
      return "شما اجازه ثبت دام در این مزرعه را ندارید.";
    case "purchase_requires_owner":
      return "فقط مالک مزرعه می‌تواند اطلاعات خرید را ثبت کند — می‌توانید بدون قیمت ثبت کنید.";
    case "invalid_acquisition_type":
      return "نحوه ورود به گله نامعتبر است.";
    case "invalid_quantity":
      return `تعداد باید بین ۱ تا ${toPersianDigits(MAX_QUANTITY)} باشد.`;
    case "plan_limit_exceeded":
      return "ظرفیت پلن شما برای این تعداد دام کافی نیست. لطفاً پلن خود را ارتقا دهید.";
    case "duplicate_tags_in_batch":
      return "در لیست دام‌ها پلاک تکراری وجود دارد.";
    case "tag_conflict":
      return `پلاک «${tag}» قبلاً برای دام دیگری در این مزرعه ثبت شده است.`;
    case "no_farm":
      return "مزرعه‌ای برای شما یافت نشد.";
    default:
      return "ثبت گروهی دام با خطا مواجه شد. لطفاً دوباره تلاش کنید.";
  }
}

export function BulkRegisterWizard() {
  const router = useRouter();
  const { profile, session } = useAuth();
  const { effectivePlan: plan, limits, loading: planLoading } = useFarmPlan();
  const activeAnimalCount = useLiveQuery(async () => {
    if (!profile?.farm_id) return null;
    const rows = await db.animals.where("farm_id").equals(profile.farm_id).toArray();
    return rows.filter((a) => !a.deleted_at && a.status === "active").length;
  }, [profile?.farm_id]);

  const [step, setStep] = useState<WizardStep>("shared");
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // Shared fields
  const [species, setSpecies] = useState<Species>("sheep");
  const [breed, setBreed] = useState(DEFAULT_BREED);
  const [animalType, setAnimalType] = useState("");
  const [quantity, setQuantity] = useState("25");
  const [entryDate, setEntryDate] = useState(todayIso());
  const [avgWeight, setAvgWeight] = useState("");
  const [ageMode, setAgeMode] = useState<AgeMode>("age_months");
  const [sharedAgeMonths, setSharedAgeMonths] = useState("");
  const [sharedBirthDate, setSharedBirthDate] = useState("");
  const [sharedNotes, setSharedNotes] = useState("");
  const [acquisitionType, setAcquisitionType] = useState<AcquisitionType>("purchase");

  // Purchase fields
  const [pricingMethod, setPricingMethod] = useState<"per_animal" | "total">("per_animal");
  const [pricePerAnimal, setPricePerAnimal] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayIso());
  const [purchaseDateTouched, setPurchaseDateTouched] = useState(false);
  const [seller, setSeller] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");

  // Tag configuration
  const [tagMode, setTagMode] = useState<"auto" | "manual">("auto");
  const [tagPrefix, setTagPrefix] = useState("");
  const [startNumber, setStartNumber] = useState("");
  const [checkingTags, setCheckingTags] = useState(false);

  // Preview / per-animal editing
  const [animals, setAnimals] = useState<PreviewAnimal[]>([]);

  // Batch name
  const [batchName, setBatchName] = useState("");
  const [batchNameTouched, setBatchNameTouched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    batchId: string;
    animalCount: number;
    financialTransactionId: string | null;
  } | null>(null);

  const breedOptions = breedOptionsFor(species);
  const typeOptions = ANIMAL_TYPES_BY_SPECIES[species];
  const quantityNum = Math.max(0, parseInt(quantity, 10) || 0);

  useEffect(() => {
    setAnimalType("");
    setBreed(breedOptionsFor(species) ? DEFAULT_BREED : "");
  }, [species]);

  useEffect(() => {
    if (!purchaseDateTouched) setPurchaseDate(entryDate);
  }, [entryDate, purchaseDateTouched]);

  const defaultBatchName = useMemo(() => {
    const { jy, jm } = isoToJalali(entryDate || todayIso());
    const label = breed || SPECIES_LABELS[species];
    return `${label} ${ACQUISITION_TYPE_LABELS[acquisitionType]} ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
  }, [species, breed, acquisitionType, entryDate]);

  useEffect(() => {
    if (!batchNameTouched) setBatchName(defaultBatchName);
  }, [defaultBatchName, batchNameTouched]);

  useEffect(() => {
    if (tagMode === "auto" && step === "tags" && !startNumber) {
      supabase.rpc("suggest_next_tag_number").then(({ data }) => {
        if (typeof data === "number") setStartNumber(String(data));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, tagMode]);

  const calculatedTotal = useMemo(() => {
    if (acquisitionType !== "purchase") return null;
    if (pricingMethod === "per_animal") {
      const p = Number(pricePerAnimal);
      if (!pricePerAnimal || Number.isNaN(p)) return null;
      return p * quantityNum;
    }
    const t = Number(totalPrice);
    if (!totalPrice || Number.isNaN(t)) return null;
    return t;
  }, [acquisitionType, pricingMethod, pricePerAnimal, totalPrice, quantityNum]);

  const perAnimalEffective = useMemo(() => {
    if (acquisitionType !== "purchase" || pricingMethod !== "total" || quantityNum === 0) return null;
    const t = Number(totalPrice);
    if (!totalPrice || Number.isNaN(t)) return null;
    return t / quantityNum;
  }, [acquisitionType, pricingMethod, totalPrice, quantityNum]);

  function goToTagsStep() {
    if (quantityNum < 1 || quantityNum > MAX_QUANTITY) {
      toast.error(`تعداد باید بین ۱ تا ${toPersianDigits(MAX_QUANTITY)} باشد`);
      return;
    }
    if (!animalType) {
      toast.error("انتخاب نوع و جنسیت دام الزامی است");
      return;
    }
    if (typeof activeAnimalCount === "number" && isAtAnimalLimit(limits, activeAnimalCount + quantityNum - 1)) {
      toast.error(`پلن ${PLAN_LABELS[plan]} شما ظرفیت کافی برای ثبت این تعداد دام را ندارد.`);
      return;
    }
    setStep("tags");
  }

  async function checkTagRange(tags: string[]): Promise<string[]> {
    if (!profile?.farm_id) return [];
    setCheckingTags(true);
    const { data } = await supabase
      .from("animals")
      .select("ear_tag")
      .eq("farm_id", profile.farm_id)
      .is("deleted_at", null)
      .in("ear_tag", tags);
    setCheckingTags(false);
    return (data ?? []).map((r) => r.ear_tag as string);
  }

  function buildAnimals(tags: string[]): PreviewAnimal[] {
    return tags.map((tag, i) => ({
      key: `${i}`,
      ear_tag: tag,
      animal_type: animalType,
      breed,
      weight: avgWeight,
      birth_date: sharedBirthDate,
      age_months: sharedAgeMonths,
      notes: "",
    }));
  }

  async function goToPreviewStep() {
    if (tagMode === "auto") {
      const start = parseInt(startNumber, 10);
      if (!startNumber || Number.isNaN(start) || start < 1) {
        toast.error("شماره شروع پلاک معتبر نیست");
        return;
      }
      const tags = Array.from({ length: quantityNum }, (_, i) => `${tagPrefix}${start + i}`);
      const conflicts = await checkTagRange(tags);
      if (conflicts.length > 0) {
        toast.error(`این بازه با ${toPersianDigits(conflicts.length)} پلاک موجود تداخل دارد — شماره شروع دیگری انتخاب کنید.`, {
          description: conflicts.slice(0, 5).join("، "),
        });
        return;
      }
      setAnimals(buildAnimals(tags));
    } else {
      setAnimals(buildAnimals(Array.from({ length: quantityNum }, () => "")));
    }
    setStep("preview");
  }

  function updateAnimal(key: string, patch: Partial<PreviewAnimal>) {
    setAnimals((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }

  const duplicateTags = useMemo(() => {
    const seen = new Map<string, number>();
    for (const a of animals) {
      const tag = a.ear_tag.trim();
      if (!tag) continue;
      seen.set(tag, (seen.get(tag) ?? 0) + 1);
    }
    return new Set([...seen.entries()].filter(([, c]) => c > 1).map(([t]) => t));
  }, [animals]);

  const previewValid =
    animals.length > 0 && animals.every((a) => a.ear_tag.trim().length > 0 && a.animal_type) && duplicateTags.size === 0;

  function goToConfirmStep() {
    if (!previewValid) {
      toast.error(duplicateTags.size > 0 ? "پلاک‌های تکراری را اصلاح کنید" : "همه دام‌ها باید پلاک و نوع/جنسیت داشته باشند");
      return;
    }
    setStep("confirm");
  }

  async function submit() {
    if (!profile?.farm_id || !session || submitting) return;
    setSubmitting(true);

    try {
      const purchasePayload =
        acquisitionType === "purchase" && calculatedTotal !== null
          ? {
              amount: calculatedTotal,
              transaction_date: purchaseDate,
              party_name: seller.trim() || null,
              notes: purchaseNotes.trim() || null,
            }
          : null;

      const { data, error } = await supabase.rpc("bulk_register_animals", {
        p_idempotency_key: idempotencyKey,
        p_batch_name: batchName.trim() || defaultBatchName,
        p_species: species,
        p_breed: breed || null,
        p_acquisition_type: acquisitionType,
        p_entry_date: entryDate,
        p_notes: sharedNotes.trim() || null,
        p_animals: animals.map((a) => {
          const useAgeMonths = ageMode === "age_months" && a.age_months && isValidAgeMonths(a.age_months);
          const birthDate = useAgeMonths
            ? estimateBirthDateFromAgeMonths(Number(a.age_months), entryDate)
            : a.birth_date || null;
          return {
            ear_tag: a.ear_tag.trim(),
            animal_type: a.animal_type,
            gender: typeOptions.find((t) => t.value === a.animal_type)?.gender ?? null,
            breed: a.breed || null,
            birth_date: birthDate,
            birth_date_is_estimated: !!useAgeMonths,
            weight: a.weight || null,
            notes: a.notes.trim() || null,
          };
        }),
        p_purchase: purchasePayload,
      });

      if (error) throw error;

      const res = data as {
        ok: boolean;
        error?: string;
        tag?: string;
        batch_id?: string;
        animals?: Animal[];
        financial_transaction_id?: string | null;
      };

      if (!res.ok) {
        toast.error(bulkErrorMessage(res.error, res.tag));
        setSubmitting(false);
        return;
      }

      if (res.animals?.length) {
        await db.animals.bulkPut(res.animals.map((a) => ({ ...a, sync_status: "synced" as const })));
      }

      setResult({
        batchId: res.batch_id!,
        animalCount: res.animals?.length ?? 0,
        financialTransactionId: res.financial_transaction_id ?? null,
      });
      setStep("success");
    } catch (error) {
      console.error("[bulk-register] failed", error);
      toast.error(error instanceof Error ? error.message : "ثبت گروهی دام با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!planLoading && typeof activeAnimalCount === "number" && isAtAnimalLimit(limits, activeAnimalCount)) {
    return (
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
    );
  }

  if (step === "success" && result) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <CheckCircle2 className="size-12 text-success" />
          <h2 className="text-lg font-bold">
            {toPersianDigits(result.animalCount)} دام با موفقیت به گله اضافه شدند.
          </h2>
          {result.financialTransactionId && (
            <p className="text-sm text-muted-foreground">یک تراکنش خرید هم در کسب‌وکار ثبت شد.</p>
          )}
          <div className="flex w-full flex-col gap-2">
            <Button className="h-12 text-lg" onClick={() => router.push("/animals")}>
              مشاهده دام‌های ثبت‌شده
            </Button>
            {result.financialTransactionId && (
              <Button variant="outline" className="h-12 text-lg" onClick={() => router.push("/business/finance")}>
                مشاهده خرید در کسب‌وکار
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {step === "shared" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-base">نوع دام</label>
            <Select value={species} onValueChange={(v) => setSpecies(v as Species)}>
              <SelectTrigger className="h-12 w-full text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPECIES_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SPECIES_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-base">نژاد{breedOptions ? "" : " (اختیاری)"}</label>
            {breedOptions ? (
              <Select value={breed || DEFAULT_BREED} onValueChange={setBreed}>
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
              <Input value={breed} onChange={(e) => setBreed(e.target.value)} className="h-12 text-lg" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-base">جنسیت و نوع</label>
            <Select value={animalType} onValueChange={setAnimalType}>
              <SelectTrigger className="h-12 w-full text-lg">
                <SelectValue placeholder="انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-base">تعداد</label>
            <Input
              type="number"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="h-12 text-lg"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-base">تاریخ ورود به گله</label>
            <PersianDatePicker value={entryDate} onChange={(iso) => setEntryDate(iso ?? todayIso())} className="h-12 text-lg" />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-base">میانگین وزن (کیلوگرم، اختیاری)</label>
            <Input
              type="number"
              inputMode="decimal"
              value={avgWeight}
              onChange={(e) => setAvgWeight(e.target.value)}
              className="h-12 text-lg"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-base">سن یا تاریخ تولد (اختیاری)</label>
            <Tabs value={ageMode} onValueChange={(v) => setAgeMode(v as AgeMode)}>
              <TabsList className="w-full">
                <TabsTrigger value="age_months" className="flex-1">
                  سن به ماه
                </TabsTrigger>
                <TabsTrigger value="birth_date" className="flex-1">
                  تاریخ تولد
                </TabsTrigger>
              </TabsList>
            </Tabs>
            {ageMode === "age_months" ? (
              <>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="سن تقریبی (ماه)"
                  value={sharedAgeMonths}
                  onChange={(e) => setSharedAgeMonths(e.target.value)}
                  className="h-12 text-lg"
                />
                {sharedAgeMonths && isValidAgeMonths(sharedAgeMonths) && (
                  <p className="text-xs text-muted-foreground">
                    تاریخ تولد تقریبی: {estimateBirthDateFromAgeMonths(Number(sharedAgeMonths), entryDate)}
                  </p>
                )}
              </>
            ) : (
              <PersianDatePicker value={sharedBirthDate} onChange={(iso) => setSharedBirthDate(iso ?? "")} className="h-12 text-lg" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-base">یادداشت مشترک (اختیاری)</label>
            <Textarea value={sharedNotes} onChange={(e) => setSharedNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <label className="text-base">نحوه ورود به گله</label>
            <Select value={acquisitionType} onValueChange={(v) => setAcquisitionType(v as AcquisitionType)}>
              <SelectTrigger className="h-12 w-full text-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACQUISITION_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACQUISITION_TYPE_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {acquisitionType === "purchase" && (
            <Card>
              <CardContent className="flex flex-col gap-3 p-4">
                <h3 className="font-semibold">اطلاعات خرید (اختیاری)</h3>

                <Tabs value={pricingMethod} onValueChange={(v) => setPricingMethod(v as "per_animal" | "total")}>
                  <TabsList className="w-full">
                    <TabsTrigger value="per_animal" className="flex-1">
                      قیمت هر رأس
                    </TabsTrigger>
                    <TabsTrigger value="total" className="flex-1">
                      قیمت کل خرید
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {pricingMethod === "per_animal" ? (
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="قیمت هر رأس (تومان)"
                    value={pricePerAnimal}
                    onChange={(e) => setPricePerAnimal(e.target.value)}
                    className="h-12 text-lg"
                  />
                ) : (
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="قیمت کل خرید (تومان)"
                    value={totalPrice}
                    onChange={(e) => setTotalPrice(e.target.value)}
                    className="h-12 text-lg"
                  />
                )}

                {calculatedTotal !== null && (
                  <p className="text-sm text-muted-foreground">
                    {pricingMethod === "per_animal"
                      ? `قیمت کل خرید: ${toPersianDigits(calculatedTotal.toLocaleString())} تومان`
                      : perAnimalEffective !== null &&
                        `قیمت تقریبی هر رأس: ${toPersianDigits(Math.round(perAnimalEffective).toLocaleString())} تومان`}
                  </p>
                )}

                <label className="text-sm text-muted-foreground">تاریخ خرید</label>
                <PersianDatePicker
                  value={purchaseDate}
                  onChange={(iso) => {
                    setPurchaseDateTouched(true);
                    setPurchaseDate(iso ?? todayIso());
                  }}
                  className="h-12 text-lg"
                />

                <label className="text-sm text-muted-foreground">فروشنده (اختیاری)</label>
                <Input value={seller} onChange={(e) => setSeller(e.target.value)} className="h-12 text-lg" />

                <label className="text-sm text-muted-foreground">توضیحات خرید (اختیاری)</label>
                <Textarea value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)} rows={2} />
              </CardContent>
            </Card>
          )}

          <Button size="lg" className="h-14 text-lg" onClick={goToTagsStep}>
            مرحله بعد
          </Button>
        </div>
      )}

      {step === "tags" && (
        <div className="flex flex-col gap-4">
          <Tabs value={tagMode} onValueChange={(v) => setTagMode(v as "auto" | "manual")}>
            <TabsList className="w-full">
              <TabsTrigger value="auto" className="flex-1">
                پلاک خودکار
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1">
                پلاک دستی
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tagMode === "auto" ? (
            <>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted-foreground">پیشوند پلاک (اختیاری)</label>
                <Input value={tagPrefix} onChange={(e) => setTagPrefix(e.target.value)} className="h-12 text-lg" dir="ltr" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm text-muted-foreground">شروع پلاک</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={startNumber}
                  onChange={(e) => setStartNumber(e.target.value)}
                  className="h-12 text-lg"
                  dir="ltr"
                />
              </div>
              {startNumber && quantityNum > 0 && (
                <p className="text-sm text-muted-foreground">
                  پلاک‌های {toPersianDigits(`${tagPrefix}${startNumber}`)} تا{" "}
                  {toPersianDigits(`${tagPrefix}${parseInt(startNumber, 10) + quantityNum - 1}`)} برای{" "}
                  {toPersianDigits(quantityNum)} دام ایجاد می‌شوند.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">پلاک هر دام را در مرحله بعد (پیش‌نمایش) وارد می‌کنید.</p>
          )}

          <div className="flex gap-2">
            <Button variant="outline" className="h-12 flex-1 text-lg" onClick={() => setStep("shared")}>
              بازگشت
            </Button>
            <Button className="h-12 flex-1 text-lg" onClick={goToPreviewStep} disabled={checkingTags}>
              {checkingTags ? "در حال بررسی…" : "مرحله بعد"}
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            پیش‌نمایش {toPersianDigits(animals.length)} دام — در صورت نیاز هر دام را جداگانه ویرایش کنید.
          </p>

          <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
            {animals.map((a, i) => {
              const isDup = a.ear_tag.trim() && duplicateTags.has(a.ear_tag.trim());
              return (
                <Card key={a.key} className={isDup ? "border-destructive" : undefined}>
                  <CardContent className="flex flex-col gap-2 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">دام {toPersianDigits(i + 1)}</span>
                      {isDup && <Badge variant="destructive">پلاک تکراری</Badge>}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={a.ear_tag}
                        onChange={(e) => updateAnimal(a.key, { ear_tag: e.target.value })}
                        placeholder="پلاک"
                        className="h-10 text-base"
                        dir="ltr"
                      />
                      <Select value={a.animal_type} onValueChange={(v) => updateAnimal(a.key, { animal_type: v })}>
                        <SelectTrigger className="h-10 w-full text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {typeOptions.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {breedOptions ? (
                        <Select value={a.breed || DEFAULT_BREED} onValueChange={(v) => updateAnimal(a.key, { breed: v })}>
                          <SelectTrigger className="h-10 w-full text-base">
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
                        <Input
                          value={a.breed}
                          onChange={(e) => updateAnimal(a.key, { breed: e.target.value })}
                          placeholder="نژاد"
                          className="h-10 text-base"
                        />
                      )}

                      <Input
                        type="number"
                        inputMode="decimal"
                        value={a.weight}
                        onChange={(e) => updateAnimal(a.key, { weight: e.target.value })}
                        placeholder="وزن (کیلوگرم)"
                        className="h-10 text-base"
                      />
                    </div>

                    {ageMode === "age_months" ? (
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={a.age_months}
                        onChange={(e) => updateAnimal(a.key, { age_months: e.target.value })}
                        placeholder="سن (ماه)"
                        className="h-10 text-base"
                      />
                    ) : (
                      <PersianDatePicker
                        value={a.birth_date}
                        onChange={(iso) => updateAnimal(a.key, { birth_date: iso ?? "" })}
                        placeholder="تاریخ تولد (اختیاری)"
                        className="h-10 text-base"
                      />
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="h-12 flex-1 text-lg" onClick={() => setStep("tags")}>
              بازگشت
            </Button>
            <Button className="h-12 flex-1 text-lg" onClick={goToConfirmStep}>
              مرحله بعد
            </Button>
          </div>
        </div>
      )}

      {step === "confirm" && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <h2 className="text-lg font-bold">{toPersianDigits(animals.length)} دام ثبت خواهد شد</h2>
              <p>نوع: {SPECIES_LABELS[species]}</p>
              {breed && <p>نژاد: {breed}</p>}
              <p>
                پلاک‌ها: {toPersianDigits(animals[0]?.ear_tag ?? "")} تا {toPersianDigits(animals[animals.length - 1]?.ear_tag ?? "")}
              </p>
              <p>نحوه ورود: {ACQUISITION_TYPE_LABELS[acquisitionType]}</p>
              {calculatedTotal !== null && <p>قیمت کل خرید: {toPersianDigits(calculatedTotal.toLocaleString())} تومان</p>}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-muted-foreground">نام دسته (قابل ویرایش)</label>
            <Input
              value={batchName}
              onChange={(e) => {
                setBatchNameTouched(true);
                setBatchName(e.target.value);
              }}
              className="h-12 text-lg"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="h-12 flex-1 text-lg" onClick={() => setStep("preview")}>
              بازگشت
            </Button>
            <Button className="h-14 flex-1 text-lg" onClick={submit} disabled={submitting}>
              {submitting ? "در حال ثبت…" : `ثبت ${toPersianDigits(animals.length)} دام`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
