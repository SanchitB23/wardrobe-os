/**
 * Category Optimization service (RFC-015A).
 * Assembles wardrobe signals, runs pure `buildCategoryOptimization`, returns
 * `{ data, error }`. Wishlist writes happen only on explicit user confirm.
 */

import {
  buildCategoryOptimization,
  clusterCategoryKey,
  toCategoryKey,
  type CategoryOptimizationContext,
  type CategoryOptimizationItemInput,
  type CategoryOptimizationResult,
  type ReplacementOpportunity,
} from "@/domain/category-optimization";
import {
  categoryBucketFor,
  colorFamilyFor,
} from "@/domain/analytics/WardrobeHealthEngine";
import { fetchWardrobeHealth } from "@/features/analytics/services/analytics.service";
import {
  selectRecommendationData,
  type RecoItemRow,
} from "@/features/recommendations/repositories/recommendations.repository";
import {
  isActive,
  relatedNames,
} from "@/features/recommendations/repositories/reco-item-mappers";
import { addWishlistItem } from "@/features/shopping/services/shopping.service";
import type { SaveWishlistInput, WishlistItem } from "@/features/shopping/types";
import { toError } from "@/shared/utils/data-result";

type Result<T> = { data: T | null; error: Error | null };

function itemClusterKey(row: RecoItemRow): string | null {
  const bucket = categoryBucketFor(row.category?.name ?? null);
  const family = colorFamilyFor(row.primary_color?.name ?? null);
  if (!bucket || !family) return null;
  const formality = row.formality ?? "unspecified";
  return clusterCategoryKey(bucket, family, formality);
}

function matchesCategoryKey(row: RecoItemRow, categoryKey: string): boolean {
  const key = toCategoryKey(categoryKey);
  const cluster = itemClusterKey(row);
  if (cluster === key) return true;
  const cat = toCategoryKey(row.category?.name ?? "");
  if (cat && cat === key) return true;
  // Loose: category key contained in cluster or vice versa (partial deep-links).
  if (cluster && (cluster.includes(key) || key.includes(cluster))) return true;
  return false;
}

/** Draft payload only — does not persist. */
export function proposeWishlistFromOpportunity(
  opportunity: ReplacementOpportunity,
): SaveWishlistInput {
  return {
    item: {
      name: opportunity.prospective.name,
      category: opportunity.prospective.category,
      color: opportunity.prospective.color ?? null,
      styleTags: opportunity.prospective.styleTags,
      notes: opportunity.prospective.notes ?? null,
    },
    source: "manual",
    notes:
      opportunity.prospective.notes ??
      `From Category Optimization: ${opportunity.rationale}`,
    priority: "medium",
    status: "active",
  };
}

/** Persist only after user confirmation. */
export async function confirmWishlistFromOpportunity(
  opportunity: ReplacementOpportunity,
): Promise<Result<WishlistItem>> {
  return addWishlistItem(proposeWishlistFromOpportunity(opportunity));
}

