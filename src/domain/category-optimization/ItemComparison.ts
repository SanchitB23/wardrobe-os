/**
 * Category Optimization (RFC-015A) — Item Comparison (pure).
 */

import {
  buildStyleDnaSummary,
  computeItemCompositeValue,
  isOverWorn,
  itemCostPerWear,
  itemRoiScore,
} from "@/domain/category-optimization/CategoryOptimizationScoring";
import type {
  CategoryOptimizationContext,
  ItemComparison,
} from "@/domain/category-optimization/types";

export function compareCategoryItems(
  context: CategoryOptimizationContext,
): ItemComparison[] {
  const maxWears = context.items.reduce(
    (m, i) => Math.max(m, i.wearCount ?? 0),
    0,
  );
  const maxRec = context.items.reduce(
    (m, i) => Math.max(m, i.recommendationFrequency ?? 0),
    0,
  );

  const rows: ItemComparison[] = context.items.map((item) => {
    const wearCount = item.wearCount ?? 0;
    const costPerWear = itemCostPerWear(item.purchasePrice, wearCount);
    const roi = itemRoiScore(wearCount, item.purchasePrice);
    const styleDnaSummary = buildStyleDnaSummary(item);
    const outfitCoverage =
      item.outfitCoverage == null ? null : item.outfitCoverage;
    const recommendationFrequency =
      item.recommendationFrequency == null
        ? null
        : item.recommendationFrequency;

    const compositeValue = computeItemCompositeValue({
      wearCount,
      costPerWear,
      roi,
      outfitCoverage,
      recommendationFrequency,
      styleDnaSummary,
      maxWearsInCategory: maxWears,
      maxRecFrequency: maxRec,
    });

    return {
      itemId: item.id,
      label: item.name,
      wearCount,
      costPerWear,
      roi,
      outfitCoverage,
      recommendationFrequency,
      styleDnaSummary,
      visualSimilarityPeers: item.visualSimilarityPeers ?? [],
      compositeValue,
      protected: Boolean(item.protected),
      overWorn: isOverWorn(wearCount, compositeValue),
    };
  });

  // Deterministic rank: composite desc, then label, then id.
  rows.sort((a, b) => {
    if (b.compositeValue !== a.compositeValue) {
      return b.compositeValue - a.compositeValue;
    }
    const byLabel = a.label.localeCompare(b.label);
    if (byLabel !== 0) return byLabel;
    return a.itemId.localeCompare(b.itemId);
  });

  return rows;
}
