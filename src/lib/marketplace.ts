import type { MarketplaceCategory } from "@/lib/supabase/types";

export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = ["animal", "feed", "equipment", "service", "medicine"];

export const MARKETPLACE_CATEGORY_LABELS: Record<MarketplaceCategory, string> = {
  animal: "دام",
  feed: "خوراک",
  equipment: "تجهیزات",
  service: "خدمات",
  medicine: "دارو",
};

/** Feed types sellable on the marketplace — the spec's named subset of the full FeedType enum. */
export const MARKETPLACE_FEED_TYPES = ["hay", "straw", "barley", "concentrate", "soybean"] as const;

export const EQUIPMENT_TYPE_EXAMPLES = ["دستگاه شیردوش", "آخور", "آبخوری", "پلاک گوش", "ترازو", "سایر"];

export type ServiceType = "veterinarian" | "nutrition_consultant" | "artificial_insemination" | "genetic_testing" | "transportation";
export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  veterinarian: "دامپزشک",
  nutrition_consultant: "مشاور تغذیه",
  artificial_insemination: "تلقیح مصنوعی",
  genetic_testing: "آزمایش ژنتیک",
  transportation: "حمل‌ونقل",
};

export type MedicineType = "vaccine" | "dewormer" | "supplement";
export const MEDICINE_TYPE_LABELS: Record<MedicineType, string> = {
  vaccine: "واکسن",
  dewormer: "ضد انگل",
  supplement: "مکمل",
};

export interface MarketplaceFilters {
  species?: string;
  breed?: string;
  province?: string;
  maxPrice?: number;
}

interface FilterableListing {
  province: string | null;
  price: number | null;
  attributes: Record<string, string | number>;
}

/** Client-side filtering for the browse pages — mirrors what would be query params on a server-paginated version later. */
export function matchesFilters(listing: FilterableListing, filters: MarketplaceFilters): boolean {
  if (filters.species && listing.attributes.species !== filters.species) return false;
  if (filters.breed && listing.attributes.breed !== filters.breed) return false;
  if (filters.province && listing.province !== filters.province) return false;
  if (filters.maxPrice !== undefined && (listing.price === null || listing.price > filters.maxPrice)) return false;
  return true;
}
