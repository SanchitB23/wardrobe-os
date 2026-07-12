import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { Database } from "@/types/database";
import type { BulkEditLookups } from "@/features/inventory/types";

type WardrobeItemUpdate = Database["public"]["Tables"]["wardrobe_items"]["Update"];

type RelationTable = "item_tags" | "item_seasons" | "item_styles";

export async function deleteItemRelations(
  table: RelationTable,
  itemIds: string[],
  relationId: string,
): Promise<{ affected: number; error: Error | null }> {
  const supabase = createClient();

  if (table === "item_tags") {
    const { data, error } = await supabase
      .from("item_tags")
      .delete()
      .in("item_id", itemIds)
      .eq("tag_id", relationId)
      .select("item_id");
    if (error) {
      return { affected: 0, error: toError(error.message) };
    }
    return { affected: data?.length ?? 0, error: null };
  }

  if (table === "item_seasons") {
    const { data, error } = await supabase
      .from("item_seasons")
      .delete()
      .in("item_id", itemIds)
      .eq("season_id", relationId)
      .select("item_id");
    if (error) {
      return { affected: 0, error: toError(error.message) };
    }
    return { affected: data?.length ?? 0, error: null };
  }

  const { data, error } = await supabase
    .from("item_styles")
    .delete()
    .in("item_id", itemIds)
    .eq("style_id", relationId)
    .select("item_id");

  if (error) {
    return { affected: 0, error: toError(error.message) };
  }

  return { affected: data?.length ?? 0, error: null };
}

export async function insertItemRelations(
  table: RelationTable,
  itemIds: string[],
  relationId: string,
): Promise<{ affected: number; error: Error | null }> {
  const supabase = createClient();

  if (table === "item_tags") {
    const { data: existingRows, error: existingError } = await supabase
      .from("item_tags")
      .select("item_id")
      .in("item_id", itemIds)
      .eq("tag_id", relationId);

    if (existingError) {
      return { affected: 0, error: toError(existingError.message) };
    }

    const existingItemIds = new Set((existingRows ?? []).map((row) => row.item_id));
    const rowsToInsert = itemIds
      .filter((itemId) => !existingItemIds.has(itemId))
      .map((itemId) => ({ item_id: itemId, tag_id: relationId }));

    if (rowsToInsert.length === 0) {
      return { affected: 0, error: null };
    }

    const { data, error } = await supabase
      .from("item_tags")
      .insert(rowsToInsert)
      .select("item_id");

    if (error) {
      return { affected: 0, error: toError(error.message) };
    }

    return { affected: data?.length ?? 0, error: null };
  }

  if (table === "item_seasons") {
    const { data: existingRows, error: existingError } = await supabase
      .from("item_seasons")
      .select("item_id")
      .in("item_id", itemIds)
      .eq("season_id", relationId);

    if (existingError) {
      return { affected: 0, error: toError(existingError.message) };
    }

    const existingItemIds = new Set((existingRows ?? []).map((row) => row.item_id));
    const rowsToInsert = itemIds
      .filter((itemId) => !existingItemIds.has(itemId))
      .map((itemId) => ({ item_id: itemId, season_id: relationId }));

    if (rowsToInsert.length === 0) {
      return { affected: 0, error: null };
    }

    const { data, error } = await supabase
      .from("item_seasons")
      .insert(rowsToInsert)
      .select("item_id");

    if (error) {
      return { affected: 0, error: toError(error.message) };
    }

    return { affected: data?.length ?? 0, error: null };
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("item_styles")
    .select("item_id")
    .in("item_id", itemIds)
    .eq("style_id", relationId);

  if (existingError) {
    return { affected: 0, error: toError(existingError.message) };
  }

  const existingItemIds = new Set((existingRows ?? []).map((row) => row.item_id));
  const rowsToInsert = itemIds
    .filter((itemId) => !existingItemIds.has(itemId))
    .map((itemId) => ({ item_id: itemId, style_id: relationId }));

  if (rowsToInsert.length === 0) {
    return { affected: 0, error: null };
  }

  const { data, error } = await supabase
    .from("item_styles")
    .insert(rowsToInsert)
    .select("item_id");

  if (error) {
    return { affected: 0, error: toError(error.message) };
  }

  return { affected: data?.length ?? 0, error: null };
}

export async function selectBulkEditLookups(): Promise<{
  data: BulkEditLookups | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const [tagsResult, seasonsResult, stylesResult, occasionsResult, materialsResult] =
    await Promise.all([
      supabase.from("tags").select("id, name").order("name"),
      supabase.from("seasons").select("id, name").order("name"),
      supabase.from("styles").select("id, name").order("name"),
      supabase.from("occasions").select("id, name").order("name"),
      supabase.from("materials").select("id, name").order("name"),
    ]);

  const firstError =
    tagsResult.error ??
    seasonsResult.error ??
    stylesResult.error ??
    occasionsResult.error ??
    materialsResult.error;
  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

  return {
    data: {
      tags: tagsResult.data ?? [],
      seasons: seasonsResult.data ?? [],
      styles: stylesResult.data ?? [],
      occasions: occasionsResult.data ?? [],
      materials: materialsResult.data ?? [],
    },
    error: null,
  };
}

export async function updateWardrobeItemsField(
  itemIds: string[],
  payload: WardrobeItemUpdate,
): Promise<{ affected: number; error: Error | null }> {
  if (itemIds.length === 0) {
    return { affected: 0, error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .update(payload)
    .in("id", itemIds)
    .select("id");

  if (error) {
    return { affected: 0, error: toError(error.message) };
  }

  return { affected: data?.length ?? 0, error: null };
}

export async function updateWardrobeItemsFavorite(
  itemIds: string[],
  favorite: boolean,
): Promise<{ affected: number; error: Error | null }> {
  if (itemIds.length === 0) {
    return { affected: 0, error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .update({ favorite } as WardrobeItemUpdate)
    .in("id", itemIds)
    .select("id");

  if (error) {
    return { affected: 0, error: toError(error.message) };
  }

  return { affected: data?.length ?? 0, error: null };
}
