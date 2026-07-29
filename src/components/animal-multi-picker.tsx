"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SPECIES_LABELS, GENDER_LABELS } from "@/lib/animal-labels";
import { useFarmAnimals, searchAnimals } from "@/lib/hooks/use-animal-search";
import { toPersianDigits } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import type { Species } from "@/lib/supabase/types";

interface AnimalMultiPickerProps {
  farmId: string | null | undefined;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Off by default — group operations (deworming, vaccination…) target the current active herd. */
  includeInactive?: boolean;
  className?: string;
}

const MAX_VISIBLE_RESULTS = 150;
const ALL = "all";

/**
 * Multi-select sibling of AnimalPicker — same search/scroll foundation
 * (useFarmAnimals/searchAnimals, dvh-safe bottom sheet), but for group
 * operations: checkboxes, in-sheet species/sex/breed filters, and
 * "انتخاب همه نتایج" so a farmer can quickly grab e.g. every active sheep
 * ewe instead of tapping each one.
 */
export function AnimalMultiPicker({ farmId, selectedIds, onChange, includeInactive = false, className }: AnimalMultiPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState<typeof ALL | Species>(ALL);
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");
  const [breedFilter, setBreedFilter] = useState(ALL);

  const animals = useFarmAnimals({
    farmId,
    species: speciesFilter === ALL ? undefined : speciesFilter,
    gender: genderFilter,
    includeInactive,
  });

  const availableBreeds = useMemo(() => {
    const breeds = new Set<string>();
    for (const a of animals ?? []) if (a.breed) breeds.add(a.breed);
    return [...breeds].sort();
  }, [animals]);

  const breedFiltered = useMemo(() => {
    if (breedFilter === ALL) return animals ?? [];
    return (animals ?? []).filter((a) => a.breed === breedFilter);
  }, [animals, breedFilter]);

  const filtered = useMemo(() => searchAnimals(breedFiltered, query), [breedFiltered, query]);
  const visibleResults = filtered.slice(0, MAX_VISIBLE_RESULTS);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allResultsSelected = filtered.length > 0 && filtered.every((a) => selectedSet.has(a.id));

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  function toggleSelectAllResults() {
    if (allResultsSelected) {
      const resultIds = new Set(filtered.map((a) => a.id));
      onChange(selectedIds.filter((id) => !resultIds.has(id)));
    } else {
      const merged = new Set(selectedIds);
      for (const a of filtered) merged.add(a.id);
      onChange([...merged]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-lg border border-input bg-transparent px-3 text-lg shadow-xs outline-none",
          className
        )}
      >
        <span className={cn(selectedIds.length === 0 && "text-muted-foreground")}>
          {selectedIds.length > 0 ? `${toPersianDigits(selectedIds.length)} دام انتخاب شده` : "انتخاب دام‌ها"}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="flex h-[85dvh]! flex-col overflow-hidden!">
          <SheetHeader>
            <SheetTitle>انتخاب دام‌ها</SheetTitle>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="relative shrink-0">
              <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجو بر اساس پلاک یا نام دام…"
                className="h-12 pr-9 text-lg"
                dir="ltr"
              />
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-2">
              <Select
                value={speciesFilter}
                onValueChange={(v) => {
                  setSpeciesFilter(v as typeof ALL | Species);
                  setBreedFilter(ALL);
                }}
              >
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>همه گونه‌ها</SelectItem>
                  {(Object.keys(SPECIES_LABELS) as Species[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SPECIES_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={genderFilter} onValueChange={(v) => setGenderFilter(v as "all" | "male" | "female")}>
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه جنسیت‌ها</SelectItem>
                  <SelectItem value="female">{GENDER_LABELS.female}</SelectItem>
                  <SelectItem value="male">{GENDER_LABELS.male}</SelectItem>
                </SelectContent>
              </Select>

              <Select value={breedFilter} onValueChange={setBreedFilter}>
                <SelectTrigger className="h-10 w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>همه نژادها</SelectItem>
                  {availableBreeds.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-2 rounded-xl bg-muted p-3">
              <label className="flex items-center gap-2">
                <Checkbox checked={allResultsSelected} onCheckedChange={toggleSelectAllResults} />
                <span className="text-sm font-semibold">انتخاب همه نتایج ({toPersianDigits(filtered.length)})</span>
              </label>
              {selectedIds.length > 0 && (
                <button type="button" className="text-sm text-muted-foreground" onClick={() => onChange([])}>
                  پاک کردن انتخاب
                </button>
              )}
            </div>

            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain">
              {visibleResults.map((animal) => (
                <li key={animal.id}>
                  <button
                    type="button"
                    onClick={() => toggle(animal.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border border-border p-3 text-start",
                      selectedSet.has(animal.id) && "border-primary bg-primary/5"
                    )}
                  >
                    <Checkbox checked={selectedSet.has(animal.id)} onCheckedChange={() => toggle(animal.id)} />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-lg font-semibold">
                        پلاک {animal.ear_tag}
                        {animal.name ? ` — ${animal.name}` : ""}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {[animal.breed, animal.gender === "male" || animal.gender === "female" ? GENDER_LABELS[animal.gender] : null]
                          .filter(Boolean)
                          .join(" • ") || SPECIES_LABELS[animal.species]}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
              {filtered.length > MAX_VISIBLE_RESULTS && (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  برای دیدن بقیه‌ی نتایج، جستجو یا فیلتر دقیق‌تری اعمال کنید.
                </p>
              )}
              {filtered.length === 0 && (
                <p className="mt-8 text-center text-muted-foreground">
                  {query.trim() ? "دامی با این شماره پلاک پیدا نشد." : "دامی برای انتخاب وجود ندارد."}
                </p>
              )}
            </ul>

            <Button className="h-12 shrink-0 text-lg" onClick={() => setOpen(false)}>
              تأیید ({toPersianDigits(selectedIds.length)} دام)
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
