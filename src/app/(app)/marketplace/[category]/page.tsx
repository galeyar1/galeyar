import { MARKETPLACE_CATEGORIES } from "@/lib/marketplace";
import type { MarketplaceCategory } from "@/lib/supabase/types";
import { CategoryBrowse } from "./category-browse";

export function generateStaticParams() {
  return MARKETPLACE_CATEGORIES.map((category) => ({ category }));
}

export default async function MarketplaceCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  return <CategoryBrowse category={category as MarketplaceCategory} />;
}
