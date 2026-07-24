import { describe, it, expect } from "vitest";
import {
  GESTATION_DAYS,
  MAX_PREGNANCY_MONTH,
  computeExpectedBirthDate,
  daysUntilBirth,
  pregnancyStage,
  pregnancyStatusLabel,
} from "@/lib/pregnancy";

describe("gestation constants", () => {
  it("matches the spec's gestation lengths and month ranges", () => {
    expect(GESTATION_DAYS).toEqual({ sheep: 150, goat: 150, cattle: 283, horse: 340, camel: 390 });
    expect(MAX_PREGNANCY_MONTH).toEqual({ sheep: 5, goat: 5, cattle: 9, horse: 12, camel: 12 });
  });
});

describe("computeExpectedBirthDate", () => {
  it("returns today when the recorded month already covers the full gestation", () => {
    // Goat: 150 days / 5 months = 30 days/month; month 5 = 150 days elapsed = full term.
    expect(computeExpectedBirthDate("goat", 5, "2026-01-01")).toBe("2026-01-01");
  });

  it("counts the remaining days forward from the reference date", () => {
    // Sheep: 150/5 = 30 days/month; month 3 -> 90 elapsed -> 60 remaining.
    expect(computeExpectedBirthDate("sheep", 3, "2026-01-01")).toBe("2026-03-02");
  });
});

describe("daysUntilBirth / pregnancyStage", () => {
  it("is positive before the due date and negative after", () => {
    expect(daysUntilBirth("2026-01-10", "2026-01-01")).toBe(9);
    expect(daysUntilBirth("2026-01-01", "2026-01-10")).toBe(-9);
  });

  it("classifies near-birth within the 14-day threshold, overdue below zero", () => {
    expect(pregnancyStage(20)).toBe("in_progress");
    expect(pregnancyStage(14)).toBe("near_birth");
    expect(pregnancyStage(0)).toBe("near_birth");
    expect(pregnancyStage(-1)).toBe("overdue");
  });
});

describe("pregnancyStatusLabel", () => {
  it("describes days remaining, birth today, and overdue in Persian with Persian digits", () => {
    expect(pregnancyStatusLabel(10)).toBe("تا ۱۰ روز دیگر زایش خواهد کرد");
    expect(pregnancyStatusLabel(0)).toBe("زایش امروز");
    expect(pregnancyStatusLabel(-3)).toBe("۳ روز از سررسید زایش گذشته است");
  });
});
