"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Store, Rabbit, Wheat, Wrench, Stethoscope, Pill, Megaphone } from "lucide-react";

import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { toPersianDigits } from "@/lib/jalali";
import { MARKETPLACE_CATEGORIES, MARKETPLACE_CATEGORY_LABELS } from "@/lib/marketplace";
import type { MarketplaceCategory } from "@/lib/supabase/types";

const CATEGORY_ICONS: Record<MarketplaceCategory, React.ComponentType<{ className?: string }>> = {
  animal: Rabbit,
  feed: Wheat,
  equipment: Wrench,
  service: Stethoscope,
  medicine: Pill,
};

export default function MarketplaceHubPage() {
  const { profile } = useAuth();
  const [counts, setCounts] = useState<Partial<Record<MarketplaceCategory, number>>>({});

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("marketplace_listings")
      .select("category")
      .eq("status", "active")
      .then(({ data }) => {
        const next: Partial<Record<MarketplaceCategory, number>> = {};
        for (const row of (data ?? []) as { category: MarketplaceCategory }[]) {
          next[row.category] = (next[row.category] ?? 0) + 1;
        }
        setCounts(next);
      });
  }, [profile]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Store className="size-6 text-primary" />
        <h1 className="text-xl font-bold">بازار گله‌یار</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MARKETPLACE_CATEGORIES.map((category) => {
          const Icon = CATEGORY_ICONS[category];
          return (
            <Link key={category} href={`/marketplace/${category}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <Icon className="size-6 text-primary" />
                    {(counts[category] ?? 0) > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        {toPersianDigits(counts[category] ?? 0)}
                      </span>
                    )}
                  </div>
                  <span className="text-base font-semibold">{MARKETPLACE_CATEGORY_LABELS[category]}</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
          <Megaphone className="size-6" />
          <span className="text-sm">تبلیغات — به‌زودی</span>
        </CardContent>
      </Card>
    </div>
  );
}
