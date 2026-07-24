import { describe, it, expect } from "vitest";
import {
  ancestorDepths,
  commonAncestors,
  inbreedingCoefficient,
  inbreedingWarning,
  geneticDiversityScore,
  recommendedMates,
  INBREEDING_ALERT_THRESHOLD,
} from "@/lib/pedigree-ai";
import type { PedigreeAnimal } from "@/lib/pedigree";

function animal(id: string, ear_tag: string, father_id: string | null = null, mother_id: string | null = null): PedigreeAnimal {
  return { id, ear_tag, name: null, father_id, mother_id };
}

describe("ancestorDepths", () => {
  it("maps each ancestor to its shallowest generation", () => {
    const byId = new Map([
      ["gf", animal("gf", "100")],
      ["f", animal("f", "200", "gf")],
      ["me", animal("me", "300", "f")],
    ]);
    const depths = ancestorDepths("me", byId);
    expect(depths.get("f")).toBe(1);
    expect(depths.get("gf")).toBe(2);
    expect(depths.has("me")).toBe(false);
  });
});

describe("commonAncestors / inbreedingCoefficient", () => {
  it("finds no shared ancestors for unrelated animals", () => {
    const byId = new Map([
      ["a", animal("a", "A")],
      ["b", animal("b", "B")],
    ]);
    expect(commonAncestors("a", "b", byId)).toEqual([]);
    expect(inbreedingCoefficient("a", "b", byId)).toBe(0);
  });

  it("scores full siblings (shared father and mother) at 0.25", () => {
    const byId = new Map([
      ["dad", animal("dad", "D")],
      ["mom", animal("mom", "M")],
      ["s1", animal("s1", "S1", "dad", "mom")],
      ["s2", animal("s2", "S2", "dad", "mom")],
    ]);
    expect(inbreedingCoefficient("s1", "s2", byId)).toBeCloseTo(0.25, 5);
  });

  it("scores animals sharing one grandparent at ~0.03125 (above the alert threshold)", () => {
    const byId = new Map([
      ["gf", animal("gf", "GF")],
      ["dad1", animal("dad1", "D1", "gf")],
      ["dad2", animal("dad2", "D2", "gf")],
      ["cousin1", animal("cousin1", "C1", "dad1")],
      ["cousin2", animal("cousin2", "C2", "dad2")],
    ]);
    const coefficient = inbreedingCoefficient("cousin1", "cousin2", byId);
    expect(coefficient).toBeCloseTo(0.03125, 5);
    expect(coefficient).toBeGreaterThan(INBREEDING_ALERT_THRESHOLD);
  });
});

describe("inbreedingWarning", () => {
  it("returns a Persian warning naming both ear tags and the shared relation for a close pair", () => {
    const byId = new Map([
      ["gf", animal("gf", "GF")],
      ["ram", animal("ram", "HM-001", "gf")],
      ["ewe", animal("ewe", "HM-115", "gf")],
    ]);
    const warning = inbreedingWarning(byId.get("ram")!, byId.get("ewe")!, byId);
    expect(warning).toContain("HM-001");
    expect(warning).toContain("HM-115");
    expect(warning).toContain("جد مشترک");
  });

  it("returns null for an unrelated pair", () => {
    const byId = new Map([
      ["ram", animal("ram", "HM-001")],
      ["ewe", animal("ewe", "HM-115")],
    ]);
    expect(inbreedingWarning(byId.get("ram")!, byId.get("ewe")!, byId)).toBeNull();
  });
});

describe("geneticDiversityScore", () => {
  it("returns null when no ancestors are recorded at all", () => {
    const byId = new Map([["a", animal("a", "A")]]);
    expect(geneticDiversityScore("a", byId)).toBeNull();
  });

  it("returns 100 when every known ancestor is a distinct individual", () => {
    const byId = new Map([
      ["gf", animal("gf", "GF")],
      ["gm", animal("gm", "GM")],
      ["dad", animal("dad", "D", "gf", "gm")],
      ["me", animal("me", "ME", "dad")],
    ]);
    expect(geneticDiversityScore("me", byId)).toBe(100);
  });

  it("drops below 100 when the same ancestor is reachable through both parents", () => {
    // Classic inbred case: the same grandsire is both the father's father
    // and the mother's father.
    const byId = new Map([
      ["gf", animal("gf", "GF")],
      ["dad", animal("dad", "D", "gf")],
      ["mom", animal("mom", "M", "gf")],
      ["me", animal("me", "ME", "dad", "mom")],
    ]);
    const score = geneticDiversityScore("me", byId);
    expect(score).not.toBeNull();
    expect(score!).toBeLessThan(100);
  });
});

describe("recommendedMates", () => {
  it("ranks unrelated candidates ahead of related ones, and excludes closely related ones entirely", () => {
    const byId = new Map([
      ["gf", animal("gf", "GF")],
      ["ram", animal("ram", "RAM", "gf")],
      ["relatedEwe", animal("relatedEwe", "REWE", "gf")],
      ["unrelatedEwe", animal("unrelatedEwe", "UEWE")],
    ]);
    const ram = byId.get("ram")!;
    const candidates = [byId.get("relatedEwe")!, byId.get("unrelatedEwe")!];
    const result = recommendedMates(ram, candidates, byId);
    expect(result.map((r) => r.animal.ear_tag)).toEqual(["UEWE"]);
  });
});
