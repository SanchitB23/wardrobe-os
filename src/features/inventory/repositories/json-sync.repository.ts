import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { Database } from "@/types/database";
import type { CreateWardrobeItemInput, JsonImportPayload } from "@/features/inventory/types";

export type WardrobeItemInsertPayload =
  Database["public"]["Tables"]["wardrobe_items"]["Insert"];

export function buildWardrobeItemInsert(input: CreateWardrobeItemInput): WardrobeItemInsertPayload {
  return {
    code: input.code.trim(),
    name: input.name.trim(),
    category_id: input.category_id ?? null,
    subcategory_id: input.subcategory_id ?? null,
    brand_id: input.brand_id ?? null,
    primary_color_id: input.primary_color_id ?? null,
    status: input.status ?? "active",
    ownership: input.ownership ?? "owned",
    fit: input.fit ?? "unknown",
    formality: input.formality ?? null,
    rating: input.rating ?? null,
    usage: input.usage ?? null,
    notes: input.notes?.trim() || null,
  } as WardrobeItemInsertPayload;
}

export async function selectWardrobeItemIdByCode(
  code: string,
): Promise<{ id: string | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("id")
    .eq("code", code.trim())
    .maybeSingle();

  if (error) {
    return { id: null, error: toError(error.message) };
  }

  return { id: data?.id ?? null, error: null };
}

export async function deleteWardrobeItemById(itemId: string): Promise<Error | null> {
  const supabase = createClient();
  const { error } = await supabase.from("wardrobe_items").delete().eq("id", itemId);

  if (error) {
    return toError(error.message);
  }

  return null;
}

export async function deleteAllItemRelations(itemId: string): Promise<Error | null> {
  const supabase = createClient();

  const results = await Promise.all([
    supabase.from("item_materials").delete().eq("item_id", itemId),
    supabase.from("item_seasons").delete().eq("item_id", itemId),
    supabase.from("item_styles").delete().eq("item_id", itemId),
    supabase.from("item_features").delete().eq("item_id", itemId),
    supabase.from("item_tags").delete().eq("item_id", itemId),
    supabase.from("item_occasions").delete().eq("item_id", itemId),
    supabase.from("care_profiles").delete().eq("item_id", itemId),
  ]);

  const firstError = results.find((result) => result.error)?.error;
  if (firstError) {
    return toError(firstError.message);
  }

  return null;
}

export async function insertJsonItemRelations(
  itemId: string,
  payload: JsonImportPayload,
): Promise<Error | null> {
  const supabase = createClient();

  if (payload.materialIds.length > 0) {
    const { error } = await supabase.from("item_materials").insert(
      payload.materialIds.map((materialId) => ({
        item_id: itemId,
        material_id: materialId,
      })),
    );
    if (error) {
      return toError(error.message);
    }
  }

  if (payload.seasonIds.length > 0) {
    const { error } = await supabase.from("item_seasons").insert(
      payload.seasonIds.map((seasonId) => ({
        item_id: itemId,
        season_id: seasonId,
      })),
    );
    if (error) {
      return toError(error.message);
    }
  }

  if (payload.styleIds.length > 0) {
    const { error } = await supabase.from("item_styles").insert(
      payload.styleIds.map((styleId) => ({
        item_id: itemId,
        style_id: styleId,
      })),
    );
    if (error) {
      return toError(error.message);
    }
  }

  if (payload.featureIds.length > 0) {
    const { error } = await supabase.from("item_features").insert(
      payload.featureIds.map((featureId) => ({
        item_id: itemId,
        feature_id: featureId,
      })),
    );
    if (error) {
      return toError(error.message);
    }
  }

  if (payload.tagIds.length > 0) {
    const { error } = await supabase.from("item_tags").insert(
      payload.tagIds.map((tagId) => ({
        item_id: itemId,
        tag_id: tagId,
      })),
    );
    if (error) {
      return toError(error.message);
    }
  }

  if (payload.occasions.length > 0) {
    const { error } = await supabase.from("item_occasions").insert(
      payload.occasions.map((occasion) => ({
        item_id: itemId,
        occasion_id: occasion.occasion_id,
        score: occasion.score,
      })),
    );
    if (error) {
      return toError(error.message);
    }
  }

  if (payload.care) {
    const { error } = await supabase.from("care_profiles").insert({
      item_id: itemId,
      storage_type_id: payload.care.storage_type_id,
      storage: payload.care.storage,
      wash: payload.care.wash,
      notes: payload.care.notes,
    });
    if (error) {
      return toError(error.message);
    }
  }

  return null;
}

export async function updateWardrobeItemByCode(
  itemId: string,
  payload: WardrobeItemInsertPayload,
): Promise<Error | null> {
  const supabase = createClient();
  const { error } = await supabase
    .from("wardrobe_items")
    .update(payload)
    .eq("id", itemId);

  if (error) {
    return toError(error.message);
  }

  return null;
}

export async function insertWardrobeItemForSync(
  payload: WardrobeItemInsertPayload,
): Promise<{ id: string | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return { id: null, error: toError(error.message) };
  }

  return { id: data?.id ?? null, error: null };
}
