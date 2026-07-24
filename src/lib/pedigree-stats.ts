import { buildDescendantTree, countDescendants, descendantDepth, type PedigreeAnimal } from "@/lib/pedigree";
import { inbreedingCoefficient, INBREEDING_ALERT_THRESHOLD } from "@/lib/pedigree-ai";

/**
 * Farm-wide pedigree summary for the dashboard card. Pure function over the
 * full animal list — the caller (Dexie query) supplies that once.
 */
export interface PedigreeFarmStats {
  totalFamilyTrees: number;
  largestBloodline: { rootEarTag: string; descendantCount: number } | null;
  totalGenerations: number;
  inbreedingAlerts: number;
}

/** A "founder" is a recorded animal with no known parents — the root of one bloodline. */
function founders(animals: PedigreeAnimal[]): PedigreeAnimal[] {
  return animals.filter((a) => !a.father_id && !a.mother_id);
}

export function computePedigreeFarmStats(animals: PedigreeAnimal[]): PedigreeFarmStats {
  const byId = new Map(animals.map((a) => [a.id, a]));
  const roots = founders(animals).filter((f) => animals.some((a) => a.father_id === f.id || a.mother_id === f.id));

  let largest: { rootEarTag: string; descendantCount: number } | null = null;
  let maxGenerations = 0;

  for (const root of roots) {
    const tree = buildDescendantTree(root.id, animals);
    const count = countDescendants(tree);
    const depth = descendantDepth(tree);
    if (depth > maxGenerations) maxGenerations = depth;
    if (!largest || count > largest.descendantCount) {
      largest = { rootEarTag: root.ear_tag, descendantCount: count };
    }
  }

  let inbreedingAlerts = 0;
  for (const a of animals) {
    if (!a.father_id || !a.mother_id) continue;
    const father = byId.get(a.father_id);
    const mother = byId.get(a.mother_id);
    if (!father || !mother) continue;
    if (inbreedingCoefficient(father.id, mother.id, byId) >= INBREEDING_ALERT_THRESHOLD) inbreedingAlerts += 1;
  }

  return {
    totalFamilyTrees: roots.length,
    largestBloodline: largest,
    totalGenerations: maxGenerations,
    inbreedingAlerts,
  };
}
