import { describe, it, expect } from "vitest";
import { daysSinceLastDeworming, dewormingOverdue } from "@/lib/deworming-alerts";

describe("daysSinceLastDeworming / dewormingOverdue", () => {
  it("matches the spec's worked example (180 days)", () => {
    const days = daysSinceLastDeworming("2025-07-27", "2026-01-23");
    expect(days).toBe(180);
    expect(dewormingOverdue(days)).toBe(true);
  });

  it("is not overdue before the threshold", () => {
    expect(dewormingOverdue(179)).toBe(false);
  });
});
