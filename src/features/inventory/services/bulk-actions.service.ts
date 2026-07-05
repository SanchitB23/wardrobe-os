import {
  deleteItemRelations,
  insertItemRelations,
  selectBulkEditLookups,
  updateWardrobeItemsFavorite,
  updateWardrobeItemsField,
} from "@/features/inventory/repositories/bulk-actions.repository";
import type {
  BulkEditAction,
  BulkEditInput,
  BulkEditLookups,
  BulkEditResult,
  LookupOption,
} from "@/features/inventory/types";
import { toError } from "@/shared/utils/data-result";
import { formatEnumLabel } from "@/types/wardrobe";

type RelationTable = "item_tags" | "item_seasons" | "item_styles";

async function removeRelations(
  table: RelationTable,
  itemIds: string[],
  relationId: string,
): Promise<{ affected: number; error: Error | null }> {
  return deleteItemRelations(table, itemIds, relationId);
}

async function addRelations(
  table: RelationTable,
  itemIds: string[],
  relationId: string,
): Promise<{ affected: number; error: Error | null }> {
  return insertItemRelations(table, itemIds, relationId);
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
  return selectBulkEditLookups();
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
