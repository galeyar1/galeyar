export interface GaugeBand {
  max: number;
  color: string;
  label: string;
}

/**
 * Youth Index bands (spec section 2) — deliberately neutral colors, since a
 * higher Youth Index is NOT "better," only a direction. Centralized here so
 * the product-display thresholds (0-20/21-40/.../81-100) live in one place,
 * not scattered across the gauge component or page.
 */
export const YOUTH_INDEX_BANDS: GaugeBand[] = [
  { max: 20, color: "#6D4C41", label: "بسیار پیر" },
  { max: 40, color: "#A1887F", label: "متمایل به پیری" },
  { max: 60, color: "#9E9E9E", label: "میانه" },
  { max: 80, color: "#66BB6A", label: "متمایل به جوانی" },
  { max: 100, color: "#2E7D32", label: "بسیار جوان" },
];

/**
 * Age Balance bands (spec section 22) — here higher genuinely is better, so
 * a weak-to-strong color progression is appropriate.
 */
export const AGE_BALANCE_BANDS: GaugeBand[] = [
  { max: 39, color: "#C62828", label: "ضعیف" },
  { max: 59, color: "#EF6C00", label: "نیازمند توجه" },
  { max: 79, color: "#9E9D24", label: "مناسب" },
  { max: 100, color: "#2E7D32", label: "متعادل" },
];
