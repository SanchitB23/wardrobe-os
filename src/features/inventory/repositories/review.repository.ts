import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { WardrobeItemRow } from "@/features/inventory/types";

export const REVIEW_ITEM_SELECT = `
  id,
  code,
  name,
  category_id,
  subcategory_id,
  brand_id,
  primary_color_id,
  status,
  ownership,
  fit,
  formality,
  rating,
  usage,
  notes,
  created_at,
  category:categories(id, name),
  subcategory:subcategories(id, name),
  brand:brands(id, name),
  primary_color:colors!wardrobe_items_primary_color_id_fkey(id, name)
`;

export async function selectAllItemsForReview(): Promise<{
  data: WardrobeItemRow[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select(REVIEW_ITEM_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as WardrobeItemRow[], error: null };
}

export async function bulkRetireWardrobeItems(
  ids: string[],
): Promise<{ data: WardrobeItemRow[] | null; error: Error | null }> {
  if (ids.length === 0) {
    return { data: [], error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .update({ status: "retired" })
    .in("id", ids)
    .select(REVIEW_ITEM_SELECT);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as WardrobeItemRow[], error: null };
}

export async function hardDeleteWardrobeItems(
  ids: string[],
): Promise<{ data: { deleted: number } | null; error: Error | null }> {
  if (ids.length === 0) {
    return { data: { deleted: 0 }, error: null };
  }

  const supabase = createClient();
  const { error, count } = await supabase
    .from("wardrobe_items")
    .delete({ count: "exact" })
    .in("id", ids);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: { deleted: count ?? ids.length }, error: null };
}
