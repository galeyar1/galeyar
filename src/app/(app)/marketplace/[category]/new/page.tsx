import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace";
import type { MarketplaceCategory } from "@/lib/supabase/types";
import { ListingForm } from "./listing-form";

export function generateStaticParams() {
  return MARKETPLACE_CATEGORIES.map((category) => ({ category }));
}

export default async function NewListingPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  return <ListingForm category={category as MarketplaceCategory} />;
}
