/**
 * Pure pedigree tree-building logic, deliberately separated from Dexie/
 * Supabase I/O so it's unit-testable without a database. The page loads
 * every animal for the farm once, then calls these synchronous builders.
 */

export interface PedigreeAnimal {
  id: string;
  ear_tag: string;
  name: string | null;
  father_id: string | null;
  mother_id: string | null;
  // Optional — only needed by the graph view's node cards and the genetic
  // analysis module. Kept optional so plain {id, ear_tag, name, father_id,
  // mother_id} fixtures (as used in tests) still satisfy this type.
  species?: string;
  breed?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  animal_type?: string | null;
  status?: string;
}

export interface AncestorNode {
  animal: PedigreeAnimal | null;
  externalName: string | null;
  relationLabel: string;
  father: AncestorNode | null;
  mother: AncestorNode | null;
}

export interface DescendantNode {
  animal: PedigreeAnimal;
  children: DescendantNode[];
}

// Generous rather than "unlimited" — a real farm's tracked pedigree rarely
// exceeds a handful of generations, but this comfortably covers 10+ without
// risking a pathological render. A visited-set below guards against a data
// cycle turning this into an infinite loop regardless of the cap.
export const MAX_ANCESTOR_GENERATIONS = 12;
export const MAX_DESCENDANT_GENERATIONS = 10;

/**
 * Builds the ancestor chain for a given parent slot (father/mother),
 * recursing up to maxDepth generations. `externalNameFor` resolves a
 * manually-recorded ancestor name (pedigree_relations) when the animal
 * doesn't have a matching tracked record — pass a no-op returning null if
 * external ancestors aren't available.
 */
export function buildAncestorTree(
  animalId: string | null,
  relationLabel: "پدر" | "مادر",
  byId: Map<string, PedigreeAnimal>,
  externalNameFor: (relation: "پدر" | "مادر") => string | null,
  depth = 1,
  maxDepth = MAX_ANCESTOR_GENERATIONS,
  visited: Set<string> = new Set()
): AncestorNode | null {
  if (!animalId) {
    const externalName = externalNameFor(relationLabel);
    return externalName ? { animal: null, externalName, relationLabel, father: null, mother: null } : null;
  }

  // A cycle in the data (corrupted records) would otherwise recurse forever.
  if (visited.has(animalId)) return null;

  const animal = byId.get(animalId);
  if (!animal) return null;

  const nextVisited = new Set(visited).add(animalId);
  const node: AncestorNode = { animal, externalName: null, relationLabel, father: null, mother: null };
  if (depth < maxDepth) {
    node.father = buildAncestorTree(animal.father_id, "پدر", byId, () => null, depth + 1, maxDepth, nextVisited);
    node.mother = buildAncestorTree(animal.mother_id, "مادر", byId, () => null, depth + 1, maxDepth, nextVisited);
  }
  return node;
}

/** Direct children (mother_id or father_id === animalId), recursing down to maxDepth generations. */
export function buildDescendantTree(
  animalId: string,
  allAnimals: PedigreeAnimal[],
  depth = 1,
  maxDepth = MAX_DESCENDANT_GENERATIONS,
  visited: Set<string> = new Set()
): DescendantNode[] {
  if (visited.has(animalId)) return [];
  const nextVisited = new Set(visited).add(animalId);

  const direct = allAnimals.filter((a) => a.father_id === animalId || a.mother_id === animalId);

  return direct.map((child) => ({
    animal: child,
    children: depth < maxDepth ? buildDescendantTree(child.id, allAnimals, depth + 1, maxDepth, nextVisited) : [],
  }));
}

/** Total node count across every generation, for a "N descendants" summary. */
export function countDescendants(nodes: DescendantNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countDescendants(n.children), 0);
}

/** How many generations deep the ancestor chain actually goes (0 = no known ancestors). */
export function ancestorDepth(node: AncestorNode | null): number {
  if (!node || (!node.father && !node.mother)) return 0;
  return 1 + Math.max(ancestorDepth(node.father), ancestorDepth(node.mother));
}

/** How many generations deep the descendant tree actually goes (0 = no offspring). */
export function descendantDepth(nodes: DescendantNode[]): number {
  if (nodes.length === 0) return 0;
  return 1 + Math.max(...nodes.map((n) => descendantDepth(n.children)));
}

export interface FlatAncestor {
  animal: PedigreeAnimal;
  relationLabel: string;
  depth: number;
}

/** Flattens the ancestor tree into a single list — used for graph layout and in-tree search. */
export function flattenAncestors(node: AncestorNode | null, depth = 0): FlatAncestor[] {
  if (!node || !node.animal) return [];
  const rest = [
    ...flattenAncestors(node.father, depth + 1),
    ...flattenAncestors(node.mother, depth + 1),
  ];
  return depth === 0 ? rest : [{ animal: node.animal, relationLabel: node.relationLabel, depth }, ...rest];
}

export interface FlatDescendant {
  animal: PedigreeAnimal;
  depth: number;
}

/** Flattens the descendant tree into a single list — used for graph layout and in-tree search. */
export function flattenDescendants(nodes: DescendantNode[], depth = 1): FlatDescendant[] {
  return nodes.flatMap((n) => [{ animal: n.animal, depth }, ...flattenDescendants(n.children, depth + 1)]);
}
