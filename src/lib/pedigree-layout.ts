import type { AncestorNode, DescendantNode, PedigreeAnimal } from "@/lib/pedigree";

/**
 * Pure coordinate layout for the interactive pedigree graph — kept separate
 * from the React Flow component so the geometry is unit-testable without a
 * browser. Ancestors are placed above the focal animal, split left/right by
 * father/mother lineage (classic pedigree-chart convention); descendants are
 * placed below using a tidy-tree layout (each node centered over its own
 * children, width proportional to leaf count) so siblings never overlap.
 */

export interface LayoutNode {
  id: string;
  animal: PedigreeAnimal;
  x: number;
  y: number;
  /** Negative = ancestor generation, 0 = the focal animal, positive = descendant generation. */
  generation: number;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
}

export const ROW_HEIGHT = 170;
export const COL_WIDTH = 220;

function placeAncestors(
  node: AncestorNode | null,
  depth: number,
  xMin: number,
  xMax: number,
  childId: string,
  nodes: LayoutNode[],
  edges: LayoutEdge[]
) {
  if (!node || !node.animal) return;
  const x = (xMin + xMax) / 2;
  nodes.push({ id: node.animal.id, animal: node.animal, x, y: -depth * ROW_HEIGHT, generation: -depth });
  edges.push({ id: `e-${node.animal.id}-${childId}`, source: node.animal.id, target: childId });
  placeAncestors(node.father, depth + 1, xMin, x, node.animal.id, nodes, edges);
  placeAncestors(node.mother, depth + 1, x, xMax, node.animal.id, nodes, edges);
}

/** Depth-first placement; returns the [start, end) leaf-unit range this node's subtree occupies. */
function placeDescendants(
  list: DescendantNode[],
  depth: number,
  parentId: string,
  cursor: { value: number },
  nodes: LayoutNode[],
  edges: LayoutEdge[]
) {
  for (const node of list) {
    let centerUnit: number;
    if (node.children.length === 0) {
      centerUnit = cursor.value;
      cursor.value += 1;
    } else {
      const start = cursor.value;
      placeDescendants(node.children, depth + 1, node.animal.id, cursor, nodes, edges);
      centerUnit = (start + cursor.value - 1) / 2;
    }
    nodes.push({
      id: node.animal.id,
      animal: node.animal,
      x: centerUnit * COL_WIDTH,
      y: depth * ROW_HEIGHT,
      generation: depth,
    });
    edges.push({ id: `e-${parentId}-${node.animal.id}`, source: parentId, target: node.animal.id });
  }
}

export function layoutPedigreeGraph(
  focal: PedigreeAnimal,
  ancestorTree: AncestorNode | null,
  descendantTree: DescendantNode[]
): { nodes: LayoutNode[]; edges: LayoutEdge[] } {
  const nodes: LayoutNode[] = [{ id: focal.id, animal: focal, x: 0, y: 0, generation: 0 }];
  const edges: LayoutEdge[] = [];

  if (ancestorTree) {
    // Half-width generous enough that even a deep (12-generation) chain
    // never runs out of room, however sparse the real data usually is.
    const span = COL_WIDTH * 64;
    placeAncestors(ancestorTree.father, 1, -span, 0, focal.id, nodes, edges);
    placeAncestors(ancestorTree.mother, 1, 0, span, focal.id, nodes, edges);
  }

  const cursor = { value: 0 };
  const descendantNodes: LayoutNode[] = [];
  const descendantEdges: LayoutEdge[] = [];
  placeDescendants(descendantTree, 1, focal.id, cursor, descendantNodes, descendantEdges);

  // Recenter the descendant block under the focal animal (x=0).
  const totalWidth = (cursor.value - 1) * COL_WIDTH;
  const offset = totalWidth / 2;
  for (const n of descendantNodes) n.x -= offset;

  nodes.push(...descendantNodes);
  edges.push(...descendantEdges);

  return { nodes, edges };
}
