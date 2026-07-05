import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { FormalityEnum, ItemStatus, UsageFrequency } from "@/types/wardrobe";

const HEALTH_ITEM_SELECT = `
  id,
  name,
  formality,
  usage,
  rating,
  status,
  category:categories(name),
  subcategory:subcategories(name),
  brand:brands(name),
  primary_color:colors!wardrobe_items_primary_color_id_fkey(name),
  item_seasons(seasons(name)),
  item_styles(styles(name)),
  item_tags(tags(name))
`;

type NamedRef = { name: string } | null;

export type HealthItemRow = {
  id: string;
  name: string;
  formality: FormalityEnum | null;
  usage: UsageFrequency | null;
  rating: number | null;
  status: ItemStatus | null;
  category: NamedRef;
  subcategory: NamedRef;
  brand: NamedRef;
  primary_color: NamedRef;
  item_seasons: { seasons: NamedRef }[] | null;
  item_styles: { styles: NamedRef }[] | null;
  item_tags: { tags: NamedRef }[] | null;
};

/** Fetches active wardrobe items with the fields the health engine consumes. */
export async function selectActiveHealthItems(): Promise<{
  data: HealthItemRow[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select(HEALTH_ITEM_SELECT)
    .eq("status", "active")
    .order("name");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as unknown as HealthItemRow[], error: null };
}

// ---------------------------------------------------------------------------
// Usage analytics — wardrobe items, wear logs, and purchase prices.
// ---------------------------------------------------------------------------

const USAGE_ITEM_SELECT = `
  id,
  name,
  formality,
  usage,
  status,
  category:categories(name)
`;

export type UsageItemRow = {
  id: string;
  name: string;
  formality: FormalityEnum | null;
  usage: UsageFrequency | null;
  status: ItemStatus | null;
  category: NamedRef;
};

export type UsageWearLogRow = {
  item_id: string | null;
  worn_on: string;
  occasion: NamedRef;
};

export type UsagePurchaseRow = {
  item_id: string;
  price: number | null;
};

export type UsageAnalyticsData = {
  items: UsageItemRow[];
  wearLogs: UsageWearLogRow[];
  purchases: UsagePurchaseRow[];
};

/** Fetches everything the usage analytics engine needs, in parallel. */
export async function selectUsageAnalyticsData(): Promise<{
  data: UsageAnalyticsData | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const [itemsResult, wearLogsResult, purchasesResult] = await Promise.all([
    supabase.from("wardrobe_items").select(USAGE_ITEM_SELECT).order("name"),
    supabase.from("wear_logs").select("item_id, worn_on, occasion:occasions(name)"),
    supabase.from("purchases").select("item_id, price"),
  ]);

  const error =
    itemsResult.error ?? wearLogsResult.error ?? purchasesResult.error;
  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return {
    data: {
      items: (itemsResult.data ?? []) as unknown as UsageItemRow[],
      wearLogs: (wearLogsResult.data ?? []) as unknown as UsageWearLogRow[],
      purchases: (purchasesResult.data ?? []) as unknown as UsagePurchaseRow[],
    },
    error: null,
  };
}
