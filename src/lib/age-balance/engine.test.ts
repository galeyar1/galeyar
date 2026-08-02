import { describe, it, expect } from "vitest";
import { analyzeHerdAgeBalance, type AgeBalanceAnimalInput, type AgeBalanceInput } from "@/lib/age-balance/engine";
import { classifyLifeStage } from "@/lib/age-balance/life-stage";
import { resolveAgeProfile } from "@/lib/age-balance/profile-resolver";
import { analyzeIndividualRetention } from "@/lib/age-balance/retention";
import { generateAgeBalanceAlerts } from "@/lib/age-balance/explain";
import type { Species } from "@/lib/supabase/types";

const TODAY = new Date().toISOString().slice(0, 10);

function isoYearsAgo(years: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - Math.round(years * 12));
  return d.toISOString().slice(0, 10);
}

let counter = 0;
function animal(
  species: Species,
  gender: "male" | "female",
  ageYears: number,
  overrides: Partial<AgeBalanceAnimalInput> = {}
): AgeBalanceAnimalInput {
  counter += 1;
  const id = overrides.id ?? `a${counter}`;
  const adultType = gender === "female" ? "ewe" : "ram";
  const juvenileType = gender === "female" ? "ewe_lamb" : "ram_lamb";
  return {
    id,
    ear_tag: id,
    name: null,
    species,
    breed: null,
    gender,
    animal_type: ageYears >= 1 ? adultType : juvenileType,
    birth_date: isoYearsAgo(ageYears),
    is_pregnant: false,
    ...overrides,
  };
}

function baseInput(animals: AgeBalanceAnimalInput[], overrides: Partial<AgeBalanceInput> = {}): AgeBalanceInput {
  return {
    animals,
    latestWeightByAnimalId: new Map(),
    birthRecordDatesByMother: new Map(),
    growthObjective: "maintain",
    growthTargetPercent: null,
    referenceDateIso: TODAY,
    ...overrides,
  };
}

describe("classifyLifeStage — species-aware, never shares thresholds across species", () => {
  it("a 5-year-old sheep is already a senior breeder, a 5-year-old camel is barely starting to breed", () => {
    const sheepProfile = resolveAgeProfile("sheep", null);
    const camelProfile = resolveAgeProfile("camel", null);
    const fiveYearsAgo = isoYearsAgo(5);

    // Sheep: mature ends at 4y, senior monitoring starts at 6y -> 5y is senior_breeding, clearly past prime but not yet flagged for monitoring.
    expect(classifyLifeStage(fiveYearsAgo, sheepProfile)).toBe("senior_breeding");
    // Camel: per the spec, first calving is ~5 years -> a 5-year-old camel is only just entering breeding, never sheep-like "senior."
    expect(classifyLifeStage(fiveYearsAgo, camelProfile)).toBe("young_breeding");
  });

  it("returns null (never a fabricated stage) when birth_date is unknown", () => {
    const profile = resolveAgeProfile("sheep", null);
    expect(classifyLifeStage(null, profile)).toBeNull();
  });
});

describe("Scenario: balanced sheep flock (spec section 61)", () => {
  it("produces a relatively high Age Balance score with no aging or shortage alerts", () => {
    const animals: AgeBalanceAnimalInput[] = [];
    const births = new Map<string, string[]>();

    // 1 ram, well within the reference ratio.
    animals.push(animal("sheep", "male", 4));

    // 20 young + 50 mature + 15 senior-but-not-yet-monitoring breeding ewes.
    for (let i = 0; i < 20; i++) animals.push(animal("sheep", "female", 1.5));
    for (let i = 0; i < 50; i++) animals.push(animal("sheep", "female", 3));
    for (let i = 0; i < 15; i++) animals.push(animal("sheep", "female", 4.5));
    // 15 in senior_monitoring — a normal minority, not a majority.
    for (let i = 0; i < 15; i++) animals.push(animal("sheep", "female", 6.5));

    // 24 replacement candidates (~24% of 100 breeding ewes — within the 20-25% benchmark).
    for (let i = 0; i < 24; i++) animals.push(animal("sheep", "female", 0.9));

    // Healthy recent reproductive history for most breeding ewes.
    for (const a of animals) {
      if (a.gender === "female" && a.animal_type === "ewe") {
        births.set(a.id, [isoYearsAgo(0.5)]);
      }
    }

    const result = analyzeHerdAgeBalance(baseInput(animals, { birthRecordDatesByMother: births }));

    expect(result.confidence).not.toBe("insufficient");
    expect(result.ageBalanceScore).not.toBeNull();
    expect(result.ageBalanceScore!).toBeGreaterThanOrEqual(60);

    const alerts = generateAgeBalanceAlerts(result);
    expect(alerts.find((a) => a.id === "herd_aging")).toBeUndefined();
    expect(alerts.find((a) => a.id === "replacement_shortage")).toBeUndefined();
  });
});

describe("Scenario: aging flock (spec section 62)", () => {
  it("trends old, lowers Age Balance, and raises a replacement shortage + animals-to-review", () => {
    const animals: AgeBalanceAnimalInput[] = [];

    animals.push(animal("sheep", "male", 5));

    // Heavy senior concentration, thin prime cohort, almost no replacements.
    for (let i = 0; i < 10; i++) animals.push(animal("sheep", "female", 2.5)); // mature
    for (let i = 0; i < 60; i++) animals.push(animal("sheep", "female", 6.5)); // senior_monitoring
    for (let i = 0; i < 2; i++) animals.push(animal("sheep", "female", 0.9)); // replacement_candidate — very few

    const result = analyzeHerdAgeBalance(baseInput(animals));

    expect(result.youthIndex).not.toBeNull();
    expect(result.youthIndex!).toBeLessThan(40);
    expect(result.ageBalanceScore).not.toBeNull();
    expect(result.seniorReviewAnimals.length).toBeGreaterThan(0);

    const alerts = generateAgeBalanceAlerts(result);
    expect(alerts.find((a) => a.id === "replacement_shortage")).toBeDefined();
    expect(alerts.find((a) => a.id === "herd_aging")).toBeDefined();
  });
});

