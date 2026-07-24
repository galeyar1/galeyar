import { describe, it, expect } from "vitest";
import {
  birthRatePercent,
  mortalityScore,
  vaccinationCoveragePercent,
  feedEfficiencyScore,
  profitabilityScore,
  herdGrowthScore,
  overallPerformanceScore,
} from "@/lib/farm-performance";

describe("birthRatePercent", () => {
  it("computes births as a percentage of female count, capped at 100", () => {
    expect(birthRatePercent(30, 100)).toBe(30);
    expect(birthRatePercent(150, 100)).toBe(100);
    expect(birthRatePercent(10, 0)).toBe(0);
  });
});

describe("mortalityScore", () => {
  it("returns the survival score (100 - mortality%)", () => {
    expect(mortalityScore(5, 100)).toBe(95);
    expect(mortalityScore(0, 0)).toBe(100);
  });
});

describe("vaccinationCoveragePercent / feedEfficiencyScore", () => {
  it("computes simple coverage ratios", () => {
    expect(vaccinationCoveragePercent(18, 20)).toBe(90);
    expect(feedEfficiencyScore(4, 5)).toBe(80);
  });
});

describe("profitabilityScore", () => {
  it("is the profit margin, clamped at 0 when there's a loss", () => {
    expect(profitabilityScore(75_000_000, 120_000_000)).toBe(63);
    expect(profitabilityScore(-10, 100)).toBe(0);
  });
});

describe("herdGrowthScore", () => {
  it("centers 0% growth at a neutral 50", () => {
    expect(herdGrowthScore(0)).toBe(50);
    expect(herdGrowthScore(20)).toBe(70);
    expect(herdGrowthScore(-30)).toBe(20);
  });
});

describe("overallPerformanceScore", () => {
  it("averages all six metrics", () => {
    const score = overallPerformanceScore({
      birthRate: 80,
      mortality: 90,
      feedEfficiency: 100,
      profitability: 60,
      vaccinationCoverage: 90,
      herdGrowth: 70,
    });
    expect(score).toBe(82); // (80+90+100+60+90+70)/6 = 81.67 -> 82
  });
});
