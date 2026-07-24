import { describe, it, expect } from "vitest";
import { computePedigreeFarmStats } from "@/lib/pedigree-stats";
import type { PedigreeAnimal } from "@/lib/pedigree";

function animal(id: string, ear_tag: string, father_id: string | null = null, mother_id: string | null = null): PedigreeAnimal {
  return { id, ear_tag, name: null, father_id, mother_id };
}

describe("computePedigreeFarmStats", () => {
  it("returns zeros for a farm with no recorded parentage", () => {
    const stats = computePedigreeFarmStats([animal("a", "A"), animal("b", "B")]);
    expect(stats).toEqual({
      totalFamilyTrees: 0,
      largestBloodline: null,
      totalGenerations: 0,
      inbreedingAlerts: 0,
    });
  });

  it("counts founders-with-descendants as family trees and finds the largest bloodline", () => {
    const animals = [
      animal("gp", "GP"),
      animal("p1", "P1", null, "gp"),
      animal("p2", "P2", null, "gp"),
      animal("c1", "C1", null, "p1"),
      animal("solo-founder", "LONELY"), // founder with no descendants — not a "family tree"
      animal("other-gp", "OGP"),
      animal("other-child", "OC", null, "other-gp"),
    ];
    const stats = computePedigreeFarmStats(animals);
    expect(stats.totalFamilyTrees).toBe(2); // gp and other-gp
    expect(stats.largestBloodline).toEqual({ rootEarTag: "GP", descendantCount: 3 });
    expect(stats.totalGenerations).toBe(2); // gp -> p1 -> c1
  });

  it("flags animals whose recorded parents share a common ancestor", () => {
    const animals = [
      animal("gf", "GF"),
      animal("dad1", "D1", "gf"),
      animal("dad2", "D2", "gf"),
      animal("cousin1", "C1", "dad1"),
      animal("cousin2", "C2", "dad2"),
      animal("inbred", "INBRED", "cousin1", "cousin2"),
    ];
    const stats = computePedigreeFarmStats(animals);
    expect(stats.inbreedingAlerts).toBe(1);
  });
});
