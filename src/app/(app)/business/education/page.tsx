"use client";

import { useMemo, useState } from "react";
import { GraduationCap, PlayCircle, BookOpen, FileQuestion, Notebook } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  EDUCATION_ENTRIES,
  EDUCATION_TYPE_LABELS,
  SPECIES_FILTER_LABELS,
  filterEducationEntries,
  type EducationType,
} from "@/lib/education-content";
import type { Species } from "@/lib/supabase/types";

const TYPE_ICONS: Record<EducationType, typeof BookOpen> = {
  video: PlayCircle,
  article: FileQuestion,
  guide: Notebook,
  faq: FileQuestion,
};

export default function EducationCenterPage() {
  const [species, setSpecies] = useState<Species | "all">("all");
  const [type, setType] = useState<EducationType | "all">("all");

  const filtered = useMemo(() => filterEducationEntries(EDUCATION_ENTRIES, species, type), [species, type]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="size-6 text-primary" />
        <h1 className="text-xl font-bold">مرکز آموزش</h1>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={species} onValueChange={(v) => setSpecies(v as Species | "all")}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(SPECIES_FILTER_LABELS) as (Species | "all")[]).map((s) => (
              <SelectItem key={s} value={s}>{SPECIES_FILTER_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => setType(v as EducationType | "all")}>
          <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه انواع</SelectItem>
            {(Object.keys(EDUCATION_TYPE_LABELS) as EducationType[]).map((t) => (
              <SelectItem key={t} value={t}>{EDUCATION_TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.length === 0 && <p className="text-center text-muted-foreground">موردی یافت نشد.</p>}
        {filtered.map((entry) => {
          const Icon = TYPE_ICONS[entry.type];
          return (
            <Card key={entry.id}>
              <CardContent className="flex flex-col gap-1.5 p-4">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 shrink-0 text-primary" />
                  <span className="text-xs text-muted-foreground">{EDUCATION_TYPE_LABELS[entry.type]}</span>
                </div>
                <span className="font-semibold">{entry.title}</span>
                {entry.type === "video" ? (
                  <p className="text-sm text-muted-foreground">ویدیوی این آموزش به‌زودی اضافه می‌شود.</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{entry.body}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
