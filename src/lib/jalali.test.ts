import { describe, it, expect } from "vitest";
import { toPersianDigits, toAsciiDigits, isoToJalali, jalaliToIso, formatJalali } from "@/lib/jalali";

describe("toPersianDigits / toAsciiDigits", () => {
  it("converts ASCII digits to Persian digits", () => {
    expect(toPersianDigits(1404)).toBe("۱۴۰۴");
    expect(toPersianDigits("12/05")).toBe("۱۲/۰۵");
  });

  it("round-trips Persian digits back to ASCII", () => {
    expect(toAsciiDigits("۰۹۱۲۱۲۳۴۵۶۷")).toBe("09121234567");
  });

  it("leaves non-digit characters untouched", () => {
    expect(toPersianDigits("سال ۱۴۰۴")).toBe("سال ۱۴۰۴");
  });
});

describe("isoToJalali / jalaliToIso", () => {
  it("converts a known Gregorian date to its Jalali equivalent", () => {
    // 2026-03-21 is Nowruz — 1405/01/01.
    const { jy, jm, jd } = isoToJalali("2026-03-21");
    expect({ jy, jm, jd }).toEqual({ jy: 1405, jm: 1, jd: 1 });
  });

  it("round-trips iso -> jalali -> iso back to the same date", () => {
    const iso = "2026-07-23";
    const { jy, jm, jd } = isoToJalali(iso);
    expect(jalaliToIso(jy, jm, jd)).toBe(iso);
  });
});

describe("formatJalali", () => {
  it("returns an em dash for a missing date", () => {
    expect(formatJalali(null)).toBe("—");
    expect(formatJalali(undefined)).toBe("—");
  });

  it("formats with Persian digits by default", () => {
    expect(formatJalali("2026-03-21")).toBe("۱۴۰۵/۰۱/۰۱");
  });

  it("formats with the month name when requested", () => {
    expect(formatJalali("2026-03-21", true)).toBe("۱ فروردین ۱۴۰۵");
  });
});
