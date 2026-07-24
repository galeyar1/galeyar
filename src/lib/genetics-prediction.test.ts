import { describe, it, expect } from "vitest";
import {
  predictOffspringGenetics,
  sampleGeneticState,
  predictAndSampleOffspringGenetics,
  geneticScore,
  computeAiAccuracy,
  GENETIC_SCORES,
  GENETIC_STATE_LABELS,
} from "@/lib/genetics-prediction";

describe("predictOffspringGenetics — Homozygous/Heterozygous/Local triad (spec section 3)", () => {
  it("HM x HM -> 100% HM", () => {
    expect(predictOffspringGenetics("homozygous", "homozygous")).toEqual({ homozygous: 1 });
  });

  it("HM x H -> 50% HM, 50% H", () => {
    const result = predictOffspringGenetics("homozygous", "heterozygous")!;
    expect(result.homozygous).toBeCloseTo(0.5, 5);
    expect(result.heterozygous).toBeCloseTo(0.5, 5);
    expect(result.local).toBeUndefined();
  });

  it("HM x Local -> 100% H", () => {
    expect(predictOffspringGenetics("homozygous", "local")).toEqual({ heterozygous: 1 });
  });

  it("H x H -> 25% HM, 50% H, 25% Local", () => {
    const result = predictOffspringGenetics("heterozygous", "heterozygous")!;
    expect(result.homozygous).toBeCloseTo(0.25, 5);
    expect(result.heterozygous).toBeCloseTo(0.5, 5);
    expect(result.local).toBeCloseTo(0.25, 5);
  });

  it("H x Local -> 50% H, 50% Local", () => {
    const result = predictOffspringGenetics("heterozygous", "local")!;
    expect(result.heterozygous).toBeCloseTo(0.5, 5);
    expect(result.local).toBeCloseTo(0.5, 5);
  });

  it("Local x Local -> 100% Local", () => {
    expect(predictOffspringGenetics("local", "local")).toEqual({ local: 1 });
  });

  it("is symmetric regardless of which parent is father/mother", () => {
    expect(predictOffspringGenetics("homozygous", "local")).toEqual(predictOffspringGenetics("local", "homozygous"));
  });
});

describe("predictOffspringGenetics — named breed crosses (spec section 4)", () => {
  it("Romanov x Romanov -> 100% Romanov", () => {
    expect(predictOffspringGenetics("romanov", "romanov")).toEqual({ romanov: 1 });
  });

  it("Romanov x Local -> 50% Romanov (the rest Local)", () => {
    const result = predictOffspringGenetics("romanov", "local")!;
    expect(result.romanov).toBeCloseTo(0.5, 5);
    expect(result.local).toBeCloseTo(0.5, 5);
  });

  it("Shall x Romanov -> Shall-Romanov", () => {
    expect(predictOffspringGenetics("shall", "romanov")).toEqual({ shall_romanov: 1 });
  });

  it("falls back to 'other' for combinations outside the fixed 11-state enum (e.g. HM x Romanov)", () => {
    expect(predictOffspringGenetics("homozygous", "romanov")).toEqual({ other: 1 });
  });

  it("returns null when either parent is unknown or other", () => {
    expect(predictOffspringGenetics("unknown", "romanov")).toBeNull();
    expect(predictOffspringGenetics("romanov", "other")).toBeNull();
  });
});

describe("sampleGeneticState", () => {
  it("picks deterministically from an injected random source", () => {
    const distribution = { homozygous: 0.5, heterozygous: 0.5 };
    expect(sampleGeneticState(distribution, () => 0)).toBe("homozygous");
    expect(sampleGeneticState(distribution, () => 0.99)).toBe("heterozygous");
  });

  it("can independently sample different outcomes for the same distribution (twin offspring)", () => {
    const a = predictAndSampleOffspringGenetics("homozygous", "heterozygous", () => 0.1);
    const b = predictAndSampleOffspringGenetics("homozygous", "heterozygous", () => 0.9);
    expect(a).toBe("homozygous");
    expect(b).toBe("heterozygous");
    expect(a).not.toBe(b);
  });
});

describe("geneticScore (spec section 8)", () => {
  it("matches the spec's worked scores", () => {
    expect(geneticScore("homozygous")).toBe(100);
    expect(geneticScore("romanov")).toBe(95);
    expect(geneticScore("romanov_asaf")).toBe(92);
    expect(geneticScore("shall_romanov")).toBe(90);
    expect(geneticScore("lacaune")).toBe(85);
    expect(geneticScore("heterozygous")).toBe(80);
    expect(geneticScore("afshari")).toBe(75);
    expect(geneticScore("local")).toBe(50);
  });

  it("has a score for every defined genetic state", () => {
    expect(Object.keys(GENETIC_SCORES).sort()).toEqual(Object.keys(GENETIC_STATE_LABELS).sort());
  });
});

describe("computeAiAccuracy (spec section 13)", () => {
  it("computes accuracy only among predictions that were later confirmed", () => {
    const result = computeAiAccuracy([
      { predicted_genetics: "homozygous", confirmed_genetics: "homozygous" }, // match
      { predicted_genetics: "heterozygous", confirmed_genetics: "homozygous" }, // mismatch
      { predicted_genetics: "local", confirmed_genetics: "local" }, // match
      { predicted_genetics: "romanov", confirmed_genetics: null }, // not yet confirmed
      { predicted_genetics: null, confirmed_genetics: null }, // no prediction at all
    ]);
    expect(result.totalPredictions).toBe(4);
    expect(result.confirmedPredictions).toBe(3);
    expect(result.matchingPredictions).toBe(2);
    expect(result.accuracyPercent).toBe(67);
  });

  it("returns null accuracy when nothing has been confirmed yet", () => {
    const result = computeAiAccuracy([{ predicted_genetics: "homozygous", confirmed_genetics: null }]);
    expect(result.accuracyPercent).toBeNull();
  });
});
