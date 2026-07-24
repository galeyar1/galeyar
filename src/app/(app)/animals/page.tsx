"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Clock, Search, SlidersHorizontal, Pencil, Trash2 } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { updateRecord } from "@/lib/sync/repository";
import { SPECIES_LABELS, ANIMAL_STATUS_LABELS, effectiveAnimalTypeLabel, ageInYears } from "@/lib/animal-labels";
import { EXIT_REASON_LABELS, statusForExitReason } from "@/lib/exit-reasons";
import { formatJalali, toPersianDigits } from "@/lib/jalali";
import type { Local } from "@/lib/db/schema";
import type { Species, AnimalStatus, Animal, ExitReason } from "@/lib/supabase/types";

const SPECIES_ORDER: Species[] = ["sheep", "goat", "cattle", "camel", "horse"];

type AgeBucket = "all" | "young" | "adult" | "mature";

function matchesAge(bucket: AgeBucket, years: number | null): boolean {
  if (bucket === "all") return true;
  if (years === null) return false;
  if (bucket === "young") return years < 1;
  if (bucket === "adult") return years >= 1 && years <= 3;
  return years > 3;
}

export default function AnimalsPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const canDelete = profile?.role === "owner";
  const canEdit = profile?.role === "owner" || profile?.role === "operator";

  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [speciesFilter, setSpeciesFilter] = useState<Species | "all">("all");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [breedFilter, setBreedFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<AnimalStatus | "all">("all");
  const [ageFilter, setAgeFilter] = useState<AgeBucket>("all");

  const animals = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows
      .filter((a) => !a.deleted_at)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [farmId]);

  const breeds = useMemo(
    () => [...new Set((animals ?? []).map((a) => a.breed).filter(Boolean))] as string[],
    [animals]
  );

  const earTagOf = useMemo(() => new Map((animals ?? []).map((a) => [a.id, a.ear_tag])), [animals]);

  const filtered = useMemo(() => {
    const q = query.trim();
    return (animals ?? []).filter((a) => {
      if (q) {
        const fatherTag = a.father_id ? earTagOf.get(a.father_id) ?? "" : "";
        const motherTag = a.mother_id ? earTagOf.get(a.mother_id) ?? "" : "";
        const haystack = [
          a.ear_tag,
          a.generated_id ?? "",
          a.name ?? "",
          a.id,
          a.breed ?? "",
          SPECIES_LABELS[a.species],
          fatherTag,
          motherTag,
        ].join(" ");
        if (!haystack.includes(q)) return false;
      }
      if (speciesFilter !== "all" && a.species !== speciesFilter) return false;
      if (genderFilter !== "all" && a.gender !== genderFilter) return false;
      if (breedFilter !== "all" && a.breed !== breedFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (!matchesAge(ageFilter, ageInYears(a.birth_date))) return false;
      return true;
    });
  }, [animals, query, earTagOf, speciesFilter, genderFilter, breedFilter, statusFilter, ageFilter]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = { total: (animals ?? []).length };
    for (const s of SPECIES_ORDER) counts[s] = 0;
    for (const a of animals ?? []) counts[a.species] = (counts[a.species] ?? 0) + 1;
    return counts;
  }, [animals]);

  const grouped = useMemo(() => {
    const map = new Map<Species, Local<Animal>[]>();
    for (const s of SPECIES_ORDER) map.set(s, []);
    for (const a of filtered) map.get(a.species)?.push(a);
    return map;
  }, [filtered]);

  const [exitAnimal, setExitAnimal] = useState<Local<Animal> | null>(null);
  const [exitReason, setExitReason] = useState<ExitReason>("sale");
  const [exiting, setExiting] = useState(false);

  async function confirmExit() {
    if (!exitAnimal) return;
    setExiting(true);
    await updateRecord("animals", exitAnimal.id, {
      status: statusForExitReason(exitReason),
      exit_reason: exitReason,
      deleted_at: new Date().toISOString(),
    });
    setExiting(false);
    setExitAnimal(null);
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">دام‌ها</h1>
        <Button asChild size="lg">
          <Link href="/animals/new">
            <Plus className="size-5" />
            ثبت دام جدید
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Card className="min-w-[100px]">
          <CardContent className="flex flex-col gap-0.5 p-3">
            <span className="text-2xl font-bold text-primary">{toPersianDigits(summary.total)}</span>
            <span className="text-xs text-muted-foreground">کل دام‌ها</span>
          </CardContent>
        </Card>
        {SPECIES_ORDER.map((s) => (
          <Card key={s} className="min-w-[90px]">
            <CardContent className="flex flex-col gap-0.5 p-3">
              <span className="text-xl font-bold">{toPersianDigits(summary[s] ?? 0)}</span>
              <span className="text-xs text-muted-foreground">{SPECIES_LABELS[s]}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو با پلاک، نام، نژاد، گونه، پدر یا مادر…"
            className="h-11 pr-9"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => setShowFilters((v) => !v)}
          aria-label="فیلترها"
        >
          <SlidersHorizontal className="size-5" />
        </Button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-card p-3">
          <Select value={speciesFilter} onValueChange={(v) => setSpeciesFilter(v as Species | "all")}>
            <SelectTrigger className="h-10"><SelectValue placeholder="گونه" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه گونه‌ها</SelectItem>
              {SPECIES_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{SPECIES_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger className="h-10"><SelectValue placeholder="جنسیت" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه جنسیت‌ها</SelectItem>
              <SelectItem value="male">نر</SelectItem>
              <SelectItem value="female">ماده</SelectItem>
            </SelectContent>
          </Select>

          <Select value={breedFilter} onValueChange={setBreedFilter}>
            <SelectTrigger className="h-10"><SelectValue placeholder="نژاد" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه نژادها</SelectItem>
              {breeds.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as AnimalStatus | "all")}>
            <SelectTrigger className="h-10"><SelectValue placeholder="وضعیت" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="active">فعال</SelectItem>
              <SelectItem value="sold">فروخته‌شده</SelectItem>
              <SelectItem value="dead">تلف‌شده</SelectItem>
            </SelectContent>
          </Select>

          <Select value={ageFilter} onValueChange={(v) => setAgeFilter(v as AgeBucket)}>
            <SelectTrigger className="col-span-2 h-10"><SelectValue placeholder="سن" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه سنین</SelectItem>
              <SelectItem value="young">زیر ۱ سال (نوزاد/بره)</SelectItem>
              <SelectItem value="adult">۱ تا ۳ سال</SelectItem>
              <SelectItem value="mature">بیشتر از ۳ سال</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filtered.length === 0 && (
        <p className="mt-10 text-center text-muted-foreground">
          {animals?.length === 0 ? "هنوز دامی ثبت نشده است. با دکمه بالا اولین دام را ثبت کنید." : "دامی با این مشخصات یافت نشد."}
        </p>
      )}

      <div className="flex flex-col gap-5">
        {SPECIES_ORDER.map((s) => {
          const list = grouped.get(s) ?? [];
          if (list.length === 0) return null;
          return (
            <div key={s} className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {SPECIES_LABELS[s]} ({toPersianDigits(list.length)})
              </h2>
              <ul className="flex flex-col gap-2">
                {list.map((animal) => (
                  <li key={animal.id}>
                    <div className="flex items-center gap-1 rounded-xl border border-border bg-card p-4">
                      <Link href={`/animals/view?id=${animal.id}`} className="flex flex-1 flex-col gap-1">
                        <span className="text-lg font-semibold">
                          {animal.name ? `${animal.name} — ` : ""}
                          {animal.ear_tag}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {effectiveAnimalTypeLabel(animal.species, animal.gender, animal.birth_date, animal.animal_type)}
                          {animal.birth_date ? ` · متولد ${formatJalali(animal.birth_date)}` : ""}
                        </span>
                      </Link>
                      {animal.sync_status === "pending" && (
                        <Clock className="size-4 text-warning" aria-label="در انتظار همگام‌سازی" />
                      )}
                      <Badge variant={animal.status === "active" ? "default" : "secondary"}>
                        {ANIMAL_STATUS_LABELS[animal.status]}
                      </Badge>
                      {canEdit && (
                        <Button variant="ghost" size="icon-sm" asChild aria-label="ویرایش">
                          <Link href={`/animals/new?id=${animal.id}`}>
                            <Pencil className="size-4" />
                          </Link>
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="حذف"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setExitReason("sale");
                            setExitAnimal(animal);
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <Dialog open={!!exitAnimal} onOpenChange={(open) => !open && setExitAnimal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>حذف {exitAnimal?.ear_tag}</DialogTitle>
            <DialogDescription>
              دلیل خروج این دام از گله را انتخاب کنید. این عملیات قابل بازگشت نیست.
            </DialogDescription>
          </DialogHeader>
          <Select value={exitReason} onValueChange={(v) => setExitReason(v as ExitReason)}>
            <SelectTrigger className="h-12 w-full text-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(EXIT_REASON_LABELS) as ExitReason[]).map((r) => (
                <SelectItem key={r} value={r}>{EXIT_REASON_LABELS[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExitAnimal(null)} disabled={exiting}>انصراف</Button>
            <Button variant="destructive" onClick={confirmExit} disabled={exiting}>
              <Trash2 className="size-4" />
              {exiting ? "در حال حذف…" : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
