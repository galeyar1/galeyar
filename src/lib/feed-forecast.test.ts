import { describe, it, expect } from "vitest";
import { monthlyFromDaily, annualFromDaily, daysRemaining, costPerAnimalPerDay } from "@/lib/feed-forecast";

describe("monthlyFromDaily / annualFromDaily", () => {
  it("matches the spec's worked example (120 kg/day hay)", () => {
    expect(monthlyFromDaily(120)).toBe(3600);
    expect(annualFromDaily(120)).toBe(43800);
  });
});

describe("daysRemaining", () => {
  it("matches the spec's worked example (hay runs out in 12 days)", () => {
    expect(daysRemaining(1440, 120)).toBe(12);
  });

  it("returns null when the rate is unknown or zero", () => {
    expect(daysRemaining(1440, null)).toBeNull();
    expect(daysRemaining(1440, 0)).toBeNull();
  });
});

describe("costPerAnimalPerDay", () => {
  it("divides the daily cost across the herd", () => {
    expect(costPerAnimalPerDay(120, 5000, 100)).toBe(6000);
  });

  it("returns null when cost or animal count is unknown", () => {
    expect(costPerAnimalPerDay(120, null, 100)).toBeNull();
    expect(costPerAnimalPerDay(120, 5000, 0)).toBeNull();
  });
});
