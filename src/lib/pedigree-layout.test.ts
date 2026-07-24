import { describe, it, expect } from "vitest";
import { layoutPedigreeGraph, ROW_HEIGHT, COL_WIDTH } from "@/lib/pedigree-layout";
import { buildAncestorTree, buildDescendantTree, type PedigreeAnimal } from "@/lib/pedigree";

function animal(id: string, ear_tag: string, father_id: string | null = null, mother_id: string | null = null): PedigreeAnimal {
  return { id, ear_tag, name: null, father_id, mother_id };
}

describe("layoutPedigreeGraph", () => {
  it("places the focal animal at the origin", () => {
    const focal = animal("me", "ME");
    const { nodes } = layoutPedigreeGraph(focal, null, []);
    expect(nodes).toEqual([{ id: "me", animal: focal, x: 0, y: 0, generation: 0 }]);
  });

  it("places father to one side and mother to the other, one row above", () => {
    const father = animal("f", "F");
    const mother = animal("m", "M");
    const me = animal("me", "ME", "f", "m");
    const byId = new Map([
      ["f", father],
      ["m", mother],
      ["me", me],
    ]);
    const ancestorTree = {
      animal: me,
      externalName: null,
      relationLabel: "دام",
      father: buildAncestorTree("f", "پدر", byId, () => null),
      mother: buildAncestorTree("m", "مادر", byId, () => null),
    };

    const { nodes, edges } = layoutPedigreeGraph(me, ancestorTree, []);
    const fatherNode = nodes.find((n) => n.id === "f")!;
    const motherNode = nodes.find((n) => n.id === "m")!;

    expect(fatherNode.y).toBe(-ROW_HEIGHT);
    expect(motherNode.y).toBe(-ROW_HEIGHT);
    expect(fatherNode.x).not.toBe(motherNode.x);
    expect(edges).toContainEqual({ id: "e-f-me", source: "f", target: "me" });
    expect(edges).toContainEqual({ id: "e-m-me", source: "m", target: "me" });
  });

  it("centers two children symmetrically around the focal animal's x", () => {
    const me = animal("me", "ME");
    const tree = buildDescendantTree("me", [me, animal("c1", "C1", null, "me"), animal("c2", "C2", null, "me")]);

    const { nodes } = layoutPedigreeGraph(me, null, tree);
    const c1 = nodes.find((n) => n.id === "c1")!;
    const c2 = nodes.find((n) => n.id === "c2")!;

    expect(c1.y).toBe(ROW_HEIGHT);
    expect(c2.y).toBe(ROW_HEIGHT);
    expect(c1.x + c2.x).toBeCloseTo(0, 5);
    expect(Math.abs(c1.x - c2.x)).toBeCloseTo(COL_WIDTH, 5);
  });

  it("centers a parent over its own children (grandchildren)", () => {
    const me = animal("me", "ME");
    const tree = buildDescendantTree("me", [
      me,
      animal("child", "CHILD", null, "me"),
      animal("gc1", "GC1", null, "child"),
      animal("gc2", "GC2", null, "child"),
    ]);

    const { nodes } = layoutPedigreeGraph(me, null, tree);
    const child = nodes.find((n) => n.id === "child")!;
    const gc1 = nodes.find((n) => n.id === "gc1")!;
    const gc2 = nodes.find((n) => n.id === "gc2")!;

    expect(child.x).toBeCloseTo((gc1.x + gc2.x) / 2, 5);
  });
});
