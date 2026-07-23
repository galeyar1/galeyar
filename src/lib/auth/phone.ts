import { toAsciiDigits } from "@/lib/jalali";

/** Accepts 09121234567 or +989121234567 or 00989121234567; returns E.164 (+989121234567). */
export function normalizeIranianPhone(input: string): string | null {
  const digits = toAsciiDigits(input).replace(/[^\d+]/g, "");

  let national: string | null = null;
  if (/^09\d{9}$/.test(digits)) {
    national = digits.slice(1);
  } else if (/^\+989\d{9}$/.test(digits)) {
    national = digits.slice(3);
  } else if (/^00989\d{9}$/.test(digits)) {
    national = digits.slice(4);
  } else if (/^989\d{9}$/.test(digits)) {
    national = digits.slice(2);
  }

  if (!national) return null;
  return `+98${national}`;
}

export function isValidIranianPhone(input: string): boolean {
  return normalizeIranianPhone(input) !== null;
}
