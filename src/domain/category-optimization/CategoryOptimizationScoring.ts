/**
 * Category Optimization (RFC-015A) — scoring helpers (pure).
 */

import { calculateCostPerWear } from "@/domain/wardrobe";
import {
  CATEGORY_SCORE_WEIGHTS,
  HIGH_VALUE_COMPOSITE,
  IDEAL_CLUSTER_MAX,
  IDEAL_CLUSTER_MIN,
  IDEAL_WARDROBE_SIZE_BOOST_AT,
  ITEM_VALUE_WEIGHTS,
  LOW_VALUE_COMPOSITE,
  OVER_WORN_WEAR_THRESHOLD,
} from "@/domain/category-optimization/CategoryOptimizationConstants";
import type { CategoryOptimizationItemInput } from "@/domain/category-optimization/types";

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function clampScore100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Slugify a category label / structured key for deep links. */
export function toCategoryKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[|_]+/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * Build a stable cluster key from health duplicate fields.
 * Example: tops + white + casual → `tops-white-casual`
 */
export function clusterCategoryKey(
  bucket: string,
  colorFamily: string,
  formality: string,
): string {
  return toCategoryKey(
    `${bucket}-${colorFamily}-${formality.replace(/_/g, " ")}`,
  );
}

/**
 * Ideal peer count for a color/formality cluster.
 * Conservative 2–4; large wardrobes bump the floor by 1.
 */
export function computeIdealCount(
  currentCount: number,
  wardrobeSize: number,
): number {
  if (currentCount <= 0) return IDEAL_CLUSTER_MIN;
  const boost = wardrobeSize >= IDEAL_WARDROBE_SIZE_BOOST_AT ? 1 : 0;
  const target = IDEAL_CLUSTER_MIN + boost;
  // Never recommend growing past current when already dense — ideal ≤ current
  // except when under-dense (current < min), then ideal = min.
  if (currentCount < IDEAL_CLUSTER_MIN) {
    return Math.min(IDEAL_CLUSTER_MAX, IDEAL_CLUSTER_MIN + boost);
  }
  return Math.min(IDEAL_CLUSTER_MAX, Math.max(target, Math.min(currentCount, target)));
}

/** Density score 0–100: 100 when current ≈ ideal; lower when over/under. */
export function densityScore(currentCount: number, idealCount: number): number {
  if (idealCount <= 0) return currentCount === 0 ? 100 : 40;
  const ratio = currentCount / idealCount;
  if (ratio <= 1) {
    // under-dense: linear up to ideal
    return clampScore100(ratio * 100);
  }
  // over-dense: penalize excess
  const excess = currentCount - idealCount;
  return clampScore100(100 - excess * 18);
}

export function usageBalanceScore(
  distribution: { bucket: string; count: number }[],
): number {
  const total = distribution.reduce((s, d) => s + d.count, 0);
  if (total === 0) return 40;
  const never = distribution.find((d) => d.bucket === "never")?.count ?? 0;
  const rare = distribution.find((d) => d.bucket === "rare")?.count ?? 0;
  const heavy = distribution.find((d) => d.bucket === "heavy")?.count ?? 0;
  const neverShare = never / total;
  const rareShare = rare / total;
  const heavyShare = heavy / total;
  return clampScore100(
    100 - neverShare * 50 - rareShare * 25 - heavyShare * 20,
  );
}

export function computeCategoryScore(input: {
  currentCount: number;
  idealCount: number;
  healthScore: number | null;
  roiScore: number | null;
  coverageScore: number | null;
  usageDistribution: { bucket: string; count: number }[];
}): number {
  const dens = densityScore(input.currentCount, input.idealCount);
  const usage = usageBalanceScore(input.usageDistribution);

  const parts: { weight: number; score: number }[] = [
    { weight: CATEGORY_SCORE_WEIGHTS.density, score: dens },
    { weight: CATEGORY_SCORE_WEIGHTS.usageBalance, score: usage },
  ];
  if (input.healthScore != null) {
    parts.push({
      weight: CATEGORY_SCORE_WEIGHTS.health,
      score: clampScore100(input.healthScore),
    });
  }
  if (input.roiScore != null) {
    parts.push({
      weight: CATEGORY_SCORE_WEIGHTS.roi,
      score: clampScore100(input.roiScore),
    });
  }
  if (input.coverageScore != null) {
    parts.push({
      weight: CATEGORY_SCORE_WEIGHTS.coverage,
      score: clampScore100(input.coverageScore),
    });
  }

  const weightSum = parts.reduce((s, p) => s + p.weight, 0);
  if (weightSum <= 0) return dens;
  const weighted =
    parts.reduce((s, p) => s + p.score * p.weight, 0) / weightSum;
  return clampScore100(weighted);
}

