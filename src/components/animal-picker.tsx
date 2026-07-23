"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, Search } from "lucide-react";

import { db } from "@/lib/db/schema";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import { cn } from "@/lib/utils";

interface AnimalPickerProps {
  farmId: string | null | undefined;
  value?: string;
  onChange: (animalId: string) => void;
  filter?: "all" | "female" | "male";
  className?: string;
}

/** Full-screen searchable picker — a dropdown is too fiddly one-handed for a long ear-tag list. */
export function AnimalPicker({ farmId, value, onChange, filter = "all", className }: AnimalPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const animals = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows
      .filter((a) => !a.deleted_at && a.status === "active")
      .filter((a) => filter === "all" || a.gender === filter)
      .sort((a, b) => (a.ear_tag > b.ear_tag ? 1 : -1));
  }, [farmId, filter]);

  const selected = useMemo(() => animals?.find((a) => a.id === value), [animals, value]);

  const filtered = (animals ?? []).filter((a) => {
    const q = query.trim();
    if (!q) return true;
    return a.ear_tag.includes(q) || (a.name ?? "").includes(q);
  });

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
        <span className={cn(!selected && "text-muted-foreground")}>
          {selected ? `${selected.ear_tag}${selected.name ? ` — ${selected.name}` : ""}` : "انتخاب دام"}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[80vh]">
          <SheetHeader>
            <SheetTitle>انتخاب دام</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 overflow-hidden px-4 pb-4">
            <div className="relative">
              <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جستجو با پلاک یا نام…"
                className="h-12 pr-9 text-lg"
              />
            </div>
            <ul className="flex flex-col gap-2 overflow-y-auto">
              {filtered.map((animal) => (
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
                      {animal.ear_tag}
                      {animal.name ? ` — ${animal.name}` : ""}
                    </span>
                    <span className="text-sm text-muted-foreground">{SPECIES_LABELS[animal.species]}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <p className="mt-8 text-center text-muted-foreground">دامی یافت نشد</p>
              )}
            </ul>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
