"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, MapPin, Phone } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { useFarmPlan } from "@/lib/hooks/use-farm-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toPersianDigits } from "@/lib/jalali";
import { hasFeature } from "@/lib/subscription-plans";
import { MARKETPLACE_CATEGORY_LABELS, matchesFilters } from "@/lib/marketplace";
import { SPECIES_LABELS, breedOptionsFor } from "@/lib/animal-labels";
import { IRAN_PROVINCES } from "@/lib/iran-provinces";
import type { MarketplaceCategory, MarketplaceListing, Species } from "@/lib/supabase/types";

type ListingWithFarm = MarketplaceListing & { farms: { farm_name: string } | null };

export function CategoryBrowse({ category }: { category: MarketplaceCategory }) {
  const { profile } = useAuth();
  const { plan } = useFarmPlan();
  const canPost = hasFeature(plan, "marketplace_access");

  const [listings, setListings] = useState<ListingWithFarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<ListingWithFarm | null>(null);

  const [speciesFilter, setSpeciesFilter] = useState("all");
  const [breedFilter, setBreedFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    supabase
      .from("marketplace_listings")
      .select("*, farms(farm_name)")
      .eq("category", category)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setListings((data ?? []) as unknown as ListingWithFarm[]);
        setLoading(false);
      });
  }, [profile, category]);

  const breedOptions = useMemo(
    () => (speciesFilter !== "all" ? breedOptionsFor(speciesFilter as Species) : null),
    [speciesFilter]
  );

  const filtered = useMemo(() => {
    return listings.filter((l) =>
      matchesFilters(l, {
        species: category === "animal" && speciesFilter !== "all" ? speciesFilter : undefined,
        breed: category === "animal" && breedFilter !== "all" ? breedFilter : undefined,
        province: provinceFilter !== "all" ? provinceFilter : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
      })
    );
  }, [listings, category, speciesFilter, breedFilter, provinceFilter, maxPrice]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{MARKETPLACE_CATEGORY_LABELS[category]}</h1>
        {canPost ? (
          <Button asChild size="sm">
            <Link href={`/marketplace/${category}/new`}>
              <Plus className="size-4" /> ثبت آگهی
            </Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link href="/subscriptions">ارتقا برای ثبت آگهی</Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {category === "animal" && (
          <>
            <Select value={speciesFilter} onValueChange={(v) => { setSpeciesFilter(v); setBreedFilter("all"); }}>
              <SelectTrigger className="h-10"><SelectValue placeholder="گونه" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه گونه‌ها</SelectItem>
                {(Object.keys(SPECIES_LABELS) as Species[]).map((s) => (
                  <SelectItem key={s} value={s}>{SPECIES_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={breedFilter} onValueChange={setBreedFilter} disabled={!breedOptions}>
              <SelectTrigger className="h-10"><SelectValue placeholder="نژاد" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه نژادها</SelectItem>
                {(breedOptions ?? []).map((b) => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <Select value={provinceFilter} onValueChange={setProvinceFilter}>
          <SelectTrigger className="h-10"><SelectValue placeholder="استان" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه استان‌ها</SelectItem>
            {IRAN_PROVINCES.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="number"
          inputMode="numeric"
          placeholder="حداکثر قیمت (تومان)"
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          className="h-10"
        />
      </div>

      {!loading && filtered.length === 0 && (
        <p className="mt-10 text-center text-muted-foreground">آگهی‌ای یافت نشد.</p>
      )}

      <ul className="flex flex-col gap-2">
        {filtered.map((listing) => (
          <li key={listing.id}>
            <button
              type="button"
              onClick={() => setDetail(listing)}
              className="flex w-full flex-col gap-1 rounded-xl border border-border bg-card p-4 text-start"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{listing.title}</span>
                {listing.price !== null && (
                  <span className="font-semibold text-primary">
                    {toPersianDigits(listing.price.toLocaleString())} تومان
                  </span>
                )}
              </div>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="size-3.5" />
                {listing.province ?? "—"} · {listing.farms?.farm_name ?? "دامداری"}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.title}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="flex flex-col gap-3">
              {detail.price !== null && (
                <p className="text-lg font-bold text-primary">{toPersianDigits(detail.price.toLocaleString())} تومان</p>
              )}
              {detail.description && <p className="text-sm">{detail.description}</p>}
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" /> {detail.province ?? "—"} {detail.city ? `، ${detail.city}` : ""}
              </p>
              <p className="text-sm text-muted-foreground">فروشنده: {detail.farms?.farm_name ?? "—"}</p>
              {detail.contact_phone && (
                <Button asChild size="lg" className="h-12">
                  <a href={`tel:${detail.contact_phone}`}>
                    <Phone className="size-4" /> تماس با فروشنده ({toPersianDigits(detail.contact_phone)})
                  </a>
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