function presentSignalScore(
  value: number | null | undefined,
  map: (n: number) => number,
): { score: number; present: boolean } {
  if (value == null || !Number.isFinite(value)) {
    return { score: 0, present: false };
  }
  return { score: clamp01(map(value)), present: true };
}

/**
 * Composite keep-value 0–1. Missing signals are skipped and weights
 * renormalized — never invented.
 */
export function computeItemCompositeValue(input: {
  wearCount: number;
  costPerWear: number | null;
  roi: number | null;
  outfitCoverage: number | null;
  recommendationFrequency: number | null;
  styleDnaSummary: readonly string[];
  maxWearsInCategory: number;
  maxRecFrequency: number;
}): number {
  const signals: { weight: number; score: number }[] = [];

  const wear = presentSignalScore(input.wearCount, (n) =>
    input.maxWearsInCategory <= 0 ? 0 : n / input.maxWearsInCategory,
  );
  if (wear.present || input.wearCount === 0) {
    signals.push({
      weight: ITEM_VALUE_WEIGHTS.wears,
      score: wear.score,
    });
  }

  // Lower CPW is better — invert against a soft $50 reference.
  if (input.costPerWear != null && input.costPerWear > 0) {
    signals.push({
      weight: ITEM_VALUE_WEIGHTS.costPerWear,
      score: clamp01(1 - input.costPerWear / 50),
    });
  }

  if (input.roi != null) {
    signals.push({
      weight: ITEM_VALUE_WEIGHTS.roi,
      score: clamp01(input.roi / 100),
    });
  }

  if (input.outfitCoverage != null) {
    signals.push({
      weight: ITEM_VALUE_WEIGHTS.outfitCoverage,
      score: clamp01(input.outfitCoverage),
    });
  }

  if (
    input.recommendationFrequency != null &&
    input.maxRecFrequency > 0
  ) {
    signals.push({
      weight: ITEM_VALUE_WEIGHTS.recommendationFrequency,
      score: clamp01(input.recommendationFrequency / input.maxRecFrequency),
    });
  }

  const styleRichness = clamp01(input.styleDnaSummary.length / 6);
  signals.push({
    weight: ITEM_VALUE_WEIGHTS.styleRichness,
    score: styleRichness,
  });

  const weightSum = signals.reduce((s, x) => s + x.weight, 0);
  if (weightSum <= 0) return 0;
  return (
    Math.round(
      (signals.reduce((s, x) => s + x.score * x.weight, 0) / weightSum) * 1000,
    ) / 1000
  );
}

export function itemCostPerWear(
  price: number | null | undefined,
  wearCount: number,
): number | null {
  return calculateCostPerWear(price, wearCount);
}

/** Simple ROI proxy: wears relative to a target of 10, scaled 0–100. */
export function itemRoiScore(
  wearCount: number,
  price: number | null | undefined,
): number | null {
  if (price == null && wearCount === 0) return null;
  const wearComponent = clamp01(wearCount / 10) * 100;
  if (price == null) return clampScore100(wearComponent);
  const cpw = calculateCostPerWear(price, Math.max(wearCount, 1));
  if (cpw == null) return clampScore100(wearComponent);
  const moneyComponent = clamp01(1 - cpw / 50) * 100;
  return clampScore100(0.6 * wearComponent + 0.4 * moneyComponent);
}

export function isHighValue(composite: number): boolean {
  return composite >= HIGH_VALUE_COMPOSITE;
}

export function isLowValue(composite: number): boolean {
  return composite < LOW_VALUE_COMPOSITE;
}

export function isOverWorn(wearCount: number, composite: number): boolean {
  return wearCount >= OVER_WORN_WEAR_THRESHOLD && isHighValue(composite);
}

export function buildStyleDnaSummary(
  item: CategoryOptimizationItemInput,
): string[] {
  const parts: string[] = [];
  if (item.category) parts.push(item.category);
  if (item.color) parts.push(item.color);
  if (item.formality) parts.push(item.formality.replace(/_/g, " "));
  for (const s of item.styles ?? []) {
    if (s.trim()) parts.push(s.trim());
  }
  for (const t of item.tags ?? []) {
    if (t.trim()) parts.push(t.trim());
  }
  // Stable unique
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function usageBucketFor(wearCount: number, usage?: string | null): string {
  if (wearCount <= 0) return "never";
  if (usage === "rare" || wearCount <= 2) return "rare";
  if (usage === "heavy" || wearCount >= OVER_WORN_WEAR_THRESHOLD) return "heavy";
  return "regular";
}
