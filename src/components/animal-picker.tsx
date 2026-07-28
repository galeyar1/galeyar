"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, Search, Ban } from "lucide-react";

import { db } from "@/lib/db/schema";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SPECIES_LABELS, GENDER_LABELS, ANIMAL_STATUS_LABELS, normalizeAnimalSearch } from "@/lib/animal-labels";
import { cn } from "@/lib/utils";
import type { Animal, Species } from "@/lib/supabase/types";

interface AnimalPickerProps {
  farmId: string | null | undefined;
  value?: string;
  onChange: (animalId: string) => void;
  filter?: "all" | "female" | "male";
  /** Restricts the list to one species — e.g. a father picker for a litter should only ever offer the same species as the mother, never a cross-species parent. */
  species?: Species;
  /** Off by default — current-operations forms (health, weight, milk…) only want active animals. Historical/report workflows that need to reference an already sold/dead animal should turn this on. */
  includeInactive?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Adds an explicit "هیچکدام" option — e.g. unknown father, AI, external sire. */
  allowNone?: boolean;
}

const MAX_VISIBLE_RESULTS = 150;

function secondaryLine(animal: Animal, includeInactive: boolean): string {
  const parts: string[] = [];
  if (animal.breed) parts.push(animal.breed);
  if (animal.gender === "male" || animal.gender === "female") parts.push(GENDER_LABELS[animal.gender]);
  if (parts.length === 0) parts.push(SPECIES_LABELS[animal.species]);
  if (includeInactive && animal.status !== "active") parts.push(ANIMAL_STATUS_LABELS[animal.status]);
  return parts.join(" • ");
}

function selectedLabel(animal: Animal): string {
  const parts = [`پلاک ${animal.ear_tag}`];
  if (animal.breed) parts.push(animal.breed);
  if (animal.gender === "male" || animal.gender === "female") parts.push(GENDER_LABELS[animal.gender]);
  else if (animal.name) parts.push(animal.name);
  return parts.join(" — ");
}

/**
 * Searchable bottom-sheet picker — a plain dropdown is too fiddly one-handed
 * for a long ear-tag list, and doesn't scroll well on mobile. Loads the
 * farm's animals from Dexie (already fully synced locally, offline-first —
 * so this is a fast in-memory filter, not a network round-trip) and filters
 * client-side; rendering is capped at MAX_VISIBLE_RESULTS so a very large
 * herd (thousands of animals) doesn't render an unbounded DOM list — typing
 * to narrow the search brings the exact animal back into that cap.
 */
export function AnimalPicker({
  farmId,
  value,
  onChange,
  filter = "all",
  species,
  includeInactive = false,
  className,
  placeholder,
  disabled = false,
  allowNone = false,
}: AnimalPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const animals = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows
      .filter((a) => !a.deleted_at)
      .filter((a) => includeInactive || a.status === "active")
      .filter((a) => filter === "all" || a.gender === filter)
      .filter((a) => !species || a.species === species)
      .sort((a, b) => (a.ear_tag > b.ear_tag ? 1 : -1));
  }, [farmId, filter, species, includeInactive]);

  const selected = useMemo(() => animals?.find((a) => a.id === value), [animals, value]);

  const filtered = useMemo(() => {
    const q = normalizeAnimalSearch(query.trim());
    if (!q) return animals ?? [];
    return (animals ?? []).filter((a) =>
      [a.ear_tag, a.name ?? "", a.breed ?? ""].some((field) => normalizeAnimalSearch(field).includes(q))
    );
  }, [animals, query]);

  const visibleResults = filtered.slice(0, MAX_VISIBLE_RESULTS);
  const showingNone = allowNone && !value;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 text-lg shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selectedLabel(selected) : showingNone ? "هیچکدام" : placeholder ?? "انتخاب شماره پلاک گوش"}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="flex h-[85vh] flex-col">
          <SheetHeader>
            <SheetTitle>انتخاب شماره پلاک گوش</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4">
            <div className="relative shrink-0">
              <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجوی شماره پلاک گوش…"
                className="h-12 pr-9 text-lg"
                dir="ltr"
              />
            </div>
            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
              {allowNone && (
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-xl border border-dashed border-border p-3 text-start text-muted-foreground",
                      !value && "border-primary bg-primary/5 text-foreground"
                    )}
                  >
                    <Ban className="size-4 shrink-0" />
                    <span className="text-lg font-semibold">هیچکدام</span>
                    <span className="text-sm">(پدر نامشخص / تلقیح مصنوعی / دام خارجی)</span>
                  </button>
                </li>
              )}
              {visibleResults.map((animal) => (
                <li key={animal.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(animal.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-xl border border-border p-3 text-start",
                      animal.id === value && "border-primary bg-primary/5"
                    )}
                  >
                    <span className="text-lg font-semibold">
                      پلاک {animal.ear_tag}
                      {animal.name ? ` — ${animal.name}` : ""}
                    </span>
                    <span className="text-sm text-muted-foreground">{secondaryLine(animal, includeInactive)}</span>
                  </button>
                </li>
              ))}
              {filtered.length > MAX_VISIBLE_RESULTS && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  برای دیدن بقیه‌ی نتایج، جستجوی دقیق‌تری انجام دهید.
                </p>
              )}
              {filtered.length === 0 && (
                <p className="mt-8 text-center text-muted-foreground">
                  {query.trim() ? "دامی با این شماره پلاک پیدا نشد." : "دامی برای انتخاب وجود ندارد."}
                </p>
              )}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
