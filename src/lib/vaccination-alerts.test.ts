import { describe, it, expect } from "vitest";
import { vaccinationDueStatus, SUGGESTED_VACCINES } from "@/lib/vaccination-alerts";

describe("vaccinationDueStatus", () => {
  it("is null when there's no next due date on record", () => {
    expect(vaccinationDueStatus(null, "2026-01-01")).toBeNull();
  });

  it("is overdue once the due date has passed", () => {
    expect(vaccinationDueStatus("2026-01-01", "2026-01-02")).toBe("overdue");
  });

  it("is upcoming within 30 days, ok beyond that", () => {
    expect(vaccinationDueStatus("2026-01-15", "2026-01-01")).toBe("upcoming");
    expect(vaccinationDueStatus("2026-03-01", "2026-01-01")).toBe("ok");
  });
});

describe("SUGGESTED_VACCINES", () => {
  it("includes the spec's seven named vaccines", () => {
    expect(SUGGESTED_VACCINES).toHaveLength(7);
  });
});
