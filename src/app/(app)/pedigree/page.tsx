"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { GitBranch, Search } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Input } from "@/components/ui/input";
import { SPECIES_LABELS, effectiveAnimalTypeLabel } from "@/lib/animal-labels";
import type { Species } from "@/lib/supabase/types";

const SPECIES_ORDER: Species[] = ["sheep", "goat", "cattle", "camel", "horse"];

/**
 * Top-level entry point for the pedigree module: pick any animal to open its
 * family tree. Kept as a separate route (rather than folded into /animals)
 * so genetics/breeding has its own place in the nav, per the spec.
 */
export default function PedigreeSearchPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const [query, setQuery] = useState("");

  const animals = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows.filter((a) => !a.deleted_at).sort((a, b) => (a.ear_tag > b.ear_tag ? 1 : -1));
  }, [farmId]);

  const filtered = useMemo(() => {
    const q = query.trim();
    const list = animals ?? [];
    if (!q) return list;
    return list.filter((a) =>
      [a.ear_tag, a.generated_id ?? "", a.name ?? "", a.breed ?? ""].some((f) => f.includes(q))
    );
  }, [animals, query]);

  const grouped = useMemo(() => {
    const map = new Map<Species, typeof filtered>();
    for (const s of SPECIES_ORDER) map.set(s, []);
    for (const a of filtered) map.get(a.species)?.push(a);
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <GitBranch className="size-6 text-primary" />
        <h1 className="text-xl font-bold">شجره‌نامه</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        یک دام را برای مشاهده شجره‌نامه کامل (اجداد، فرزندان و تحلیل ژنتیکی) انتخاب کنید.
      </p>

      <div className="relative">
        <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جستجو با پلاک، نام یا نژاد…"
          className="h-11 pr-9"
        />
      </div>

      {filtered.length === 0 && (
        <p className="mt-10 text-center text-muted-foreground">
          {animals?.length === 0 ? "هنوز دامی ثبت نشده است." : "دامی با این مشخصات یافت نشد."}
        </p>
      )}

      <div className="flex flex-col gap-5">
        {SPECIES_ORDER.map((s) => {
          const list = grouped.get(s) ?? [];
          if (list.length === 0) return null;
          return (
            <div key={s} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {SPECIES_LABELS[s]} ({list.length})
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((animal) => (
                  <li key={animal.id}>
                    <Link
                      href={`/pedigree/view?id=${animal.id}`}
                      className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="text-lg font-semibold">
                          {animal.name ? `${animal.name} — ` : ""}
                          {animal.ear_tag}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {effectiveAnimalTypeLabel(animal.species, animal.gender, animal.birth_date, animal.animal_type)}
                          {animal.breed ? ` · ${animal.breed}` : ""}
                        </span>
                      </span>
                      <GitBranch className="size-5 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
