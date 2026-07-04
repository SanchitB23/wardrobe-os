import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type {
  BulkEditAction,
  BulkEditInput,
  BulkEditLookups,
  BulkEditResult,
  LookupOption,
} from "@/types/wardrobe";
import { formatEnumLabel } from "@/types/wardrobe";

function toError(message: string) {
  return new Error(message);
}

type WardrobeItemUpdate = Database["public"]["Tables"]["wardrobe_items"]["Update"];

type RelationTable = "item_tags" | "item_seasons" | "item_styles";

async function removeRelations(
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

async function addRelations(
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

async function applyRelationBulkEdit(
  itemIds: string[],
  action: BulkEditAction,
): Promise<{ affected: number; error: Error | null }> {
  switch (action.type) {
    case "add_tag":
      if (!action.tagId) {
        return { affected: 0, error: toError("Tag is required.") };
      }
      return addRelations("item_tags", itemIds, action.tagId);
    case "remove_tag":
      if (!action.tagId) {
        return { affected: 0, error: toError("Tag is required.") };
      }
      return removeRelations("item_tags", itemIds, action.tagId);
    case "add_season":
      if (!action.seasonId) {
        return { affected: 0, error: toError("Season is required.") };
      }
      return addRelations("item_seasons", itemIds, action.seasonId);
    case "remove_season":
      if (!action.seasonId) {
        return { affected: 0, error: toError("Season is required.") };
      }
      return removeRelations("item_seasons", itemIds, action.seasonId);
    case "add_style":
      if (!action.styleId) {
        return { affected: 0, error: toError("Style is required.") };
      }
      return addRelations("item_styles", itemIds, action.styleId);
    case "remove_style":
      if (!action.styleId) {
        return { affected: 0, error: toError("Style is required.") };
      }
      return removeRelations("item_styles", itemIds, action.styleId);
    default:
      return { affected: 0, error: toError("Invalid relation action.") };
  }
}

export async function fetchBulkEditLookups(): Promise<{
  data: BulkEditLookups | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const [tagsResult, seasonsResult, stylesResult] = await Promise.all([
    supabase.from("tags").select("id, name").order("name"),
    supabase.from("seasons").select("id, name").order("name"),
    supabase.from("styles").select("id, name").order("name"),
  ]);

  const firstError = tagsResult.error ?? seasonsResult.error ?? stylesResult.error;
  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

  return {
    data: {
      tags: tagsResult.data ?? [],
      seasons: seasonsResult.data ?? [],
      styles: stylesResult.data ?? [],
    },
    error: null,
  };
}

async function updateWardrobeItemsField(
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

async function updateWardrobeItemsFavorite(
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

async function applyFieldBulkEdit(
  itemIds: string[],
  action: BulkEditAction,
): Promise<{ affected: number; error: Error | null }> {
  switch (action.type) {
    case "set_status":
      return updateWardrobeItemsField(itemIds, { status: action.value });
    case "set_usage":
      return updateWardrobeItemsField(itemIds, { usage: action.value });
    case "set_formality":
      return updateWardrobeItemsField(itemIds, { formality: action.value });
    case "set_fit":
      return updateWardrobeItemsField(itemIds, { fit: action.value });
    case "set_favorite":
      return updateWardrobeItemsFavorite(itemIds, action.value);
    case "add_tag":
    case "remove_tag":
    case "add_season":
    case "remove_season":
    case "add_style":
    case "remove_style":
      return applyRelationBulkEdit(itemIds, action);
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export async function applyBulkEdit(
  input: BulkEditInput,
): Promise<{ data: BulkEditResult | null; error: Error | null }> {
  const { itemIds, action } = input;

  if (itemIds.length === 0) {
    return { data: null, error: toError("No items selected.") };
  }

  const result = await applyFieldBulkEdit(itemIds, action);

  if (result.error) {
    return { data: null, error: result.error };
  }

  return {
    data: {
      affected: result.affected,
      itemCount: itemIds.length,
      action,
    },
    error: null,
  };
}

function lookupName(
  options: LookupOption[],
  id: string,
): string {
  return options.find((option) => option.id === id)?.name ?? "Unknown";
}

export function describeBulkEditAction(
  action: BulkEditAction,
  lookups: BulkEditLookups,
): string {
  switch (action.type) {
    case "set_status":
      return `Set status to ${formatEnumLabel(action.value)}`;
    case "set_usage":
      return `Set usage to ${formatEnumLabel(action.value)}`;
    case "set_formality":
      return action.value
        ? `Set formality to ${formatEnumLabel(action.value)}`
        : "Clear formality";
    case "set_fit":
      return `Set fit to ${formatEnumLabel(action.value)}`;
    case "set_favorite":
      return action.value ? "Mark as favorite" : "Remove favorite";
    case "add_tag":
      return `Add tag “${lookupName(lookups.tags, action.tagId)}”`;
    case "remove_tag":
      return `Remove tag “${lookupName(lookups.tags, action.tagId)}”`;
    case "add_season":
      return `Add season “${lookupName(lookups.seasons, action.seasonId)}”`;
    case "remove_season":
      return `Remove season “${lookupName(lookups.seasons, action.seasonId)}”`;
    case "add_style":
      return `Add style “${lookupName(lookups.styles, action.styleId)}”`;
    case "remove_style":
      return `Remove style “${lookupName(lookups.styles, action.styleId)}”`;
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function isBulkEditActionReady(action: BulkEditAction | null): boolean {
  if (!action) {
    return false;
  }

  switch (action.type) {
    case "set_status":
    case "set_usage":
    case "set_formality":
    case "set_fit":
    case "set_favorite":
      return true;
    case "add_tag":
    case "remove_tag":
      return Boolean(action.tagId);
    case "add_season":
    case "remove_season":
      return Boolean(action.seasonId);
    case "add_style":
    case "remove_style":
      return Boolean(action.styleId);
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

export function createDefaultBulkEditAction(
  type: BulkEditAction["type"],
): BulkEditAction {
  switch (type) {
    case "set_status":
      return { type: "set_status", value: "active" };
    case "set_usage":
      return { type: "set_usage", value: "regular" };
    case "set_formality":
      return { type: "set_formality", value: "casual" };
    case "set_fit":
      return { type: "set_fit", value: "regular" };
    case "set_favorite":
      return { type: "set_favorite", value: true };
    case "add_tag":
    case "remove_tag":
      return { type, tagId: "" };
    case "add_season":
    case "remove_season":
      return { type, seasonId: "" };
    case "add_style":
    case "remove_style":
      return { type, styleId: "" };
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
