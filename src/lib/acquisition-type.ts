import type { AcquisitionType } from "@/lib/supabase/types";

/** "نحوه ورود به گله" — how an animal entered the farm (Bulk Animal Registration). */
export const ACQUISITION_TYPE_LABELS: Record<AcquisitionType, string> = {
  purchase: "خرید",
  born_on_farm: "متولد شده در مزرعه",
  transfer: "انتقال",
  other: "سایر",
};
