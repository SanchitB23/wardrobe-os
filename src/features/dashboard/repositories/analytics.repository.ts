import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type {
  FormalityEnum,
  LookupOption,
  UsageFrequency,
} from "@/types/wardrobe";

export const ANALYTICS_ITEM_SELECT =
  "id, code, name, status, usage, rating, formality, category_id, subcategory_id, brand_id, primary_color_id";

export type AnalyticsItemRow = {
  id: string;
  code: string;
  name: string;
  status: string | null;
  usage: UsageFrequency | null;
  rating: number | null;
  formality: FormalityEnum | null;
  category_id: string | null;
  subcategory_id: string | null;
  brand_id: string | null;
  primary_color_id: string | null;
  favorite?: boolean | null;
};

export type ColorLookup = LookupOption & {
  hex: string | null;
};

export type DashboardAnalyticsRawData = {
  items: AnalyticsItemRow[];
  categories: LookupOption[];
  subcategories: LookupOption[];
  brands: LookupOption[];
  colors: ColorLookup[];
  seasons: LookupOption[];
  seasonLinks: { item_id: string; season_id: string }[];
  favoriteFlags: Map<string, boolean>;
};

export async function fetchFavoriteFlags(): Promise<Map<string, boolean>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("id, favorite" as typeof ANALYTICS_ITEM_SELECT);

  if (error) {
    return new Map();
  }

  const favorites = new Map<string, boolean>();
  for (const row of (data ?? []) as AnalyticsItemRow[]) {
    if (row.favorite === true) {
      favorites.set(row.id, true);
    }
  }

  return favorites;
}

export async function fetchDashboardAnalyticsRawData(): Promise<{
  data: DashboardAnalyticsRawData | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const [
    itemsResult,
    categoriesResult,
    subcategoriesResult,
    brandsResult,
    colorsResult,
    seasonsResult,
    seasonLinksResult,
    favoriteFlags,
  ] = await Promise.all([
    supabase.from("wardrobe_items").select(ANALYTICS_ITEM_SELECT),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("subcategories").select("id, name").order("name"),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("colors").select("id, name, hex").order("name"),
    supabase.from("seasons").select("id, name").order("name"),
    supabase.from("item_seasons").select("item_id, season_id"),
    fetchFavoriteFlags(),
  ]);

  const firstError =
    itemsResult.error ??
    categoriesResult.error ??
    subcategoriesResult.error ??
    brandsResult.error ??
    colorsResult.error ??
    seasonsResult.error ??
    seasonLinksResult.error;

  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

  const baseItems = (itemsResult.data ?? []) as AnalyticsItemRow[];
  const items = baseItems.map((item) => ({
    ...item,
    favorite: favoriteFlags.get(item.id) ?? null,
  }));

  return {
    data: {
      items,
      categories: (categoriesResult.data ?? []) as LookupOption[],
      subcategories: (subcategoriesResult.data ?? []) as LookupOption[],
      brands: (brandsResult.data ?? []) as LookupOption[],
      colors: (colorsResult.data ?? []) as ColorLookup[],
      seasons: (seasonsResult.data ?? []) as LookupOption[],
      seasonLinks: (seasonLinksResult.data ?? []) as {
        item_id: string;
        season_id: string;
      }[],
      favoriteFlags,
    },
    error: null,
  };
}
