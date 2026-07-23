"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronLeft } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { supabase } from "@/lib/supabase/client";
import { SPECIES_LABELS } from "@/lib/animal-labels";
import { toPersianDigits } from "@/lib/jalali";
import {
  buildAncestorTree,
  buildDescendantTree,
  countDescendants,
  type AncestorNode,
  type DescendantNode,
  type PedigreeAnimal,
} from "@/lib/pedigree";
import type { PedigreeRelation } from "@/lib/supabase/types";

function AncestorTree({ node }: { node: AncestorNode }) {
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
          <Link href={`/animals/view?id=${node.animal.id}`} className="text-sm font-medium text-primary">
            {label}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">{label}</span>
        )}
      </button>
      {open && hasChildren && (
        <div className="mr-6 flex flex-col gap-1 border-e border-border pe-2">
          {node.father && <AncestorTree node={node.father} />}
          {node.mother && <AncestorTree node={node.mother} />}
        </div>
      )}
    </div>
  );
}

function DescendantTree({ node }: { node: DescendantNode }) {
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
        <Link href={`/animals/view?id=${node.animal.id}`} className="text-sm font-medium text-primary">
          {node.animal.ear_tag}
          {node.animal.name ? ` (${node.animal.name})` : ""}
        </Link>
        {hasChildren && (
          <span className="text-xs text-muted-foreground">
            — {toPersianDigits(node.children.length)} فرزند
          </span>
        )}
      </button>
      {open && hasChildren && (
        <div className="mr-6 flex flex-col gap-1 border-e border-border pe-2">
          {node.children.map((c) => (
            <DescendantTree key={c.animal.id} node={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function PedigreeContent({ animalId }: { animalId: string }) {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;
  const [externalRelations, setExternalRelations] = useState<PedigreeRelation[]>([]);

  useEffect(() => {
    supabase
      .from("pedigree_relations")
      .select("*")
      .eq("animal_id", animalId)
      .then(({ data }) => setExternalRelations(data ?? []));
  }, [animalId]);

  const fullAnimal = useLiveQuery(() => db.animals.get(animalId), [animalId]);

  const farmAnimals = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows.filter((a) => !a.deleted_at) as PedigreeAnimal[];
  }, [farmId]);

  const animal = useMemo(() => farmAnimals?.find((a) => a.id === animalId), [farmAnimals, animalId]);

  const { ancestorTree, descendantTree } = useMemo(() => {
    if (!animal || !farmAnimals) return { ancestorTree: null, descendantTree: [] as DescendantNode[] };

    const byId = new Map(farmAnimals.map((a) => [a.id, a]));
    const externalName = (relation: "پدر" | "مادر") =>
      externalRelations.find((r) => (relation === "پدر" ? r.relation_type === "father" : r.relation_type === "mother"))
        ?.external_name ?? null;

    const father = buildAncestorTree(animal.father_id, "پدر", byId, externalName);
    const mother = buildAncestorTree(animal.mother_id, "مادر", byId, externalName);
    const descendants = buildDescendantTree(animalId, farmAnimals);

    return {
      ancestorTree: { animal, externalName: null, relationLabel: "دام", father, mother } as AncestorNode,
      descendantTree: descendants,
    };
  }, [animal, farmAnimals, externalRelations, animalId]);

  if (!animal) {
    return <p className="p-4 text-center text-muted-foreground">در حال بارگذاری یا دام یافت نشد…</p>;
  }

  const children = descendantTree;
  const grandchildren = children.flatMap((c) => c.children);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="rounded-2xl border border-border bg-card p-4 text-center">
        <h1 className="text-xl font-bold">
          شجره‌نامه {animal.ear_tag}
          {animal.name ? ` — ${animal.name}` : ""}
        </h1>
        {fullAnimal?.species && (
          <p className="text-sm text-muted-foreground">
            {SPECIES_LABELS[fullAnimal.species as keyof typeof SPECIES_LABELS]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted p-3 text-center">
          <div className="text-2xl font-bold text-primary">{toPersianDigits(children.length)}</div>
          <div className="text-xs text-muted-foreground">فرزندان</div>
        </div>
        <div className="rounded-xl bg-muted p-3 text-center">
          <div className="text-2xl font-bold text-primary">{toPersianDigits(grandchildren.length)}</div>
          <div className="text-xs text-muted-foreground">نوه‌ها</div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">اجداد (والدین به بالا)</h2>
        {ancestorTree && <AncestorTree node={ancestorTree} />}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          فرزندان و نوادگان ({toPersianDigits(countDescendants(descendantTree))})
        </h2>
        {descendantTree.length === 0 ? (
          <p className="text-sm text-muted-foreground">فرزندی برای این دام ثبت نشده است.</p>
        ) : (
          descendantTree.map((node) => <DescendantTree key={node.animal.id} node={node} />)
        )}
      </div>
    </div>
  );
}

function PedigreeInner() {
  const params = useSearchParams();
  const id = params.get("id");
  if (!id) return <p className="p-4 text-center text-muted-foreground">دامی مشخص نشده است</p>;
  return <PedigreeContent animalId={id} />;
}

export default function PedigreePage() {
  return (
    <Suspense fallback={<p className="p-4 text-center text-muted-foreground">در حال بارگذاری…</p>}>
      <PedigreeInner />
    </Suspense>
  );
}
