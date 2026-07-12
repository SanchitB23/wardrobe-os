/**
 * Category Optimization (RFC-015A) — Category Analysis (pure).
 */

import {
  computeCategoryScore,
  computeIdealCount,
  usageBucketFor,
} from "@/domain/category-optimization/CategoryOptimizationScoring";
import type {
  CategoryAnalysis,
  CategoryOptimizationContext,
  CategoryOptimizationReasonCode,
  UsageBucket,
} from "@/domain/category-optimization/types";

export function buildUsageDistribution(
  items: CategoryOptimizationContext["items"],
): UsageBucket[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const bucket = usageBucketFor(item.wearCount ?? 0, item.usage);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  }
  const order = ["never", "rare", "regular", "heavy"];
  return order
    .filter((b) => (counts.get(b) ?? 0) > 0)
    .map((bucket) => ({ bucket, count: counts.get(bucket) ?? 0 }));
}

export function analyzeCategory(
  context: CategoryOptimizationContext,
): CategoryAnalysis {
  const currentCount = context.items.length;
  const idealCount = computeIdealCount(currentCount, context.wardrobeSize);
  const usageDistribution = buildUsageDistribution(context.items);

  const healthScore =
    context.healthScore == null ? null : context.healthScore;
  const roiScore = context.roiScore == null ? null : context.roiScore;
  const coverageScore =
    context.coverageScore == null ? null : context.coverageScore;

  const reasonCodes: CategoryOptimizationReasonCode[] = [];
  if (currentCount > idealCount) reasonCodes.push("over_dense");
  else if (currentCount < idealCount) reasonCodes.push("under_dense");
  else reasonCodes.push("balanced");

  const neverCount =
    usageDistribution.find((d) => d.bucket === "never")?.count ?? 0;
  if (neverCount > 0) reasonCodes.push("sparse_usage");

  if (healthScore == null && roiScore == null && coverageScore == null) {
    reasonCodes.push("cold_data");
  }
  if (currentCount >= 3 && currentCount > idealCount) {
    reasonCodes.push("duplicate_cluster");
  }

  const categoryScore = computeCategoryScore({
    currentCount,
    idealCount,
    healthScore,
    roiScore,
    coverageScore,
    usageDistribution,
  });

  // Confidence: denser signal set + more items → higher.
  let confidence = 0.45;
  if (currentCount >= 2) confidence += 0.15;
  if (currentCount >= 4) confidence += 0.1;
  if (healthScore != null) confidence += 0.1;
  if (roiScore != null) confidence += 0.1;
  if (coverageScore != null) confidence += 0.05;
  if (neverCount === currentCount && currentCount > 0) confidence -= 0.15;
  confidence = Math.max(0.2, Math.min(0.95, confidence));

  return {
    categoryKey: context.categoryKey,
    label: context.label,
    currentCount,
    idealCount,
    usageDistribution,
    healthScore,
    roiScore,
    coverageScore,
    categoryScore,
    reasonCodes,
    confidence: Math.round(confidence * 100) / 100,
  };
}
