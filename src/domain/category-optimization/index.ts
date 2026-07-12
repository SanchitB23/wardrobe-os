/**
 * Category Optimization domain (RFC-015A) — pure planning over wardrobe signals.
 * Engines decide signals; this domain plans; AI explains (ADR-005).
 */

export { buildCategoryOptimization } from "@/domain/category-optimization/CategoryOptimizationEngine";
export { analyzeCategory } from "@/domain/category-optimization/CategoryAnalysis";
export { compareCategoryItems } from "@/domain/category-optimization/ItemComparison";
export { buildOptimizationPlan } from "@/domain/category-optimization/OptimizationPlan";
export { deriveReplacementOpportunities } from "@/domain/category-optimization/ReplacementOpportunity";
export {
  CATEGORY_OPTIMIZATION_VERSION,
  IDEAL_CLUSTER_MIN,
  IDEAL_CLUSTER_MAX,
  DEFAULT_REPLACEMENT_TEMPLATES,
} from "@/domain/category-optimization/CategoryOptimizationConstants";
export {
  toCategoryKey,
  clusterCategoryKey,
  computeIdealCount,
  computeCategoryScore,
  computeItemCompositeValue,
  densityScore,
} from "@/domain/category-optimization/CategoryOptimizationScoring";
export type {
  OptimizationDecision,
  CategoryOptimizationAction,
  CategoryOptimizationReasonCode,
  CategoryAnalysis,
  ItemComparison,
  OptimizationPlan,
  OptimizationPlanItem,
  ReplacementOpportunity,
  ReplacementProspective,
  CategoryOptimizationResult,
  CategoryOptimizationContext,
  CategoryOptimizationItemInput,
  CategoryOptimizationOptions,
  UsageBucket,
  VisualSimilarityPeer,
} from "@/domain/category-optimization/types";