export async function getCategoryOptimization(input: {
  categoryKey: string;
  focusItemId?: string;
}): Promise<Result<CategoryOptimizationResult>> {
  const categoryKey = toCategoryKey(input.categoryKey);
  if (!categoryKey) {
    return { data: null, error: toError("Category is required.") };
  }

  const [dataResult, healthResult] = await Promise.all([
    selectRecommendationData(),
    fetchWardrobeHealth().catch(() => ({ data: null, error: null })),
  ]);

  if (dataResult.error) return { data: null, error: dataResult.error };
  if (!dataResult.data) {
    return { data: null, error: toError("Wardrobe data unavailable.") };
  }

  const { items, wearLogs, purchases, outfits, outfitItems } = dataResult.data;
  const active = items.filter(isActive);
  const wardrobeSize = active.length;

  const wearCounts = new Map<string, number>();
  for (const wear of wearLogs) {
    if (!wear.item_id) continue;
    wearCounts.set(wear.item_id, (wearCounts.get(wear.item_id) ?? 0) + 1);
  }

  const priceByItem = new Map<string, number>();
  for (const p of purchases) {
    if (p.item_id == null || p.price == null) continue;
    if (!priceByItem.has(p.item_id)) priceByItem.set(p.item_id, p.price);
  }

  const outfitCountByItem = new Map<string, number>();
  for (const link of outfitItems) {
    outfitCountByItem.set(
      link.item_id,
      (outfitCountByItem.get(link.item_id) ?? 0) + 1,
    );
  }
  const totalOutfits = Math.max(1, outfits.length);

  // Recommendation frequency proxy: appearances in saved outfits.
  const recFreq = outfitCountByItem;

  let matched = active.filter((row) => matchesCategoryKey(row, categoryKey));

  // If focus item provided and cluster empty, expand to that item's cluster.
  if (matched.length === 0 && input.focusItemId) {
    const focus = active.find((r) => r.id === input.focusItemId);
    const focusKey = focus ? itemClusterKey(focus) : null;
    if (focusKey) {
      matched = active.filter((row) => itemClusterKey(row) === focusKey);
    } else if (focus) {
      matched = [focus];
    }
  }

  // Fallback: match by inventory category slug alone.
  if (matched.length === 0) {
    matched = active.filter(
      (row) => toCategoryKey(row.category?.name ?? "") === categoryKey,
    );
  }

  const health = healthResult.data?.health ?? null;
  const dup = health?.duplicates.find(
    (d) =>
      clusterCategoryKey(d.bucket, d.colorFamily, d.formality) === categoryKey,
  );
  const categoryScoreSlice =
    dup != null
      ? Math.max(0, 100 - dup.count * 12)
      : health?.overallScore ?? null;

  const gapLabels = (health?.gaps ?? [])
    .filter((g) => g.priority === "high" || g.priority === "medium")
    .map((g) => g.label)
    .slice(0, 3);

  const presentFamilies = new Set(
    matched
      .map((r) => colorFamilyFor(r.primary_color?.name ?? null))
      .filter((f): f is string => Boolean(f)),
  );
  const diversityHints = ["navy", "blue", "grey", "green"].filter(
    (f) => !presentFamilies.has(f),
  );

  const label =
    dup?.label ??
    matched[0]?.category?.name ??
    categoryKey.replace(/-/g, " ");

  const contextItems: CategoryOptimizationItemInput[] = matched.map((row) => {
    const wears = wearCounts.get(row.id) ?? 0;
    const outfitHits = outfitCountByItem.get(row.id) ?? 0;
    return {
      id: row.id,
      name: row.name,
      category: row.category?.name ?? null,
      subcategory: row.subcategory?.name ?? null,
      color: row.primary_color?.name ?? null,
      colorFamily: colorFamilyFor(row.primary_color?.name ?? null),
      formality: row.formality,
      status: row.status,
      usage: row.usage,
      rating: row.rating,
      styles: relatedNames(row.item_styles, "styles"),
      tags: relatedNames(row.item_tags, "tags"),
      protected: relatedNames(row.item_tags, "tags").some(
        (t) => t.toLowerCase() === "protected",
      ),
      wearCount: wears,
      purchasePrice: priceByItem.get(row.id) ?? null,
      recommendationFrequency: recFreq.get(row.id) ?? 0,
      outfitCoverage: outfitHits / totalOutfits,
      visualSimilarityPeers: [],
    };
  });

  const context: CategoryOptimizationContext = {
    categoryKey,
    label,
    items: contextItems,
    wardrobeSize,
    healthScore: categoryScoreSlice,
    roiScore:
      matched.length === 0
        ? null
        : Math.round(
            (matched.filter((r) => (wearCounts.get(r.id) ?? 0) > 0).length /
              matched.length) *
              100,
          ),
    coverageScore:
      matched.length === 0
        ? null
        : Math.round(
            (matched.filter((r) => (outfitCountByItem.get(r.id) ?? 0) > 0)
              .length /
              matched.length) *
              100,
          ),
    gapLabels,
    missingStyleHints: diversityHints.slice(0, 3),
  };

  const data = buildCategoryOptimization(context, {
    generatedAt: new Date().toISOString(),
    focusItemId: input.focusItemId,
  });

  return { data, error: null };
}
