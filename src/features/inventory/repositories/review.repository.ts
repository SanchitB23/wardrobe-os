/**
 * Catalog Review persistence (RFC-024) + cleanup mutations.
 */

import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { WardrobeItemRow } from "@/features/inventory/types";
import type { CatalogDismissal } from "@/domain/catalog-review";

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
  favorite,
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

export async function selectPrimaryImageItemIds(): Promise<{
  data: Set<string> | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("item_images")
    .select("item_id")
    .eq("is_primary", true);

  if (error) return { data: null, error: toError(error.message) };
  const set = new Set<string>();
  for (const row of data ?? []) {
    if (row.item_id) set.add(row.item_id);
  }
  return { data: set, error: null };
}

export async function selectRelationPresence(): Promise<{
  data: {
    materials: Set<string>;
    seasons: Set<string>;
    occasions: Set<string>;
  } | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const [materials, seasons, occasions] = await Promise.all([
    supabase.from("item_materials").select("item_id"),
    supabase.from("item_seasons").select("item_id"),
    supabase.from("item_occasions").select("item_id"),
  ]);

  const err =
    materials.error ?? seasons.error ?? occasions.error ?? null;
  if (err) return { data: null, error: toError(err.message) };

  const toSet = (rows: { item_id: string }[] | null) => {
    const set = new Set<string>();
    for (const row of rows ?? []) set.add(row.item_id);
    return set;
  };

  return {
    data: {
      materials: toSet(materials.data as { item_id: string }[] | null),
      seasons: toSet(seasons.data as { item_id: string }[] | null),
      occasions: toSet(occasions.data as { item_id: string }[] | null),
    },
    error: null,
  };
}

export async function selectVisualStatusByItemId(): Promise<{
  data: Map<string, string> | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("item_visual_attributes")
    .select("item_id, status");

  if (error) return { data: null, error: toError(error.message) };
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.item_id, row.status);
  }
  return { data: map, error: null };
}

export async function selectCatalogDismissals(): Promise<{
  data: CatalogDismissal[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("catalog_review_dismissals")
    .select("item_id_a, item_id_b, kind");

  if (error) return { data: null, error: toError(error.message) };
  return {
    data: (data ?? []).map((row) => ({
      itemIdA: row.item_id_a,
      itemIdB: row.item_id_b,
      kind: row.kind as "duplicate" | "similar",
    })),
    error: null,
  };
}

export async function insertCatalogDismissal(input: {
  itemIdA: string;
  itemIdB: string;
  kind: "duplicate" | "similar";
  reason?: string | null;
}): Promise<{ data: true | null; error: Error | null }> {
  const [a, b] =
    input.itemIdA < input.itemIdB
      ? [input.itemIdA, input.itemIdB]
      : [input.itemIdB, input.itemIdA];
  const supabase = createClient();
  const { error } = await supabase.from("catalog_review_dismissals").upsert(
    {
      item_id_a: a,
      item_id_b: b,
      kind: input.kind,
      reason: input.reason ?? null,
    },
    { onConflict: "item_id_a,item_id_b,kind" },
  );
  if (error) return { data: null, error: toError(error.message) };
  return { data: true, error: null };
}

export async function selectReviewedItemIds(): Promise<{
  data: Set<string> | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("catalog_review_item_state")
    .select("item_id, reviewed_at")
    .not("reviewed_at", "is", null);

  if (error) return { data: null, error: toError(error.message) };
  const set = new Set<string>();
  for (const row of data ?? []) set.add(row.item_id);
  return { data: set, error: null };
}

export async function upsertCatalogItemReviewed(
  itemId: string,
): Promise<{ data: true | null; error: Error | null }> {
  const supabase = createClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("catalog_review_item_state").upsert(
    {
      item_id: itemId,
      reviewed_at: now,
      updated_at: now,
    },
    { onConflict: "item_id" },
  );
  if (error) return { data: null, error: toError(error.message) };
  return { data: true, error: null };
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
