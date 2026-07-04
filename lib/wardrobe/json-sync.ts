import { createClient } from "@/lib/supabase/client";
import type {
  CreateWardrobeItemInput,
  JsonBulkImportResult,
  JsonImportPayload,
} from "@/types/wardrobe";

function toError(message: string) {
  return new Error(message);
}

function buildWardrobeItemInsert(input: CreateWardrobeItemInput) {
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
  };
}

async function findWardrobeItemIdByCode(
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

async function deleteWardrobeItem(itemId: string): Promise<Error | null> {
  const supabase = createClient();
  const { error } = await supabase.from("wardrobe_items").delete().eq("id", itemId);

  if (error) {
    return toError(error.message);
  }

  return null;
}

async function deleteItemRelations(itemId: string): Promise<Error | null> {
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

async function insertItemRelations(
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

export type JsonSyncItemResult =
  | { status: "inserted"; code: string }
  | { status: "updated"; code: string }
  | { status: "failed"; code: string; error: string };

export async function syncJsonWardrobeItem(
  payload: JsonImportPayload,
): Promise<JsonSyncItemResult> {
  const code = payload.item.code.trim();
  const existing = await findWardrobeItemIdByCode(code);

  if (existing.error) {
    return { status: "failed", code, error: existing.error.message };
  }

  if (existing.id) {
    const itemId = existing.id;
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("wardrobe_items")
      .update(buildWardrobeItemInsert(payload.item))
      .eq("id", itemId);

    if (updateError) {
      return {
        status: "failed",
        code,
        error: updateError.message,
      };
    }

    const deleteRelationsError = await deleteItemRelations(itemId);
    if (deleteRelationsError) {
      return {
        status: "failed",
        code,
        error: deleteRelationsError.message,
      };
    }

    const insertRelationsError = await insertItemRelations(itemId, payload);
    if (insertRelationsError) {
      return {
        status: "failed",
        code,
        error: insertRelationsError.message,
      };
    }

    return { status: "updated", code };
  }

  const supabase = createClient();
  const { data: item, error: itemError } = await supabase
    .from("wardrobe_items")
    .insert(buildWardrobeItemInsert(payload.item))
    .select("id")
    .single();

  if (itemError || !item) {
    return {
      status: "failed",
      code,
      error: itemError?.message ?? "Failed to create wardrobe item.",
    };
  }

  const relationError = await insertItemRelations(item.id, payload);
  if (relationError) {
    await deleteWardrobeItem(item.id);
    return {
      status: "failed",
      code,
      error: relationError.message,
    };
  }

  return { status: "inserted", code };
}

export type JsonSyncInput = {
  payloads: JsonImportPayload[];
  skipped?: number;
};

export async function bulkSyncJsonWardrobeItems(
  input: JsonSyncInput,
): Promise<{ data: JsonBulkImportResult | null; error: Error | null }> {
  const { payloads, skipped = 0 } = input;

  if (payloads.length === 0) {
    return {
      data: { inserted: 0, updated: 0, failed: [], skipped },
      error: null,
    };
  }

  const failed: { code: string; error: string }[] = [];
  let inserted = 0;
  let updated = 0;

  for (const payload of payloads) {
    const result = await syncJsonWardrobeItem(payload);

    switch (result.status) {
      case "inserted":
        inserted += 1;
        break;
      case "updated":
        updated += 1;
        break;
      case "failed":
        failed.push({
          code: result.code,
          error: result.error,
        });
        break;
      default: {
        const _exhaustive: never = result;
        return _exhaustive;
      }
    }
  }

  return {
    data: { inserted, updated, failed, skipped },
    error: null,
  };
}
