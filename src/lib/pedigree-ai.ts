import type { PedigreeAnimal } from "@/lib/pedigree";

/**
 * Rule-based genetic-relatedness analysis over the pedigree graph — no
 * external model, just deterministic ancestor-path math (Wright's
 * coefficient of relationship). Framed as "genetic analysis" rather than
 * a black-box "AI" because that's what's actually computed and verifiable.
 */

const DEFAULT_MAX_DEPTH = 6;

/** Every ancestor id reachable from `animalId`, mapped to the shallowest generation it's found at (1 = parent). */
export function ancestorDepths(
  animalId: string | null,
  byId: Map<string, PedigreeAnimal>,
  maxDepth = DEFAULT_MAX_DEPTH
): Map<string, number> {
  const result = new Map<string, number>();
  const root = animalId ? byId.get(animalId) : undefined;
  if (!root || !animalId) return result;

  function walk(id: string | null, depth: number, visited: Set<string>) {
    if (!id || depth > maxDepth || visited.has(id)) return;
    const animal = byId.get(id);
    if (!animal) return;
    const existing = result.get(id);
    if (existing === undefined || depth < existing) result.set(id, depth);
    const nextVisited = new Set(visited).add(id);
    walk(animal.father_id, depth + 1, nextVisited);
    walk(animal.mother_id, depth + 1, nextVisited);
  }

  walk(root.father_id, 1, new Set([animalId]));
  walk(root.mother_id, 1, new Set([animalId]));
  return result;
}

export interface CommonAncestor {
  id: string;
  depthA: number;
  depthB: number;
}

/** Ancestors shared between two individuals' lineages, with each side's generation distance. */
export function commonAncestors(
  idA: string,
  idB: string,
  byId: Map<string, PedigreeAnimal>,
  maxDepth = DEFAULT_MAX_DEPTH
): CommonAncestor[] {
  const ancestorsA = ancestorDepths(idA, byId, maxDepth);
  const ancestorsB = ancestorDepths(idB, byId, maxDepth);
  const shared: CommonAncestor[] = [];
  for (const [id, depthA] of ancestorsA) {
    const depthB = ancestorsB.get(id);
    if (depthB !== undefined) shared.push({ id, depthA, depthB });
  }
  return shared;
}

/**
 * Wright's coefficient of relationship, approximated from shared ancestors:
 * F = sum over common ancestors of (1/2)^(depthA + depthB + 1). Full siblings
 * sharing both parents (depth 1 each) score 0.25; sharing one grandparent
 * (depth 2 each) scores 0.03125 (~3%); unrelated animals score 0.
 */
export function inbreedingCoefficient(
  idA: string,
  idB: string,
  byId: Map<string, PedigreeAnimal>,
  maxDepth = DEFAULT_MAX_DEPTH
): number {
  const shared = commonAncestors(idA, idB, byId, maxDepth);
  return shared.reduce((sum, a) => sum + Math.pow(0.5, a.depthA + a.depthB + 1), 0);
}

/** Above this coefficient a mating is flagged — roughly "shared grandparent or closer". */
export const INBREEDING_ALERT_THRESHOLD = 0.03;

function closestRelationLabel(shared: CommonAncestor[]): string {
  const closest = Math.min(...shared.map((a) => Math.max(a.depthA, a.depthB)));
  if (closest === 1) return "پدر/مادر مشترک";
  if (closest === 2) return "پدربزرگ/مادربزرگ مشترک";
  return "جد مشترک";
}

/**
 * Builds a warning like "هشدار: قوچ HM-001 و میش HM-115 یک جد مشترک
 * (پدربزرگ/مادربزرگ مشترک) دارند." for a candidate or recorded mating.
 * Returns null when the pair isn't closely related.
 */
export function inbreedingWarning(
  male: PedigreeAnimal,
  female: PedigreeAnimal,
  byId: Map<string, PedigreeAnimal>,
  maxDepth = DEFAULT_MAX_DEPTH
): string | null {
  const shared = commonAncestors(male.id, female.id, byId, maxDepth);
  if (shared.length === 0) return null;
  const coefficient = inbreedingCoefficient(male.id, female.id, byId, maxDepth);
  if (coefficient < INBREEDING_ALERT_THRESHOLD) return null;

  const relation = closestRelationLabel(shared);
  return `هشدار: ${male.ear_tag} و ${female.ear_tag} یک جد مشترک (${relation}) دارند — ضریب همخونی حدود ${Math.round(
    coefficient * 100
  )}%.`;
}

/**
 * Genetic diversity score: what fraction of the animal's known ancestor
 * slots (up to maxDepth generations) are distinct individuals. 100% means
 * every known ancestor is unique (no repeated bloodline); lower values mean
 * the same ancestor appears through more than one path (inbreeding within
 * the recorded pedigree).
 */
export function geneticDiversityScore(
  animalId: string,
  byId: Map<string, PedigreeAnimal>,
  maxDepth = DEFAULT_MAX_DEPTH
): number | null {
  const animal = byId.get(animalId);
  if (!animal) return null;

  let totalSlots = 0;
  const uniqueIds = new Set<string>();

  function walk(id: string | null, depth: number, visited: Set<string>) {
    if (!id || depth > maxDepth || visited.has(id)) return;
    const a = byId.get(id);
    if (!a) return;
    totalSlots += 1;
    uniqueIds.add(id);
    const nextVisited = new Set(visited).add(id);
    walk(a.father_id, depth + 1, nextVisited);
    walk(a.mother_id, depth + 1, nextVisited);
  }

  walk(animal.father_id, 1, new Set([animalId]));
  walk(animal.mother_id, 1, new Set([animalId]));

  if (totalSlots === 0) return null; // no recorded ancestors at all — no basis for a score
  return Math.round((uniqueIds.size / totalSlots) * 100);
}

export interface MateRecommendation {
  animal: PedigreeAnimal;
  coefficient: number;
}

/**
 * Ranks candidate mates by lowest relatedness to `animal` (most genetically
 * distant first) — a simple stand-in for "recommended breeding pairs".
 * Candidates already flagged by inbreedingWarning are excluded outright.
 */
export function recommendedMates(
  animal: PedigreeAnimal,
  candidates: PedigreeAnimal[],
  byId: Map<string, PedigreeAnimal>,
  maxDepth = DEFAULT_MAX_DEPTH,
  limit = 3
): MateRecommendation[] {
  return candidates
    .filter((c) => c.id !== animal.id)
    .map((c) => ({ animal: c, coefficient: inbreedingCoefficient(animal.id, c.id, byId, maxDepth) }))
    .filter((c) => c.coefficient < INBREEDING_ALERT_THRESHOLD)
    .sort((a, b) => a.coefficient - b.coefficient)
    .slice(0, limit);
}