describe("Scenario: herd too young (spec section 63)", () => {
  it("has a high Youth Index but raises the too-young alert instead of implying young is automatically good", () => {
    const animals: AgeBalanceAnimalInput[] = [];

    // A handful of active breeders...
    for (let i = 0; i < 10; i++) animals.push(animal("sheep", "female", 2));
    animals.push(animal("sheep", "male", 3));
    // ...swamped by a much larger not-yet-breeding young population.
    for (let i = 0; i < 90; i++) animals.push(animal("sheep", "female", 0.4));

    const result = analyzeHerdAgeBalance(baseInput(animals));

    expect(result.youthIndex).not.toBeNull();
    expect(result.youthIndex!).toBeGreaterThan(60);

    const alerts = generateAgeBalanceAlerts(result);
    expect(alerts.find((a) => a.id === "herd_too_young")).toBeDefined();
  });
});

describe("Scenario: old-but-productive vs younger-problem animal (spec sections 29, 64-65)", () => {
  it("never recommends removal for an old, healthy, productive ewe with valuable genetics", () => {
    const stage = classifyLifeStage(isoYearsAgo(6.5), resolveAgeProfile("sheep", null));
    const result = analyzeIndividualRetention({
      lifeStage: stage,
      gender: "female",
      offspringCount: 6,
      recentBirthOrUse: true,
      diseaseCount: 0,
      geneticScore: 82,
    });

    expect(result.result).toBe("high_value");
    expect(result.label).not.toContain("حذف");
  });

  it("flags a younger ewe with repeated reproductive failure and health problems more strongly than the healthy senior", () => {
    const seniorResult = analyzeIndividualRetention({
      lifeStage: classifyLifeStage(isoYearsAgo(6.5), resolveAgeProfile("sheep", null)),
      gender: "female",
      offspringCount: 6,
      recentBirthOrUse: true,
      diseaseCount: 0,
      geneticScore: 82,
    });

    const youngerProblemResult = analyzeIndividualRetention({
      lifeStage: classifyLifeStage(isoYearsAgo(3.5), resolveAgeProfile("sheep", null)),
      gender: "female",
      offspringCount: 0,
      recentBirthOrUse: false,
      diseaseCount: 3,
      geneticScore: null,
    });

    expect(seniorResult.result).toBe("high_value");
    expect(youngerProblemResult.result).toBe("review_recommended");
  });

  it("never uses the literal removal phrase for any outcome", () => {
    const outcome = analyzeIndividualRetention({
      lifeStage: "senior_monitoring",
      gender: "female",
      offspringCount: 0,
      recentBirthOrUse: false,
      diseaseCount: 5,
      geneticScore: 5,
    });
    expect(outcome.label).not.toContain("باید حذف شود");
    expect(outcome.result).toBe("review_recommended");
  });
});

describe("Scenario: missing data lowers confidence, never fabricates values", () => {
  it("returns null scores and insufficient confidence when most birth dates are unknown", () => {
    const animals: AgeBalanceAnimalInput[] = [];
    for (let i = 0; i < 20; i++) {
      animals.push(animal("sheep", "female", 3, { birth_date: null }));
    }
    // A couple of known ones so it's not literally an empty herd.
    animals.push(animal("sheep", "female", 3));
    animals.push(animal("sheep", "male", 4));

    const result = analyzeHerdAgeBalance(baseInput(animals));

    expect(result.confidence).toBe("insufficient");
    expect(result.ageBalanceScore).toBeNull();
    expect(result.youthIndex).toBeNull();
  });
});

describe("Scenario: multi-farm isolation", () => {
  it("never mixes two independently-passed animal sets", () => {
    const farmA = [animal("sheep", "female", 2), animal("sheep", "male", 3)];
    const farmB = [animal("sheep", "female", 6.5), animal("sheep", "female", 6.7), animal("sheep", "male", 6)];

    const resultA = analyzeHerdAgeBalance(baseInput(farmA));
    const resultB = analyzeHerdAgeBalance(baseInput(farmB));

    expect(resultA.totalActiveAnimals).toBe(2);
    expect(resultB.totalActiveAnimals).toBe(3);
    expect(resultA.seniorReviewAnimals.every((a) => farmA.some((f) => f.id === a.id))).toBe(true);
    expect(resultB.seniorReviewAnimals.every((a) => farmB.some((f) => f.id === a.id))).toBe(true);
  });
});

describe("Replacement need — divide-by-zero safety", () => {
  it("returns null coveragePercent (not a division error) when replacement need is zero", () => {
    // A flock (large enough to clear the minimum-herd-size confidence floor)
    // entirely young/mature, with no seniors approaching the threshold and no growth target.
    const animals = [
      animal("sheep", "female", 2),
      animal("sheep", "female", 2.5),
      animal("sheep", "female", 3),
      animal("sheep", "female", 3.5),
      animal("sheep", "male", 3),
    ];
    const result = analyzeHerdAgeBalance(baseInput(animals, { growthObjective: "maintain" }));

    expect(result.replacement.replacementNeed).toBe(0);
    expect(result.replacement.coveragePercent).toBeNull();
    expect(result.components.replacementCoverage).toBe(100);
  });
});
