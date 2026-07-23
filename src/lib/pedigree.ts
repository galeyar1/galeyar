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

export const MAX_ANCESTOR_GENERATIONS = 4;
export const MAX_DESCENDANT_GENERATIONS = 3;

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
  maxDepth = MAX_ANCESTOR_GENERATIONS
): AncestorNode | null {
  if (!animalId) {
    const externalName = externalNameFor(relationLabel);
    return externalName ? { animal: null, externalName, relationLabel, father: null, mother: null } : null;
  }

  const animal = byId.get(animalId);
  if (!animal) return null;

  const node: AncestorNode = { animal, externalName: null, relationLabel, father: null, mother: null };
  if (depth < maxDepth) {
    node.father = buildAncestorTree(animal.father_id, "پدر", byId, () => null, depth + 1, maxDepth);
    node.mother = buildAncestorTree(animal.mother_id, "مادر", byId, () => null, depth + 1, maxDepth);
  }
  return node;
}

/** Direct children (mother_id or father_id === animalId), recursing down to maxDepth generations. */
export function buildDescendantTree(
  animalId: string,
  allAnimals: PedigreeAnimal[],
  depth = 1,
  maxDepth = MAX_DESCENDANT_GENERATIONS
): DescendantNode[] {
  const direct = allAnimals.filter((a) => a.father_id === animalId || a.mother_id === animalId);

  return direct.map((child) => ({
    animal: child,
    children: depth < maxDepth ? buildDescendantTree(child.id, allAnimals, depth + 1, maxDepth) : [],
  }));
}

/** Total node count across every generation, for a "N descendants" summary. */
export function countDescendants(nodes: DescendantNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countDescendants(n.children), 0);
}
