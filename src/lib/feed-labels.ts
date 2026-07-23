import type { FeedType, FeedUnit } from "@/lib/supabase/types";

export const FEED_TYPE_LABELS: Record<FeedType, string> = {
  hay: "یونجه",
  straw: "کاه",
  flour: "آرد",
  soybean: "سویا",
  concentrate: "کنسانتره",
};

export const FEED_UNIT_LABELS: Record<FeedUnit, string> = {
  kg: "کیلوگرم",
  ton: "تن",
  bag: "کیسه",
};
