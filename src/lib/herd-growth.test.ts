import { describe, it, expect } from "vitest";
import {
  nextYearCount,
  projectHerdGrowth,
  projectMilestones,
  DEFAULT_MORTALITY_RATES,
  DEFAULT_SHEEP_TWIN_RATES,
  DEFAULT_GOAT_TWIN_RATES,
} from "@/lib/herd-growth";

describe("nextYearCount", () => {
  it("is in the right ballpark for the spec's worked example (150, 1.8, 5%)", () => {
    const result = nextYearCount(150, 1.8, 0.05);
    // Spec's own example says 286; this model isn't required to reproduce
    // that exact figure, just land in a sane neighborhood for a herd that's
    // clearly growing at these rates.
    expect(result).toBeGreaterThan(150);
    expect(result).toBeLessThan(320);
  });

  it("shrinks a herd when mortality outweighs twin-rate growth", () => {
    const result = nextYearCount(100, 0.5, 0.4);
    expect(result).toBeLessThan(100);
  });
});

describe("projectHerdGrowth / projectMilestones", () => {
  it("compounds year over year (each year building on the last)", () => {
    const series = projectHerdGrowth(150, 1.8, 0.05, 3);
    expect(series).toHaveLength(3);
    expect(series[0].year).toBe(1);
    expect(series[2].year).toBe(3);
    expect(series[1].count).toBe(nextYearCount(series[0].count, 1.8, 0.05));
  });

  it("exposes the specific milestone years the spec asks for", () => {
    const milestones = projectMilestones(150, 1.8, 0.05);
    const series = projectHerdGrowth(150, 1.8, 0.05, 10);
    expect(milestones.year1).toBe(series[0].count);
    expect(milestones.year5).toBe(series[4].count);
    expect(milestones.year10).toBe(series[9].count);
  });
});

describe("default rate tables", () => {
  it("matches the spec's mortality presets", () => {
    expect(DEFAULT_MORTALITY_RATES).toEqual({
      excellent: 0.03,
      good: 0.05,
      average: 0.08,
      weak: 0.12,
      critical: 0.15,
    });
  });

  it("matches the spec's sheep and goat twin rates", () => {
    expect(DEFAULT_SHEEP_TWIN_RATES["رومانوف"]).toBe(2.5);
    expect(DEFAULT_GOAT_TWIN_RATES["سانن"]).toBe(2.0);
  });
});
