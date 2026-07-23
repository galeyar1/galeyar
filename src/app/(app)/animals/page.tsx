"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Plus, Clock } from "lucide-react";

import { db } from "@/lib/db/schema";
import { useAuth } from "@/lib/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SPECIES_LABELS, ANIMAL_STATUS_LABELS } from "@/lib/animal-labels";
import { formatJalali } from "@/lib/jalali";

export default function AnimalsPage() {
  const { profile } = useAuth();
  const farmId = profile?.farm_id;

  const animals = useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows
      .filter((a) => !a.deleted_at)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }, [farmId]);

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

      {animals?.length === 0 && (
        <p className="mt-10 text-center text-muted-foreground">
          هنوز دامی ثبت نشده است. با دکمه بالا اولین دام را ثبت کنید.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {animals?.map((animal) => (
          <li
            key={animal.id}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4"
          >
            <div className="flex flex-col gap-1">
              <span className="text-lg font-semibold">
                {animal.name ? `${animal.name} — ` : ""}
                {animal.ear_tag}
              </span>
              <span className="text-sm text-muted-foreground">
                {SPECIES_LABELS[animal.species]}
                {animal.birth_date ? ` · متولد ${formatJalali(animal.birth_date)}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {animal.sync_status === "pending" && (
                <Clock className="size-4 text-warning" aria-label="در انتظار همگام‌سازی" />
              )}
              <Badge variant={animal.status === "active" ? "default" : "secondary"}>
                {ANIMAL_STATUS_LABELS[animal.status]}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
