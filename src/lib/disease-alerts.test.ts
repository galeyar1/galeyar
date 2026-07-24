import { describe, it, expect } from "vitest";
import {
  feverAlertLevel,
  notImprovingAlert,
  suggestedQuarantineDays,
  isQuarantineActive,
  DEFAULT_QUARANTINE_DAYS,
} from "@/lib/disease-alerts";

describe("feverAlertLevel", () => {
  it("matches the spec's worked examples", () => {
    expect(feverAlertLevel(38.5)).toBeNull();
    expect(feverAlertLevel(39.2)).toBeNull();
    expect(feverAlertLevel(40.1)).toBe("warning");
    expect(feverAlertLevel(40.6)).toBe("emergency");
    expect(feverAlertLevel(null)).toBeNull();
  });
});

describe("notImprovingAlert", () => {
  it("flags a case older than 7 days with no newer record", () => {
    expect(notImprovingAlert("2026-01-01", "2026-01-08", false)).toBe(true);
    expect(notImprovingAlert("2026-01-01", "2026-01-05", false)).toBe(false);
  });

  it("does not flag when a newer record exists for the animal", () => {
    expect(notImprovingAlert("2026-01-01", "2026-01-08", true)).toBe(false);
  });
});

describe("suggestedQuarantineDays", () => {
  it("suggests 14 days for infectious cases and nothing otherwise", () => {
    expect(suggestedQuarantineDays("infectious")).toBe(DEFAULT_QUARANTINE_DAYS);
    expect(suggestedQuarantineDays("lameness")).toBeNull();
  });
});

describe("isQuarantineActive", () => {
  it("is active through the end date, inclusive", () => {
    expect(isQuarantineActive("2026-01-10", "2026-01-10")).toBe(true);
    expect(isQuarantineActive("2026-01-10", "2026-01-11")).toBe(false);
    expect(isQuarantineActive(null, "2026-01-10")).toBe(false);
  });
});
