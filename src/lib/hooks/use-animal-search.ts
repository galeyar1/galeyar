"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { normalizeAnimalSearch } from "@/lib/animal-labels";
import type { Animal, Species } from "@/lib/supabase/types";

export interface AnimalListFilters {
  farmId: string | null | undefined;
  species?: Species;
  gender?: "all" | "female" | "male";
  /** Off by default — current-operations selectors (health, weight, milk, deworming…) only want active animals. */
  includeInactive?: boolean;
}

/**
 * The single farm-scoped animal list every selector (AnimalPicker,
 * AnimalMultiPicker) is built on, so "which animals are eligible" is defined
 * in exactly one place. Reads from Dexie — already fully synced locally
 * offline-first, so this is a fast in-memory filter, never a network
 * round-trip, and stays fast even for a large herd.
 */
export function useFarmAnimals(filters: AnimalListFilters): Animal[] | undefined {
  const { farmId, species, gender = "all", includeInactive = false } = filters;
  return useLiveQuery(async () => {
    if (!farmId) return [];
    const rows = await db.animals.where("farm_id").equals(farmId).toArray();
    return rows
      .filter((a) => !a.deleted_at)
      .filter((a) => includeInactive || a.status === "active")
      .filter((a) => gender === "all" || a.gender === gender)
      .filter((a) => !species || a.species === species)
      .sort((a, b) => (a.ear_tag > b.ear_tag ? 1 : -1));
  }, [farmId, species, gender, includeInactive]);
}

/** Ear tag / name / breed substring match, Persian-digit and case normalized — the same matching rule everywhere an animal is searched. */
export function searchAnimals(animals: Animal[], query: string): Animal[] {
  const q = normalizeAnimalSearch(query.trim());
  if (!q) return animals;
  return animals.filter((a) => [a.ear_tag, a.name ?? "", a.breed ?? ""].some((field) => normalizeAnimalSearch(field).includes(q)));
}
