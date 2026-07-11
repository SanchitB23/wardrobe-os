import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { FormalityEnum, ItemStatus, UsageFrequency } from "@/types/wardrobe";

type NamedRef = { name: string } | null;

/** Rich item fields (all statuses) the recommendation context builder needs. */
const RECO_ITEM_SELECT = `
  id,
  name,
  formality,
  usage,
  rating,
  status,
  category:categories(name),
  subcategory:subcategories(name),
  primary_color:colors!wardrobe_items_primary_color_id_fkey(name),
  item_seasons(seasons(name)),
  item_styles(styles(name)),
  item_tags(tags(name))
`;

export type RecoItemRow = {
  id: string;
  name: string;
  formality: FormalityEnum | null;
  usage: UsageFrequency | null;
  rating: number | null;
  status: ItemStatus | null;
  category: NamedRef;
  subcategory: NamedRef;
  primary_color: NamedRef;
  item_seasons: { seasons: NamedRef }[] | null;
  item_styles: { styles: NamedRef }[] | null;
  item_tags: { tags: NamedRef }[] | null;
};

export type RecoWearLogRow = {
  item_id: string | null;
  worn_on: string;
  outfit_id: string | null;
};

export type RecoPurchaseRow = {
  item_id: string;
  price: number | null;
  purchase_date: string | null;
};
export type RecoOutfitRow = {
  id: string;
  name: string;
  favorite: boolean | null;
  rating: number | null;
};
export type RecoOutfitItemRow = { outfit_id: string; item_id: string };

export type RecommendationData = {
  items: RecoItemRow[];
  wearLogs: RecoWearLogRow[];
  purchases: RecoPurchaseRow[];
  outfits: RecoOutfitRow[];
  outfitItems: RecoOutfitItemRow[];
};

/**
 * Fetches everything the recommendation context builder needs — items (all
 * statuses, rich metadata), wear logs (with outfit id), purchases, and saved
 * outfits with their item links — in parallel.
 */
export async function selectRecommendationData(): Promise<{
  data: RecommendationData | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const [items, wearLogs, purchases, outfits, outfitItems] = await Promise.all([
    supabase.from("wardrobe_items").select(RECO_ITEM_SELECT).order("name"),
    supabase.from("wear_logs").select("item_id, worn_on, outfit_id"),
    supabase.from("purchases").select("item_id, price, purchase_date"),
    supabase.from("outfits").select("id, name, favorite, rating"),
    supabase.from("outfit_items").select("outfit_id, item_id"),
  ]);

  const error =
    items.error ??
    wearLogs.error ??
    purchases.error ??
    outfits.error ??
    outfitItems.error;
  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return {
    data: {
      items: (items.data ?? []) as unknown as RecoItemRow[],
      wearLogs: (wearLogs.data ?? []) as unknown as RecoWearLogRow[],
      purchases: (purchases.data ?? []) as unknown as RecoPurchaseRow[],
      outfits: (outfits.data ?? []) as unknown as RecoOutfitRow[],
      outfitItems: (outfitItems.data ?? []) as unknown as RecoOutfitItemRow[],
    },
    error: null,
  };
}
