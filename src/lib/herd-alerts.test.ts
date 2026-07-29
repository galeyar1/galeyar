import { describe, it, expect } from "vitest";
import {
  breedingMaleType,
  breedingFemaleType,
  isBreedingMale,
  isBreedingFemale,
  computeHerdCompositionAlert,
  rankMaleReviewCandidates,
  RECOMMENDED_FEMALES_PER_MALE,
} from "@/lib/herd-alerts";
import type { PedigreeAnimal } from "@/lib/pedigree";

describe("breeding type helpers", () => {
  it("identifies the adult breeding male/female type per species", () => {
    expect(breedingMaleType("sheep")).toBe("ram");
    expect(breedingFemaleType("sheep")).toBe("ewe");
    expect(isBreedingMale("sheep", "ram")).toBe(true);
    expect(isBreedingMale("sheep", "ram_lamb")).toBe(false);
    expect(isBreedingFemale("sheep", "ewe")).toBe(true);
    expect(isBreedingMale("sheep", null)).toBe(false);
  });
});

interface TestAnimal {
  species: "sheep";
  animal_type: string | null;
  status: string;
  deleted_at: string | null;
}

function makeHerd(maleCount: number, femaleCount: number): TestAnimal[] {
  const males: TestAnimal[] = Array.from({ length: maleCount }, () => ({
    species: "sheep",
    animal_type: "ram",
    status: "active",
    deleted_at: null,
  }));
  const females: TestAnimal[] = Array.from({ length: femaleCount }, () => ({
    species: "sheep",
    animal_type: "ewe",
    status: "active",
    deleted_at: null,
  }));
  return [...males, ...females];
}

describe("computeHerdCompositionAlert", () => {
  it("does not flag a reasonable ratio", () => {
    const herd = makeHerd(1, RECOMMENDED_FEMALES_PER_MALE.sheep);
    expect(computeHerdCompositionAlert(herd, "sheep")).toBeNull();
  });

  it("does not flag when there are too few males to matter, even with a skewed ratio", () => {
    const herd = makeHerd(1, 2);
    expect(computeHerdCompositionAlert(herd, "sheep")).toBeNull();
  });

  it("does not flag when there are no breeding females at all", () => {
    const herd = makeHerd(3, 0);
    expect(computeHerdCompositionAlert(herd, "sheep")).toBeNull();
  });

  it("flags an excessive male:female ratio, based on relative counts not raw male count", () => {
    // 10 rams for only 30 ewes: recommended is ceil(30/30)=1, so 10 is way over tolerance.
    const herd = makeHerd(10, 30);
    const alert = computeHerdCompositionAlert(herd, "sheep");
    expect(alert).not.toBeNull();
    expect(alert!.breedingMaleCount).toBe(10);
    expect(alert!.breedingFemaleCount).toBe(30);
    expect(alert!.excessCount).toBeGreaterThan(0);
  });

  it("ignores deleted/inactive animals", () => {
    const herd: TestAnimal[] = [
      ...makeHerd(10, 30),
      { species: "sheep", animal_type: "ram", status: "sold", deleted_at: null },
      { species: "sheep", animal_type: "ram", status: "active", deleted_at: new Date().toISOString() },
    ];
    const alert = computeHerdCompositionAlert(herd, "sheep");
    expect(alert!.breedingMaleCount).toBe(10);
  });
});

function animal(id: string, overrides: Partial<PedigreeAnimal> = {}): PedigreeAnimal {
  return { id, ear_tag: id, name: null, father_id: null, mother_id: null, ...overrides };
}

describe("rankMaleReviewCandidates", () => {
  it("flags no data-quality issue as missing when nothing is known, and never throws", () => {
    const males = [{ ...animal("ram1"), genetic_score: null, birth_date: null }];
    const females = [animal("ewe1")];
    const byId = new Map([...males, ...females].map((a) => [a.id, a]));
    const ranked = rankMaleReviewCandidates(males, females, byId, new Map());
    expect(ranked).toHaveLength(1);
    expect(ranked[0].dataQualityNote).toBe("داده کافی برای ارزیابی کامل وجود ندارد.");
    expect(ranked[0].reasons).toEqual([]);
  });

  it("ranks a closely related, unhealthy male above an unrelated, healthy one", () => {
    const grandparent = animal("gp");
    const father = animal("father", { father_id: "gp" });
    const mother = animal("mother", { father_id: "gp" }); // shares grandparent with father
    const relatedRam = animal("ram_related", { father_id: "gp" }); // also shares the grandparent -> related to the ewe
    const unrelatedRam = animal("ram_unrelated");
    const ewe = animal("ewe1", { father_id: "father", mother_id: "mother" });

    const all = [grandparent, father, mother, relatedRam, unrelatedRam, ewe];
    const byId = new Map(all.map((a) => [a.id, a]));

    const males = [
      { ...relatedRam, genetic_score: null, birth_date: null },
      { ...unrelatedRam, genetic_score: null, birth_date: null },
    ];
    const diseaseCounts = new Map([["ram_related", 3]]);

    const ranked = rankMaleReviewCandidates(males, [ewe], byId, diseaseCounts);
    expect(ranked[0].animal.id).toBe("ram_related");
    expect(ranked[0].reviewScore).not.toBeNull();
    expect(ranked[0].reviewScore!).toBeGreaterThan(ranked[1].reviewScore ?? 0);
  });

  it("never lets a missing factor drag the score down — only averages over factors with real data", () => {
    const ram = animal("ram1");
    const ewe = animal("ewe1");
    const byId = new Map([ram, ewe].map((a) => [a.id, a]));
    const males = [{ ...ram, genetic_score: 90, birth_date: null }];
    const ranked = rankMaleReviewCandidates(males, [ewe], byId, new Map());
    // No relatedness, no diversity data, healthy (0 disease), high genetic score, unknown age -> low review score.
    expect(ranked[0].reviewScore).not.toBeNull();
    expect(ranked[0].reviewScore!).toBeLessThan(30);
  });
});
