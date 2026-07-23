import type { FeedInventory, FeedType, FeedUnit } from "@/lib/supabase/types";

export const FEED_TYPE_LABELS: Record<FeedType, string> = {
  hay: "یونجه",
  straw: "کاه",
  flour: "آرد",
  soybean: "سویا",
  concentrate: "کنسانتره",
  barley: "جو",
  corn: "ذرت",
  wheat_bran: "سبوس گندم",
  salt: "نمک",
  mineral_supplements: "مکمل معدنی",
  custom: "سایر",
};

export const FEED_UNIT_LABELS: Record<FeedUnit, string> = {
  kg: "کیلوگرم",
  ton: "تن",
  bag: "کیسه",
};

/** "custom" feed types carry their real name in custom_label; every other type uses the fixed label. */
export function feedLabel(item: Pick<FeedInventory, "feed_type" | "custom_label">): string {
  if (item.feed_type === "custom") return item.custom_label || FEED_TYPE_LABELS.custom;
  return FEED_TYPE_LABELS[item.feed_type];
}
