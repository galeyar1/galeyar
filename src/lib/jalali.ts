import * as jalaali from "jalaali-js";

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

/** Converts ASCII digits in a string to Persian digits for display. */
export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

/** Converts Persian/Arabic-Indic digits back to ASCII digits (for parsing user input). */
export function toAsciiDigits(value: string): string {
  return value.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d))).replace(/[٠-٩]/g, (d) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(d))
  );
}

/**
 * Every date persisted to Supabase/IndexedDB is stored as an ISO 8601
 * Gregorian string (`YYYY-MM-DD`). Jalali is a display/input concern only,
 * so conversion happens at the UI boundary.
 */
export function isoToJalali(iso: string): { jy: number; jm: number; jd: number } {
  const [gy, gm, gd] = iso.split("-").map(Number);
  return jalaali.toJalaali(gy, gm, gd);
}

export function jalaliToIso(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  return `${String(gy).padStart(4, "0")}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

/** Formats an ISO date string as a readable Jalali date, e.g. "۱۴۰۴/۰۴/۰۲". */
export function formatJalali(iso: string | null | undefined, withMonthName = false): string {
  if (!iso) return "—";
  const { jy, jm, jd } = isoToJalali(iso);
  if (withMonthName) {
    return `${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
  }
  return toPersianDigits(
    `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`
  );
}

/** Today's date as an ISO string, for defaulting form fields. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
