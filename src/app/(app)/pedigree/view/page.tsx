"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronLeft,
  Search,
  Download,
  Image as ImageIcon,
  Printer,
  Sparkles,
  AlertTriangle,
  Loader2,
} from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PedigreeGraphHandle } from "@/components/pedigree-graph";
import {
  SPECIES_LABELS,
  ANIMAL_STATUS_LABELS,
  effectiveAnimalTypeLabel,
  ageLabel,
} from "@/lib/animal-labels";
import { formatJalali, toPersianDigits } from "@/lib/jalali";
import {
  buildAncestorTree,
  buildDescendantTree,
  countDescendants,
  ancestorDepth,
  descendantDepth,
  flattenAncestors,
  flattenDescendants,
  type AncestorNode,
  type DescendantNode,
  type PedigreeAnimal,
} from "@/lib/pedigree";
import {
  inbreedingWarning,
  geneticDiversityScore,
  recommendedMates,
} from "@/lib/pedigree-ai";
import { exportPedigreePdf, downloadDataUrl, type PdfPageSize } from "@/lib/pdf-export";
import type { PedigreeRelation } from "@/lib/supabase/types";

// React Flow touches window/ResizeObserver on mount — load it client-only so
// the static-export build's prerender pass never has to evaluate it.
const PedigreeGraph = dynamic(() => import("@/components/pedigree-graph").then((m) => m.PedigreeGraph), {
  ssr: false,
  loading: () => (
    <div className="flex h-[70vh] w-full items-center justify-center rounded-xl border border-border bg-muted">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

function AncestorBranch({ node }: { node: AncestorNode }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.father || node.mother;
  const label = node.animal
    ? `${node.relationLabel}: ${node.animal.ear_tag}${node.animal.name ? ` (${node.animal.name})` : ""}`
    : `${node.relationLabel}: ${node.externalName ?? "نامشخص"}`;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => hasChildren && setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg border border-border bg-card p-2 text-start"
        disabled={!hasChildren}
      >
        {hasChildren ? (
          open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronLeft className="size-4 shrink-0" />
        ) : (
          <span className="size-4 shrink-0" />
        )}
        {node.animal ? (
          <Link href={`/pedigree/view?id=${node.animal.id}`} className="text-sm font-medium text-primary">
            {label}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{label}</span>
        )}
      </button>
      {open && hasChildren && (
        <div className="mr-6 flex flex-col gap-1 border-e border-border pe-2">
          {node.father && <AncestorBranch node={node.father} />}
          {node.mother && <AncestorBranch node={node.mother} />}
        </div>
      )}
    </div>
  );
}

function DescendantBranch({ node }: { node: DescendantNode }) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => hasChildren && setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg border border-border bg-card p-2 text-start"
        disabled={!hasChildren}
      >
        {hasChildren ? (
          open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronLeft className="size-4 shrink-0" />
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <Link href={`/pedigree/view?id=${node.animal.id}`} className="text-sm font-medium text-primary">
          {node.animal.ear_tag}
          {node.animal.name ? ` (${node.animal.name})` : ""}
        </Link>
        {hasChildren && (
          <span className="text-xs text-muted-foreground">— {toPersianDigits(node.children.length)} فرزند</span>
        )}
      </button>
      {open && hasChildren && (
        <div className="mr-6 flex flex-col gap-1 border-e border-border pe-2">
          {node.children.map((c) => (
            <DescendantBranch key={c.animal.id} node={c} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Read-only snapshot of a clicked node's pedigree info — editing happens on the full profile page (already has every editor). */
function NodeInfoSheet({ animalId, onClose }: { animalId: string | null; onClose: () => void }) {
  const animal = useLiveQuery(() => (animalId ? db.animals.get(animalId) : undefined), [animalId]);
  const father = useLiveQuery(
    () => (animal?.father_id ? db.animals.get(animal.father_id) : undefined),
    [animal?.father_id]
  );
  const mother = useLiveQuery(
    () => (animal?.mother_id ? db.animals.get(animal.mother_id) : undefined),
    [animal?.mother_id]
  );

  const counts = useLiveQuery(async () => {
    if (!animalId) return null;
    const [weights, diseases, treatments, vaccinations, births] = await Promise.all([
      db.weight_records.where("animal_id").equals(animalId).toArray(),
      db.disease_records.where("animal_id").equals(animalId).toArray(),
      db.treatments.where("animal_id").equals(animalId).toArray(),
      db.vaccinations.where("animal_id").equals(animalId).toArray(),
      db.birth_records.where("mother_id").equals(animalId).toArray(),
    ]);
    return {
      weightCount: weights.filter((w) => !w.deleted_at).length,
      lastWeight: weights.filter((w) => !w.deleted_at).sort((a, b) => (a.record_date < b.record_date ? 1 : -1))[0],
      diseaseCount: diseases.filter((d) => !d.deleted_at).length,
      treatmentCount: treatments.filter((t) => !t.deleted_at).length,
      vaccinationCount: vaccinations.filter((v) => !v.deleted_at).length,
      birthEventCount: births.filter((b) => !b.deleted_at).length,
      offspringCount: births
        .filter((b) => !b.deleted_at)
        .reduce((sum, b) => sum + b.male_offspring_count + b.female_offspring_count, 0),
    };
  }, [animalId]);

  return (
    <Sheet open={!!animalId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {animal ? `${animal.ear_tag}${animal.name ? ` — ${animal.name}` : ""}` : "در حال بارگذاری…"}
          </SheetTitle>
        </SheetHeader>
        {animal && (
          <div className="flex flex-col gap-4 px-4 pb-4">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="پلاک گوش" value={animal.ear_tag} />
              <Field label="نام" value={animal.name ?? "—"} />
              <Field label="گونه" value={SPECIES_LABELS[animal.species]} />
              <Field label="نژاد" value={animal.breed ?? "—"} />
              <Field
                label="نوع"
                value={effectiveAnimalTypeLabel(animal.species, animal.gender, animal.birth_date, animal.animal_type)}
              />
              <Field label="جنسیت" value={animal.gender === "male" ? "نر" : animal.gender === "female" ? "ماده" : "—"} />
              <Field label="تاریخ تولد" value={animal.birth_date ? formatJalali(animal.birth_date) : "—"} />
              <Field label="سن" value={ageLabel(animal.birth_date)} />
              <Field label="وضعیت" value={ANIMAL_STATUS_LABELS[animal.status]} />
              <Field
                label="پدر"
                value={father ? father.ear_tag : "—"}
                href={father ? `/pedigree/view?id=${father.id}` : undefined}
              />
              <Field
                label="مادر"
                value={mother ? mother.ear_tag : "—"}
                href={mother ? `/pedigree/view?id=${mother.id}` : undefined}
              />
              <Field label="تعداد زایمان" value={toPersianDigits(counts?.birthEventCount ?? 0)} />
              <Field label="تعداد فرزندان" value={toPersianDigits(counts?.offspringCount ?? 0)} />
              <Field
                label="آخرین وزن ثبت‌شده"
                value={counts?.lastWeight ? `${toPersianDigits(counts.lastWeight.weight)} کیلوگرم` : "—"}
              />
              <Field label="تعداد ثبت بیماری" value={toPersianDigits(counts?.diseaseCount ?? 0)} />
              <Field label="تعداد درمان" value={toPersianDigits(counts?.treatmentCount ?? 0)} />
              <Field label="تعداد واکسیناسیون" value={toPersianDigits(counts?.vaccinationCount ?? 0)} />
            </div>
            {animal.notes && (
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted-foreground">یادداشت</span>
                <p className="text-sm">{animal.notes}</p>
              </div>
            )}
            <Button asChild size="lg" className="h-12">
              <Link href={`/animals/view?id=${animal.id}`}>مشاهده و ویرایش پروفایل کامل</Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground">{label}</span>
      {href ? (
        <Link href={href} className="text-primary">
          {value}
        </Link>
      ) : (
        <span>{value}</span>
      )}
    </div>
  );
}

function GeneticAnalysisCard({
  animal,
  father,
  mother,
  byId,
  candidates,
}: {
  animal: PedigreeAnimal;
  father: PedigreeAnimal | null;
  mother: PedigreeAnimal | null;
  byId: Map<string, PedigreeAnimal>;
  candidates: PedigreeAnimal[];
}) {
  const warning = father && mother ? inbreedingWarning(father, mother, byId) : null;
  const diversity = geneticDiversityScore(animal.id, byId);
  const mates = animal.gender === "male" || animal.gender === "female" ? recommendedMates(animal, candidates, byId) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          تحلیل ژنتیکی
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {warning ? (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{warning}</span>
          </div>
        ) : (
          <div className="rounded-lg bg-success/10 p-3 text-success">
            هشدار همخونی برای والدین این دام ثبت نشده است.
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg bg-muted p-3">
          <span className="text-muted-foreground">امتیاز تنوع ژنتیکی</span>
          <span className="text-lg font-bold text-primary">
            {diversity === null ? "بدون داده کافی" : `${toPersianDigits(diversity)}٪`}
          </span>
        </div>

        {mates.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground">جفت‌گیری پیشنهادی (کمترین خویشاوندی)</span>
            <ul className="flex flex-col gap-1">
              {mates.map((m) => (
                <li key={m.animal.id} className="flex items-center justify-between rounded-lg border border-border p-2">
                  <Link href={`/pedigree/view?id=${m.animal.id}`} className="text-primary">
                    {m.animal.ear_tag}
                    {m.animal.name ? ` — ${m.animal.name}` : ""}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    ضریب همخونی {toPersianDigits(Math.round(m.coefficient * 100))}٪
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PedigreeViewContent({ animalId }: { animalId: string }) {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const [view, setView] = useState<"list" | "graph">("list");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pageSize, setPageSize] = useState<PdfPageSize>("a4-portrait");
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  const [externalRelations, setExternalRelations] = useState<PedigreeRelation[]>([]);
  const graphHandleRef = useRef<PedigreeGraphHandle | null>(null);

  useEffect(() => {
    supabase
      .from("pedigree_relations")
      .select("*")
      .eq("animal_id", animalId)
      .then(({ data }) => setExternalRelations(data ?? []));
  }, [animalId]);

  const farmAnimals = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows.filter((a) => !a.deleted_at) as PedigreeAnimal[];
  }, [farmId]);

  const byId = useMemo(() => new Map((farmAnimals ?? []).map((a) => [a.id, a])), [farmAnimals]);
  const animal = byId.get(animalId);

  const { ancestorTree, descendantTree } = useMemo(() => {
    if (!animal || !farmAnimals) return { ancestorTree: null, descendantTree: [] as DescendantNode[] };
    const externalName = (relation: "پدر" | "مادر") =>
      externalRelations.find((r) => (relation === "پدر" ? r.relation_type === "father" : r.relation_type === "mother"))
        ?.external_name ?? null;

    return {
      ancestorTree: {
        animal,
        externalName: null,
        relationLabel: "دام",
        father: buildAncestorTree(animal.father_id, "پدر", byId, externalName),
        mother: buildAncestorTree(animal.mother_id, "مادر", byId, externalName),
      } as AncestorNode,
      descendantTree: buildDescendantTree(animalId, farmAnimals),
    };
  }, [animal, farmAnimals, byId, externalRelations, animalId]);

  const searchResults = useMemo(() => {
    const q = searchTerm.trim();
    if (!q || !ancestorTree) return [];
    const pool = [
      ...flattenAncestors(ancestorTree).map((f) => f.animal),
      ...flattenDescendants(descendantTree).map((f) => f.animal),
    ];
    return pool.filter((a) => [a.ear_tag, a.name ?? "", a.breed ?? ""].some((f) => f.includes(q))).slice(0, 8);
  }, [searchTerm, ancestorTree, descendantTree]);

  const totalGenerations = ancestorDepth(ancestorTree) + descendantDepth(descendantTree);
  const children = descendantTree;
  const grandchildren = children.flatMap((c) => c.children);

  async function handleExportPng() {
    if (!graphHandleRef.current) return;
    setExporting("png");
    try {
      const dataUrl = await graphHandleRef.current.capturePng();
      downloadDataUrl(dataUrl, `shajarename-${animal?.ear_tag ?? "animal"}.png`);
      toast.success("تصویر شجره‌نامه دانلود شد");
    } catch {
      toast.error("دانلود تصویر ناموفق بود");
    } finally {
      setExporting(null);
    }
  }

  async function handleExportPdf() {
    if (!graphHandleRef.current || !animal) return;
    setExporting("pdf");
    try {
      const dataUrl = await graphHandleRef.current.capturePng();
      await exportPedigreePdf(dataUrl, {
        animalLabel: animal.ear_tag,
        generationCount: totalGenerations,
        pageSize,
      });
      toast.success("PDF شجره‌نامه دانلود شد");
    } catch {
      toast.error("ساخت PDF ناموفق بود");
    } finally {
      setExporting(null);
    }
  }

  if (!animal) {
    return <p className="p-4 text-center text-muted-foreground">در حال بارگذاری یا دام یافت نشد…</p>;
  }

  const father = animal.father_id ? byId.get(animal.father_id) ?? null : null;
  const mother = animal.mother_id ? byId.get(animal.mother_id) ?? null : null;
  const mateCandidates = (farmAnimals ?? []).filter(
    (a) => a.species === animal.species && a.gender && a.gender !== animal.gender && a.id !== animal.id
  );

  return (
    <div className="pedigree-print-area flex flex-col gap-4 p-4">
      <div className="rounded-2xl border border-border bg-card p-4 text-center">
        <h1 className="text-xl font-bold">
          شجره‌نامه {animal.ear_tag}
          {animal.name ? ` — ${animal.name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {SPECIES_LABELS[animal.species as keyof typeof SPECIES_LABELS]}
          {animal.breed ? ` · ${animal.breed}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-muted p-3 text-center">
          <div className="text-2xl font-bold text-primary">{toPersianDigits(children.length)}</div>
          <div className="text-xs text-muted-foreground">فرزندان</div>
        </div>
        <div className="rounded-xl bg-muted p-3 text-center">
          <div className="text-2xl font-bold text-primary">{toPersianDigits(grandchildren.length)}</div>
          <div className="text-xs text-muted-foreground">نوه‌ها</div>
        </div>
        <div className="rounded-xl bg-muted p-3 text-center">
          <div className="text-2xl font-bold text-primary">{toPersianDigits(totalGenerations)}</div>
          <div className="text-xs text-muted-foreground">تعداد نسل</div>
        </div>
      </div>

      <div className="relative print:hidden">
        <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="جستجوی هر جد یا فرزند با پلاک، نام یا نژاد…"
          className="h-11 pr-9"
        />
        {searchResults.length > 0 && (
          <ul className="absolute z-10 mt-1 flex w-full flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-lg">
            {searchResults.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/pedigree/view?id=${a.id}`}
                  className="flex items-center justify-between rounded-lg p-2 hover:bg-muted"
                >
                  <span className="font-semibold">
                    {a.ear_tag}
                    {a.name ? ` — ${a.name}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">{a.breed ?? ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Tabs value={view} onValueChange={(v) => setView(v as "list" | "graph")} className="print:hidden">
        <TabsList>
          <TabsTrigger value="list">نمای فهرستی</TabsTrigger>
          <TabsTrigger value="graph">نمای گراف تعاملی</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="flex flex-col gap-6 pt-3">
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">اجداد (والدین به بالا)</h2>
            {ancestorTree && <AncestorBranch node={ancestorTree} />}
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-muted-foreground">
              فرزندان و نوادگان ({toPersianDigits(countDescendants(descendantTree))})
            </h2>
            {descendantTree.length === 0 ? (
              <p className="text-sm text-muted-foreground">فرزندی برای این دام ثبت نشده است.</p>
            ) : (
              descendantTree.map((node) => <DescendantBranch key={node.animal.id} node={node} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="graph" className="flex flex-col gap-3 pt-3">
          <PedigreeGraph
            focal={animal}
            ancestorTree={ancestorTree}
            descendantTree={descendantTree}
            onNodeClick={(a) => setSelectedNodeId(a.id)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((v) => !v)}
            onReady={(handle) => {
              graphHandleRef.current = handle;
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Select value={pageSize} onValueChange={(v) => setPageSize(v as PdfPageSize)}>
              <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a4-portrait">A4 عمودی</SelectItem>
                <SelectItem value="a3-landscape">A3 افقی</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exporting !== null}>
              {exporting === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              دانلود شجره‌نامه PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPng} disabled={exporting !== null}>
              {exporting === "png" ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
              دانلود PNG
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" />
              چاپ
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div className="print:hidden">
        <GeneticAnalysisCard animal={animal} father={father} mother={mother} byId={byId} candidates={mateCandidates} />
      </div>

      <NodeInfoSheet animalId={selectedNodeId} onClose={() => setSelectedNodeId(null)} />
    </div>
  );
}

function PedigreeViewInner() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) return <p className="p-4 text-center text-muted-foreground">دامی مشخص نشده است</p>;
  return <PedigreeViewContent animalId={id} />;
}

export default function PedigreeViewPage() {
  return (
    <Suspense fallback={<p className="p-4 text-center text-muted-foreground">در حال بارگذاری…</p>}>
      <PedigreeViewInner />
    </Suspense>
  );
}
