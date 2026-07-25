"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { useFarmPlan } from "@/lib/hooks/use-farm-plan";
import { FeatureGate } from "@/components/feature-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MARKETPLACE_CATEGORY_LABELS,
  MARKETPLACE_FEED_TYPES,
  EQUIPMENT_TYPE_EXAMPLES,
  SERVICE_TYPE_LABELS,
  MEDICINE_TYPE_LABELS,
} from "@/lib/marketplace";
import { SPECIES_LABELS, breedOptionsFor } from "@/lib/animal-labels";
import { FEED_TYPE_LABELS, FEED_UNIT_LABELS } from "@/lib/feed-labels";
import { IRAN_PROVINCES } from "@/lib/iran-provinces";
import type { MarketplaceCategory, Species, FeedType, FeedUnit } from "@/lib/supabase/types";

function AnimalFields({ attrs, setAttrs }: { attrs: Record<string, string>; setAttrs: (a: Record<string, string>) => void }) {
  const species = (attrs.species as Species) || "sheep";
  return (
    <>
      <Select value={species} onValueChange={(v) => setAttrs({ ...attrs, species: v, breed: "" })}>
        <SelectTrigger className="h-12 w-full text-lg"><SelectValue placeholder="گونه" /></SelectTrigger>
        <SelectContent>
          {(Object.keys(SPECIES_LABELS) as Species[]).map((s) => (
            <SelectItem key={s} value={s}>{SPECIES_LABELS[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={attrs.breed ?? ""} onValueChange={(v) => setAttrs({ ...attrs, breed: v })}>
        <SelectTrigger className="h-12 w-full text-lg"><SelectValue placeholder="نژاد" /></SelectTrigger>
        <SelectContent>
          {(breedOptionsFor(species) ?? []).map((b) => (
            <SelectItem key={b} value={b}>{b}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={attrs.gender ?? ""} onValueChange={(v) => setAttrs({ ...attrs, gender: v })}>
        <SelectTrigger className="h-12 w-full text-lg"><SelectValue placeholder="جنسیت" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="male">نر</SelectItem>
          <SelectItem value="female">ماده</SelectItem>
        </SelectContent>
      </Select>
      <Input
        type="number"
        inputMode="numeric"
        placeholder="سن (ماه)"
        value={attrs.age_months ?? ""}
        onChange={(e) => setAttrs({ ...attrs, age_months: e.target.value })}
        className="h-12 text-lg"
      />
    </>
  );
}

function FeedFields({ attrs, setAttrs }: { attrs: Record<string, string>; setAttrs: (a: Record<string, string>) => void }) {
  return (
    <>
      <Select value={attrs.feed_type ?? ""} onValueChange={(v) => setAttrs({ ...attrs, feed_type: v })}>
        <SelectTrigger className="h-12 w-full text-lg"><SelectValue placeholder="نوع خوراک" /></SelectTrigger>
        <SelectContent>
          {MARKETPLACE_FEED_TYPES.map((t) => (
            <SelectItem key={t} value={t}>{FEED_TYPE_LABELS[t as FeedType]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Input
          type="number"
          inputMode="decimal"
          placeholder="مقدار"
          value={attrs.quantity ?? ""}
          onChange={(e) => setAttrs({ ...attrs, quantity: e.target.value })}
          className="h-12 flex-1 text-lg"
        />
        <Select value={attrs.unit ?? "kg"} onValueChange={(v) => setAttrs({ ...attrs, unit: v })}>
          <SelectTrigger className="h-12 w-28 text-lg"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(FEED_UNIT_LABELS) as FeedUnit[]).map((u) => (
              <SelectItem key={u} value={u}>{FEED_UNIT_LABELS[u]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function EquipmentFields({ attrs, setAttrs }: { attrs: Record<string, string>; setAttrs: (a: Record<string, string>) => void }) {
  return (
    <>
      <Select value={attrs.item_type ?? ""} onValueChange={(v) => setAttrs({ ...attrs, item_type: v })}>
        <SelectTrigger className="h-12 w-full text-lg"><SelectValue placeholder="نوع تجهیزات" /></SelectTrigger>
        <SelectContent>
          {EQUIPMENT_TYPE_EXAMPLES.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={attrs.condition ?? "used"} onValueChange={(v) => setAttrs({ ...attrs, condition: v })}>
        <SelectTrigger className="h-12 w-full text-lg"><SelectValue placeholder="وضعیت" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="new">نو</SelectItem>
          <SelectItem value="used">دست دوم</SelectItem>
        </SelectContent>
      </Select>
    </>
  );
}

function ServiceFields({ attrs, setAttrs }: { attrs: Record<string, string>; setAttrs: (a: Record<string, string>) => void }) {
  return (
    <Select value={attrs.service_type ?? ""} onValueChange={(v) => setAttrs({ ...attrs, service_type: v })}>
      <SelectTrigger className="h-12 w-full text-lg"><SelectValue placeholder="نوع خدمت" /></SelectTrigger>
      <SelectContent>
        {Object.entries(SERVICE_TYPE_LABELS).map(([k, label]) => (
          <SelectItem key={k} value={k}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function MedicineFields({ attrs, setAttrs }: { attrs: Record<string, string>; setAttrs: (a: Record<string, string>) => void }) {
  return (
    <Select value={attrs.medicine_type ?? ""} onValueChange={(v) => setAttrs({ ...attrs, medicine_type: v })}>
      <SelectTrigger className="h-12 w-full text-lg"><SelectValue placeholder="نوع دارو" /></SelectTrigger>
      <SelectContent>
        {Object.entries(MEDICINE_TYPE_LABELS).map(([k, label]) => (
          <SelectItem key={k} value={k}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ListingFormInner({ category }: { category: MarketplaceCategory }) {
  const router = useRouter();
  const params = useSearchParams();
  const recordId = params.get("id");
  const { profile, session } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [contactPhone, setContactPhone] = useState(profile?.phone_number ?? "");
  const [image, setImage] = useState<File | null>(null);
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!recordId) return;
    supabase
      .from("marketplace_listings")
      .select("*")
      .eq("id", recordId)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setTitle(data.title);
        setDescription(data.description ?? "");
        setPrice(data.price?.toString() ?? "");
        setProvince(data.province ?? "");
        setCity(data.city ?? "");
        setContactPhone(data.contact_phone ?? "");
        setAttrs(data.attributes ?? {});
      });
  }, [recordId]);

  const canSubmit = title.trim().length > 0;

  async function onSubmit() {
    if (!profile?.farm_id || !session || !canSubmit) return;
    setSubmitting(true);
    console.log("[marketplace/new] submitting", { recordId, category, title, attrs });

    try {
      let imagePath: string | null = null;
      if (image) {
        if (!navigator.onLine) {
          toast.warning("چون آفلاین هستید، تصویر بارگذاری نشد؛ آگهی بدون تصویر ثبت می‌شود");
        } else {
          const path = `${profile.farm_id}/${Date.now()}-${image.name}`;
          const { error } = await supabase.storage.from("marketplace-images").upload(path, image);
          if (error) {
            console.error("[marketplace/new] image upload failed", error);
            toast.warning("بارگذاری تصویر ناموفق بود؛ آگهی بدون تصویر ثبت می‌شود");
          } else {
            imagePath = path;
          }
        }
      }

      const payload = {
        category,
        title: title.trim(),
        description: description || null,
        price: price ? Number(price) : null,
        province: province || null,
        city: city || null,
        contact_phone: contactPhone || null,
        attributes: attrs,
        ...(imagePath ? { images: [imagePath] } : {}),
      };

      if (recordId) {
        const { error } = await supabase.from("marketplace_listings").update(payload).eq("id", recordId);
        if (error) throw error;
        toast.success("آگهی به‌روزرسانی شد");
      } else {
        const { error } = await supabase.from("marketplace_listings").insert({
          ...payload,
          farm_id: profile.farm_id,
          created_by: session.user.id,
        });
        if (error) throw error;
        toast.success("آگهی ثبت شد و پس از تأیید مدیر گله‌یار نمایش داده می‌شود");
      }

      router.push(`/marketplace/${category}`);
    } catch (error) {
      console.error("[marketplace/new] failed", error);
      toast.error(error instanceof Error ? error.message : "ثبت آگهی با خطا مواجه شد. لطفاً دوباره تلاش کنید.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      <h1 className="text-xl font-bold">
        {recordId ? "ویرایش آگهی" : "ثبت آگهی جدید"} — {MARKETPLACE_CATEGORY_LABELS[category]}
      </h1>

      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان آگهی" className="h-12 text-lg" autoFocus />

      {category === "animal" && <AnimalFields attrs={attrs} setAttrs={setAttrs} />}
      {category === "feed" && <FeedFields attrs={attrs} setAttrs={setAttrs} />}
      {category === "equipment" && <EquipmentFields attrs={attrs} setAttrs={setAttrs} />}
      {category === "service" && <ServiceFields attrs={attrs} setAttrs={setAttrs} />}
      {category === "medicine" && <MedicineFields attrs={attrs} setAttrs={setAttrs} />}

      <Input
        type="number"
        inputMode="numeric"
        placeholder="قیمت (تومان، اختیاری برای خدمات/دارو)"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        className="h-12 text-lg"
      />

      <Select value={province} onValueChange={setProvince}>
        <SelectTrigger className="h-12 w-full text-lg"><SelectValue placeholder="استان" /></SelectTrigger>
        <SelectContent>
          {IRAN_PROVINCES.map((p) => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="شهرستان" className="h-12 text-lg" />
      <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="شماره تماس" className="h-12 text-lg" dir="ltr" />

      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیحات" rows={4} />

      <label className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input text-muted-foreground">
        {image ? image.name : "افزودن تصویر (اختیاری)"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
      </label>

      <Button size="lg" className="h-14 text-lg" disabled={!canSubmit || submitting} onClick={onSubmit}>
        {submitting ? "در حال ثبت…" : recordId ? "ذخیره تغییرات" : "ثبت آگهی"}
      </Button>
    </div>
  );
}

export function ListingForm({ category }: { category: MarketplaceCategory }) {
  const { loading } = useFarmPlan();
  if (loading) return null;
  return (
    <FeatureGate feature="marketplace_access">
      <Suspense fallback={null}>
        <ListingFormInner category={category} />
      </Suspense>
    </FeatureGate>
  );
}
