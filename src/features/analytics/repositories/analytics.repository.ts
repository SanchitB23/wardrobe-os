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
