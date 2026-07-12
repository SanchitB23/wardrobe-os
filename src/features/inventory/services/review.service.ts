/**
 * Catalog Review service (RFC-024).
 * Orchestrates repositories + domain classifyCatalogIssues.
 */

import {
  classifyCatalogIssues,
  type CatalogItemView,
  type CatalogReviewModel,
  type CatalogVisualStatus,
} from "@/domain/catalog-review";
import {
  bulkRetireWardrobeItems,
  hardDeleteWardrobeItems,
  insertCatalogDismissal,
  selectAllItemsForReview,
  selectCatalogDismissals,
  selectPrimaryImageItemIds,
  selectRelationPresence,
  selectReviewedItemIds,
  selectVisualStatusByItemId,
  upsertCatalogItemReviewed,
} from "@/features/inventory/repositories/review.repository";
import type {
  BulkCleanupMode,
  BulkCleanupResult,
  WardrobeItemRow,
} from "@/features/inventory/types";

export type CatalogReviewFilters = {
  includeRetired?: boolean;
  hideReviewedIssues?: boolean;
};

export type CatalogReviewResult = CatalogReviewModel & {
  itemById: Map<string, WardrobeItemRow>;
  reviewedItemIds: string[];
};

function toVisualStatus(raw: string | undefined): CatalogVisualStatus {
  if (!raw) return "none";
  if (
    raw === "pending" ||
    raw === "accepted" ||
    raw === "rejected" ||
    raw === "stale"
  ) {
    return raw;
  }
  return "none";
}

function toCatalogItemView(
  row: WardrobeItemRow,
  images: Set<string>,
  relations: {
    materials: Set<string>;
    seasons: Set<string>;
    occasions: Set<string>;
  },
  visuals: Map<string, string>,
): CatalogItemView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    status: row.status,
    categoryId: row.category_id,
    categoryName: row.category?.name ?? null,
    subcategoryId: row.subcategory_id,
    brandId: row.brand_id,
    brandName: row.brand?.name ?? null,
    colorId: row.primary_color_id,
    colorName: row.primary_color?.name ?? null,
    hasMaterial: relations.materials.has(row.id),
    hasSeason: relations.seasons.has(row.id),
    hasOccasion: relations.occasions.has(row.id),
    hasPrimaryImage: images.has(row.id) || Boolean(row.primary_image_url),
    visualStatus: toVisualStatus(visuals.get(row.id)),
  };
}

/**
 * Legacy helper kept for callers that only need duplicate groups from rows.
 * Prefer getCatalogReview for the full Catalog Review surface.
 */
export function buildDuplicateReview(items: WardrobeItemRow[]) {
  const views = items.map((row) =>
    toCatalogItemView(
      row,
      new Set(),
      {
        materials: new Set(),
        seasons: new Set(),
        occasions: new Set(),
      },
      new Map(),
    ),
  );
  const model = classifyCatalogIssues(views, { includeRetired: true });
  return {
    groups: model.duplicates.map((g) => ({
      id: g.id,
      reason: g.reason === "same_code" ? ("same_code" as const) : ("same_identity" as const),
      label: g.label,
      items: g.itemIds
        .map((id) => items.find((i) => i.id === id))
        .filter((i): i is WardrobeItemRow => Boolean(i)),
    })),
    totalItems: items.length,
    duplicateItemCount: new Set(model.duplicates.flatMap((g) => g.itemIds)).size,
  };
}

export async function fetchAllItemsForReview(): Promise<{
  data: WardrobeItemRow[] | null;
  error: Error | null;
}> {
  return selectAllItemsForReview();
}

export async function getCatalogReview(
  filters: CatalogReviewFilters = {},
): Promise<{ data: CatalogReviewResult | null; error: Error | null }> {
  const [itemsRes, imagesRes, relationsRes, visualsRes, dismissalsRes, reviewedRes] =
    await Promise.all([
      selectAllItemsForReview(),
      selectPrimaryImageItemIds(),
      selectRelationPresence(),
      selectVisualStatusByItemId(),
      selectCatalogDismissals(),
      selectReviewedItemIds(),
    ]);

  if (itemsRes.error || !itemsRes.data) {
    return {
      data: null,
      error: itemsRes.error ?? new Error("Failed to load items."),
    };
  }
  if (imagesRes.error || !imagesRes.data) {
    return { data: null, error: imagesRes.error };
  }
  if (relationsRes.error || !relationsRes.data) {
    return { data: null, error: relationsRes.error };
  }
  if (visualsRes.error || !visualsRes.data) {
    return { data: null, error: visualsRes.error };
  }
  if (dismissalsRes.error || !dismissalsRes.data) {
    return { data: null, error: dismissalsRes.error };
  }
  if (reviewedRes.error || !reviewedRes.data) {
    return { data: null, error: reviewedRes.error };
  }

  const itemById = new Map(itemsRes.data.map((row) => [row.id, row]));
  const views = itemsRes.data.map((row) =>
    toCatalogItemView(
      row,
      imagesRes.data!,
      relationsRes.data!,
      visualsRes.data!,
    ),
  );

  const model = classifyCatalogIssues(views, {
    includeRetired: filters.includeRetired ?? false,
    dismissals: dismissalsRes.data,
    reviewedItemIds: reviewedRes.data,
    hideReviewedIssues: filters.hideReviewedIssues ?? false,
  });

  return {
    data: {
      ...model,
      itemById,
      reviewedItemIds: [...reviewedRes.data],
    },
    error: null,
  };
}

export async function dismissCatalogPair(input: {
  itemIdA: string;
  itemIdB: string;
  kind: "duplicate" | "similar";
  reason?: string | null;
}): Promise<{ data: true | null; error: Error | null }> {
  return insertCatalogDismissal(input);
}

export async function markCatalogItemReviewed(
  itemId: string,
): Promise<{ data: true | null; error: Error | null }> {
  return upsertCatalogItemReviewed(itemId);
}

export async function bulkCleanupWardrobeItems(
  ids: string[],
  mode: BulkCleanupMode,
): Promise<{ data: BulkCleanupResult | null; error: Error | null }> {
  if (mode === "retire") {
    const result = await bulkRetireWardrobeItems(ids);
    if (result.error) {
      return { data: null, error: result.error };
    }
    return {
      data: { processed: result.data?.length ?? 0, mode },
      error: null,
    };
  }

  const result = await hardDeleteWardrobeItems(ids);
  if (result.error) {
    return { data: null, error: result.error };
  }

  return {
    data: { processed: result.data?.deleted ?? 0, mode },
    error: null,
  };
}
