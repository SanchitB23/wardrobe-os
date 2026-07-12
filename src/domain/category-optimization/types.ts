/**
 * Category Optimization (RFC-015A) — pure type contracts.
 * Engines supply signals; this domain plans; AI never decides (ADR-005).
 */

export type OptimizationDecision =
  | "keep"
  | "protect"
  | "rotate"
  | "retire"
  | "ignore";

export type CategoryOptimizationAction =
  | OptimizationDecision
  | "move_to_wishlist"
  | "analyze_replacement";

export type CategoryOptimizationReasonCode =
  | "over_dense"
  | "under_dense"
  | "balanced"
  | "sparse_usage"
  | "duplicate_cluster"
  | "high_value"
  | "low_value"
  | "over_worn"
  | "under_worn"
  | "never_worn"
  | "protected_item"
  | "focus_item"
  | "diversity_gap"
  | "cold_data";

export interface UsageBucket {
  bucket: string;
  count: number;
}

export interface CategoryAnalysis {
  categoryKey: string;
  label: string;
  currentCount: number;
  idealCount: number;
  usageDistribution: UsageBucket[];
  healthScore: number | null;
  roiScore: number | null;
  coverageScore: number | null;
  /** 0–100 composite. */
  categoryScore: number;
  reasonCodes: CategoryOptimizationReasonCode[];
  /** 0–1 */
  confidence: number;
}

export interface VisualSimilarityPeer {
  itemId: string;
  score: number;
}

export interface ItemComparison {
  itemId: string;
  label: string;
  wearCount: number;
  costPerWear: number | null;
  roi: number | null;
  /** 0–1 share of outfits that include this item, or null if unknown. */
  outfitCoverage: number | null;
  recommendationFrequency: number | null;
  styleDnaSummary: string[];
  visualSimilarityPeers: VisualSimilarityPeer[];
  /** Ranking key for the plan — higher is more valuable to keep. */
  compositeValue: number;
  protected?: boolean;
  overWorn?: boolean;
}

export interface OptimizationPlanItem {
  itemId: string;
  label: string;
  decision: OptimizationDecision;
  reason: string;
  reasonCodes: CategoryOptimizationReasonCode[];
}

export interface ReplacementProspective {
  name: string;
  category: string;
  color?: string | null;
  styleTags?: string[];
  notes?: string | null;
}

export interface ReplacementOpportunity {
  id: string;
  name: string;
  category: string;
  styleHints: string[];
  rationale: string;
  reasonCodes: CategoryOptimizationReasonCode[];
  prospective: ReplacementProspective;
}

export interface OptimizationPlanSummary {
  keep: number;
  protect: number;
  rotate: number;
  retire: number;
  ignore: number;
}

export interface OptimizationPlan {
  categoryKey: string;
  summary: OptimizationPlanSummary;
  items: OptimizationPlanItem[];
  replacementOpportunities: ReplacementOpportunity[];
  estimatedHealthImprovement: number | null;
  estimatedRoiImprovement: number | null;
  generatedAt: string;
}

export interface CategoryOptimizationResult {
  analysis: CategoryAnalysis;
  comparisons: ItemComparison[];
  plan: OptimizationPlan;
}

/** One inventory item with optional signal attachments — all nullable-safe. */
export interface CategoryOptimizationItemInput {
  id: string;
  name: string;
  category: string | null;
  subcategory?: string | null;
  color?: string | null;
  colorFamily?: string | null;
  formality?: string | null;
  status?: string | null;
  usage?: string | null;
  rating?: number | null;
  styles?: readonly string[];
  tags?: readonly string[];
  /** True when the item should be left out of retire/rotate pressure. */
  protected?: boolean;
  wearCount?: number;
  purchasePrice?: number | null;
  /** How often recommendation v2 surfaces this item (count or rate). */
  recommendationFrequency?: number | null;
  /** 0–1 outfit coverage. */
  outfitCoverage?: number | null;
  /** Precomputed peers; empty/absent when vision attrs missing. */
  visualSimilarityPeers?: VisualSimilarityPeer[];
}

export interface CategoryOptimizationContext {
  categoryKey: string;
  label: string;
  items: CategoryOptimizationItemInput[];
  /** Active wardrobe size (for ideal-count scaling). */
  wardrobeSize: number;
  /** Optional 0–100 health slice for this category/cluster. */
  healthScore?: number | null;
  /** Optional 0–100 ROI slice for the cohort. */
  roiScore?: number | null;
  /** Optional 0–100 coverage slice. */
  coverageScore?: number | null;
  /** Known wardrobe gaps (labels) used for replacement stubs. */
  gapLabels?: readonly string[];
  /** Diversity hints missing from the cluster (colors / styles). */
  missingStyleHints?: readonly string[];
}

export interface CategoryOptimizationOptions {
  generatedAt?: string;
  focusItemId?: string;
}
