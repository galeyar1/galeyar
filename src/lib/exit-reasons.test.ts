import { describe, it, expect } from "vitest";
import { statusForExitReason, mostCommonExitReason, EXIT_REASON_LABELS } from "@/lib/exit-reasons";

describe("statusForExitReason", () => {
  it("maps death-implying reasons to 'dead' and the rest to 'sold'", () => {
    expect(statusForExitReason("disease_death")).toBe("dead");
    expect(statusForExitReason("accident")).toBe("dead");
    expect(statusForExitReason("old_age")).toBe("dead");
    expect(statusForExitReason("sale")).toBe("sold");
    expect(statusForExitReason("infertility")).toBe("sold");
  });
});

describe("mostCommonExitReason", () => {
  it("matches the spec's worked example shape (most common reason + percentage)", () => {
    const animals = [
      { exit_reason: "infertility", updated_at: "2026-01-01T00:00:00.000Z" },
      { exit_reason: "infertility", updated_at: "2026-02-01T00:00:00.000Z" },
      { exit_reason: "sale", updated_at: "2026-03-01T00:00:00.000Z" },
      { exit_reason: null, updated_at: "2026-04-01T00:00:00.000Z" },
    ];
    const result = mostCommonExitReason(animals, () => true);
    expect(result).toEqual({ reason: "infertility", count: 2, percent: 67 });
  });

  it("returns null when nothing matches the year filter", () => {
    const animals = [{ exit_reason: "sale", updated_at: "2026-01-01T00:00:00.000Z" }];
    expect(mostCommonExitReason(animals, () => false)).toBeNull();
  });
});

describe("EXIT_REASON_LABELS", () => {
  it("has a Persian label for every exit reason", () => {
    expect(Object.keys(EXIT_REASON_LABELS)).toHaveLength(11);
  });
});
