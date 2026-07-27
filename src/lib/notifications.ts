import type { NotificationType } from "@/lib/supabase/types";

/** Persian labels per notification category — shown in the notification center. */
export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  feed_low: "کمبود خوراک",
  disease_alert: "هشدار بیماری",
  ai_suggestion: "پیشنهاد هوش مصنوعی",
  system: "سیستم",
  subscription_expiring: "انقضای اشتراک",
  marketplace_listing: "بازار گله‌یار",
  premium_feature: "قابلیت ویژه",
  payment_success: "پرداخت موفق",
  announcement: "اعلان",
  health: "سلامت دام",
  vaccination: "واکسیناسیون",
  breeding: "پرورش و تولیدمثل",
  lambing: "زایمان",
  feeding: "خوراک",
  inventory: "موجودی انبار",
  financial: "مالی",
  ai_insight: "بینش هوش مصنوعی",
};
