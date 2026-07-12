/**
 * Category Optimization Engine (RFC-015A).
 *
 * Pure entry: buildCategoryOptimization(context, options).
 * Invents no buy/skip verdicts; never mutates inventory; no I/O / AI.
 */

import { analyzeCategory } from "@/domain/category-optimization/CategoryAnalysis";
import { compareCategoryItems } from "@/domain/category-optimization/ItemComparison";
import { buildOptimizationPlan } from "@/domain/category-optimization/OptimizationPlan";
import { deriveReplacementOpportunities } from "@/domain/category-optimization/ReplacementOpportunity";
import type {
  CategoryOptimizationContext,
  CategoryOptimizationOptions,
  CategoryOptimizationResult,
} from "@/domain/category-optimization/types";

const DEFAULT_GENERATED_AT = "1970-01-01T00:00:00.000Z";

export function buildCategoryOptimization(
  context: CategoryOptimizationContext,
  options: CategoryOptimizationOptions = {},
): CategoryOptimizationResult {
  const generatedAt = options.generatedAt ?? DEFAULT_GENERATED_AT;
  const focusItemId = options.focusItemId;

  const analysis = analyzeCategory(context);
  const comparisons = compareCategoryItems(context);

  // Provisional summary for opportunity derivation (retire estimate).
  const excess = Math.max(0, analysis.currentCount - analysis.idealCount);
  const provisionalRetire = Math.floor(excess / 2);

  const replacementOpportunities = deriveReplacementOpportunities({
    context,
    analysis,
    summary: {
      retire: provisionalRetire,
      rotate: Math.max(0, excess - provisionalRetire),
      keep: analysis.idealCount,
    },
  });

  const plan = buildOptimizationPlan({
    analysis,
    comparisons,
    replacementOpportunities,
    generatedAt,
    focusItemId,
  });

  return { analysis, comparisons, plan };
}
