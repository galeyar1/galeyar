import { describe, it, expect } from "vitest";
import {
  buildAncestorTree,
  buildDescendantTree,
  countDescendants,
  type PedigreeAnimal,
} from "@/lib/pedigree";

function animal(id: string, ear_tag: string, father_id: string | null = null, mother_id: string | null = null): PedigreeAnimal {
  return { id, ear_tag, name: null, father_id, mother_id };
}

describe("buildAncestorTree", () => {
  it("returns null when there is no parent and no external record", () => {
    const byId = new Map<string, PedigreeAnimal>();
    const node = buildAncestorTree(null, "پدر", byId, () => null);
    expect(node).toBeNull();
  });

  it("falls back to an external (untracked) ancestor name when there's no linked animal", () => {
    const byId = new Map<string, PedigreeAnimal>();
    const node = buildAncestorTree(null, "پدر", byId, (rel) => (rel === "پدر" ? "قوچ خریداری‌شده" : null));
    expect(node).toEqual({
      animal: null,
      externalName: "قوچ خریداری‌شده",
      relationLabel: "پدر",
      father: null,
      mother: null,
    });
  });

  it("recurses through multiple generations via father_id/mother_id", () => {
    const grandfather = animal("gf", "100");
    const father = animal("f", "200", "gf");
    const byId = new Map([
      ["gf", grandfather],
      ["f", father],
    ]);

    const node = buildAncestorTree("f", "پدر", byId, () => null);
    expect(node?.animal?.ear_tag).toBe("200");
    expect(node?.father?.animal?.ear_tag).toBe("100");
    expect(node?.mother).toBeNull();
  });

  it("stops recursing at maxDepth generations", () => {
    // Chain of 6 ancestors, but capped at depth 2.
    const a1 = animal("1", "1");
    const a2 = animal("2", "2", "1");
    const a3 = animal("3", "3", "2");
    const byId = new Map([
      ["1", a1],
      ["2", a2],
      ["3", a3],
    ]);

    const node = buildAncestorTree("3", "پدر", byId, () => null, 1, 2);
    expect(node?.animal?.ear_tag).toBe("3");
    expect(node?.father?.animal?.ear_tag).toBe("2");
    // depth reached maxDepth (2) at node.father, so it should not expand further
    expect(node?.father?.father).toBeNull();
  });
});

describe("buildDescendantTree", () => {
  it("finds direct children by either father_id or mother_id", () => {
    const mother = animal("m", "mother-tag");
    const childA = animal("c1", "child-1", null, "m");
    const childB = animal("c2", "child-2", "m", null); // father_id points at "m" on purpose (data-shape test only)
    const unrelated = animal("x", "unrelated");

    const tree = buildDescendantTree("m", [mother, childA, childB, unrelated]);
    const tags = tree.map((n) => n.animal.ear_tag).sort();
    expect(tags).toEqual(["child-1", "child-2"]);
  });

  it("recurses into grandchildren", () => {
    const grandparent = animal("gp", "gp");
    const parent = animal("p", "p", null, "gp");
    const child = animal("c", "c", null, "p");

    const tree = buildDescendantTree("gp", [grandparent, parent, child]);
    expect(tree).toHaveLength(1);
    expect(tree[0].animal.ear_tag).toBe("p");
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].animal.ear_tag).toBe("c");
  });

  it("returns an empty array for an animal with no offspring", () => {
    const solo = animal("s", "solo");
    expect(buildDescendantTree("s", [solo])).toEqual([]);
  });
});

describe("countDescendants", () => {
  it("counts every node across all generations", () => {
    const tree = buildDescendantTree(
      "gp",
      [animal("gp", "gp"), animal("p1", "p1", null, "gp"), animal("p2", "p2", null, "gp"), animal("c1", "c1", null, "p1")]
    );
    // p1, p2 (2 children) + c1 (1 grandchild) = 3
    expect(countDescendants(tree)).toBe(3);
  });

  it("returns 0 for an empty tree", () => {
    expect(countDescendants([])).toBe(0);
  });
});
