import { describe, it, expect } from "vitest";
import { RATION_TEMPLATES, suggestedDailyConsumption, combineRationTotals } from "@/lib/ration-templates";

describe("RATION_TEMPLATES", () => {
  it("matches the spec's worked example for a pregnant ewe", () => {
    expect(RATION_TEMPLATES.pregnant_ewe.amounts).toEqual({ hay: 1.2, barley: 0.3, concentrate: 0.2 });
  });

  it("defines all five built-in templates", () => {
    expect(Object.keys(RATION_TEMPLATES).sort()).toEqual(
      ["fattening", "lactating_ewe", "lamb", "pregnant_ewe", "traditional"].sort()
    );
  });
});

describe("suggestedDailyConsumption", () => {
  it("scales per-animal amounts by headcount", () => {
    const result = suggestedDailyConsumption(RATION_TEMPLATES.pregnant_ewe, 61);
    expect(result.hay).toBeCloseTo(73.2, 5);
    expect(result.barley).toBeCloseTo(18.3, 5);
  });

  it("raises hay/straw needs in winter but leaves other feed types alone", () => {
    const summer = suggestedDailyConsumption(RATION_TEMPLATES.traditional, 10, "summer");
    const winter = suggestedDailyConsumption(RATION_TEMPLATES.traditional, 10, "winter");
    expect(winter.hay!).toBeGreaterThan(summer.hay!);
    expect(winter.straw!).toBeGreaterThan(summer.straw!);
  });
});

describe("combineRationTotals", () => {
  it("sums matching feed types across groups (e.g. ewes + lambs)", () => {
    const ewes = suggestedDailyConsumption(RATION_TEMPLATES.lactating_ewe, 61);
    const lambs = suggestedDailyConsumption(RATION_TEMPLATES.lamb, 22);
    const combined = combineRationTotals([ewes, lambs]);
    expect(combined.hay).toBeCloseTo(ewes.hay! + lambs.hay!, 5);
    expect(combined.concentrate).toBeCloseTo(ewes.concentrate! + lambs.concentrate!, 5);
  });
});
