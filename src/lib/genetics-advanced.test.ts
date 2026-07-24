import { describe, it, expect } from "vitest";
import { clampScore, growthScore, fertilityScore, healthScore, geneticsScore, buildAdvancedProfile } from "@/lib/genetics-advanced";
import type { PedigreeAnimal } from "@/lib/pedigree";

describe("clampScore", () => {
  it("clamps to the 0-100 range and rounds", () => {
    expect(clampScore(150)).toBe(100);
    expect(clampScore(-20)).toBe(0);
    expect(clampScore(72.6)).toBe(73);
  });
});

describe("growthScore", () => {
  it("is neutral (50) with fewer than 2 weight records", () => {
    expect(growthScore([])).toBe(50);
    expect(growthScore([{ weight: 40, record_date: "2026-01-01" }])).toBe(50);
  });

  it("scores at 100 when gain matches the benchmark exactly", () => {
    const score = growthScore(
      [
        { weight: 40, record_date: "2026-01-01" },
        { weight: 44, record_date: "2026-01-31" }, // +4kg over exactly 30 days, benchmark 4kg/month
      ],
      4
    );
    expect(score).toBe(100);
  });

  it("scores below 100 for slower-than-benchmark gain", () => {
    const score = growthScore(
      [
        { weight: 40, record_date: "2026-01-01" },
        { weight: 42, record_date: "2026-02-01" },
      ],
      4
    );
    expect(score).toBeLessThan(100);
  });
});

describe("fertilityScore / healthScore", () => {
  it("rewards more births, caps at 100", () => {
    expect(fertilityScore(0)).toBe(0);
    expect(fertilityScore(3)).toBe(60);
    expect(fertilityScore(10)).toBe(100);
  });

  it("penalizes disease cases, floors at 0", () => {
    expect(healthScore(0)).toBe(100);
    expect(healthScore(3)).toBe(64);
    expect(healthScore(20)).toBe(0);
  });
});

describe("geneticsScore", () => {
  it("normalizes the existing offspring/diversity heuristic into 0-100", () => {
    const solo: PedigreeAnimal = { id: "a", ear_tag: "A", name: null, gender: "male", father_id: null, mother_id: null };
    expect(geneticsScore(solo, [solo])).toBe(0);
  });
});

describe("buildAdvancedProfile", () => {
  it("averages the four factors into an overall score", () => {
    const profile = buildAdvancedProfile({ genetics: 95, growth: 88, fertility: 91, health: 93 });
    expect(profile.overall).toBe(92);
  });
});
