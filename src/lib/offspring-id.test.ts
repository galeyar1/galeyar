import { describe, it, expect } from "vitest";
import {
  SPECIES_CODE,
  GENDER_CODE,
  jalaliYearSuffix,
  buildGeneratedId,
  nextOffspringNumbers,
  offspringTitle,
} from "@/lib/offspring-id";

describe("SPECIES_CODE / GENDER_CODE", () => {
  it("matches the spec's species codes", () => {
    expect(SPECIES_CODE).toEqual({
      sheep: "SH",
      goat: "GT",
      cattle: "CT",
      camel: "CM",
      horse: "HS",
    });
  });

  it("matches the spec's gender codes", () => {
    expect(GENDER_CODE).toEqual({ male: "M", female: "F" });
  });
});

describe("jalaliYearSuffix", () => {
  it("takes the last two digits of the Jalali year, zero-padded", () => {
    expect(jalaliYearSuffix("2026-03-21")).toBe("05"); // 1405
    expect(jalaliYearSuffix("2021-03-21")).toBe("00"); // 1400
  });
});

describe("buildGeneratedId", () => {
  it("reproduces every worked example from the spec", () => {
    expect(buildGeneratedId("sheep", "125", "05", "M", 1)).toBe("SH-125-05-M1");
    expect(buildGeneratedId("sheep", "125", "05", "F", 1)).toBe("SH-125-05-F1");
    expect(buildGeneratedId("sheep", "125", "05", "F", 2)).toBe("SH-125-05-F2");
    expect(buildGeneratedId("goat", "230", "05", "M", 1)).toBe("GT-230-05-M1");
    expect(buildGeneratedId("goat", "230", "05", "F", 1)).toBe("GT-230-05-F1");
    expect(buildGeneratedId("cattle", "045", "05", "M", 1)).toBe("CT-045-05-M1");
    expect(buildGeneratedId("cattle", "045", "05", "F", 1)).toBe("CT-045-05-F1");
    expect(buildGeneratedId("camel", "012", "05", "M", 1)).toBe("CM-012-05-M1");
    expect(buildGeneratedId("camel", "012", "05", "F", 1)).toBe("CM-012-05-F1");
    expect(buildGeneratedId("horse", "007", "05", "M", 1)).toBe("HS-007-05-M1");
    expect(buildGeneratedId("horse", "007", "05", "F", 1)).toBe("HS-007-05-F1");
  });
});

describe("nextOffspringNumbers", () => {
  it("starts at 1 for a mother/year/gender with no prior offspring", () => {
    expect(nextOffspringNumbers(0, 1)).toEqual([1]);
  });

  it("handles a twin birth (one male, one female) — each gender starts its own count at 1", () => {
    expect(nextOffspringNumbers(0, 1)).toEqual([1]); // male side
    expect(nextOffspringNumbers(0, 1)).toEqual([1]); // female side
  });

  it("handles a triplet birth (one male, two females)", () => {
    expect(nextOffspringNumbers(0, 1)).toEqual([1]); // male side
    expect(nextOffspringNumbers(0, 2)).toEqual([1, 2]); // female side
  });

  it("continues after the highest existing number instead of restarting, so a second litter the same year stays unique", () => {
    expect(nextOffspringNumbers(2, 2)).toEqual([3, 4]);
  });
});

describe("offspringTitle", () => {
  it("matches the spec's human-readable titles", () => {
    expect(offspringTitle("sheep", "male")).toBe("بره نر");
    expect(offspringTitle("sheep", "female")).toBe("بره ماده");
    expect(offspringTitle("goat", "male")).toBe("بزغاله نر");
    expect(offspringTitle("goat", "female")).toBe("بزغاله ماده");
    expect(offspringTitle("cattle", "male")).toBe("گوساله نر");
    expect(offspringTitle("cattle", "female")).toBe("گوساله ماده");
    expect(offspringTitle("horse", "male")).toBe("کره اسب نر");
    expect(offspringTitle("horse", "female")).toBe("کره اسب ماده");
  });
});
