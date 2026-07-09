/**
 * Recommendation Engine v2 (RFC-012) — domain types.
 *
 * No React, no Supabase, no AI. Pure type definitions for the multi-objective,
 * weather- and personalization-aware, diversity-ranked recommendation pipeline.
 *
 * `RecommendationV2` is a **structural superset** of the v1
 * `UnifiedOutfitRecommendation` (same core fields + the same `debug` shape) so
 * existing consumers (Recommendation Center, AI explanation, Lifestyle,
 * Orchestrator) keep working unchanged. v2 adds the richer `breakdown`,
 * `reasonCodes`, `constraintsPassed`, and `diversity` fields on top.
 */

import type { OutfitAnalysis } from "@/domain/outfit";
import type {
  RecommendedOutfitItem,
} from "@/domain/recommendation/OutfitRecommendationEngine";
import type {
  WardrobeItemSnapshot,
  WeatherSnapshotSource,
} from "@/domain/recommendation/RecommendationContext";

export type RecommendationSource = "saved_outfit" | "generated_combo";

// ---------------------------------------------------------------------------
// Candidate (internal to the pipeline, pre-scoring)
// ---------------------------------------------------------------------------

/** A unified candidate before eligibility + scoring — saved or generated, one
 *  shape. Carries the resolved item snapshots so the scoring stages never
 *  re-look-up the wardrobe. */
export interface OutfitCandidate {
  id: string;
  source: RecommendationSource;
  savedOutfitId?: string;
  name: string;
  items: RecommendedOutfitItem[];
  /** Resolved wardrobe snapshots for `items` (same order where possible). */
  snapshots: WardrobeItemSnapshot[];
  analysis: OutfitAnalysis;
  /** The originating engine's own score/confidence, kept for trace/debug. */
  rawScore: number;
  confidence: number;
  favorite: boolean;
  lastWornOn: string | null;
  strengths: string[];
  tradeoffs: string[];
  suggestions: string[];
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** The scoring dimensions v2 evaluates (each a pure function of candidate +
 *  context). Together they form the weighted base score. */
export type ScoreDimensionId =
  | "outfitAnalysis"
  | "weatherSuitability"
  | "occasionSuitability"
  | "formalityAlignment"
  | "personalPreferenceFit"
  | "colorHarmony"
  | "textureCompatibility"
  | "comfortCommuteFit"
  | "wardrobeHealthContribution";

/** Machine-readable reason codes surfaced on every recommendation. */
export type ReasonCode =
  // boosts / positive signals
  | "matches_preferences"
  | "weather_appropriate"
  | "occasion_ideal"
  | "improves_rotation"
  | "favorite_outfit"
  // penalties / negative signals
  | "recent_wear"
  | "over_rotation"
  | "mild_weather_mismatch"
  | "formality_drift"
  | "weak_color_harmony"
  // informational
  | "passed_all_constraints";

/** One scored dimension: local raw (0–10), its weight, and the weighted term. */
export interface ScoreDimension {
  dimension: ScoreDimensionId;
  /** Dimension-local score, 0–10. */
  raw: number;
  /** Weight from {@link RecommendationWeights}. */
  weight: number;
  /** weight · raw — contribution to the weighted base subtotal. */
  weighted: number;
}

/** A real additive adjustment applied on top of the weighted base. */
export interface ScoreAdjustment {
  code: ReasonCode;
  label: string;
  /** Signed delta on the 0–10 scale (positive = boost, negative = penalty). */
  delta: number;
}

/** Full, inspectable score derivation for one recommendation. */
export interface ScoreBreakdown {
  dimensions: ScoreDimension[];
  boosts: ScoreAdjustment[];
  penalties: ScoreAdjustment[];
  /** Weighted average of the dimensions (0–10) before boosts/penalties. */
  subtotal: number;
  /** Final clamped 0–10 score = subtotal + Σboosts − Σpenalties. */
  total: number;
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

/** The hard constraints an eligible outfit must pass. */
export type HardConstraint =
  | "no_avoided_items"
  | "no_retired_items"
  | "weather_compatible"
  | "occasion_compatible"
  | "required_slots_present"
  | "valid_category_combination";

export interface EligibilityVerdict {
  eligible: boolean;
  passed: HardConstraint[];
  failed: HardConstraint[];
  reasons: string[];
  /** Names of the items that made the outfit ineligible (for debug/explain). */
  disallowedItems: string[];
}

export interface RejectedCandidate {
  id: string;
  name: string;
  source: RecommendationSource;
  failed: HardConstraint[];
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Diversity
// ---------------------------------------------------------------------------

export interface DiversityDecision {
  /** 1-based position in the returned list. */
  rank: number;
  /** Ids of already-admitted recommendations this one is distinct from. */
  distinctFrom: string[];
  /** How many near-duplicate candidates were held back behind this one. */
  heldBackNearDuplicates: number;
  /** True when the diversity threshold had to be relaxed to fill the list. */
  relaxed: boolean;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * A single ranked recommendation. Structural **superset** of the v1
 * `UnifiedOutfitRecommendation` — every v1 field is present with a compatible
 * type, so v2 results are assignable wherever a v1 recommendation is expected.
 */
export interface RecommendationV2 {
  id: string;
  source: RecommendationSource;
  savedOutfitId?: string;
  name: string;
  items: RecommendedOutfitItem[];
  /** Final 0–10 score. */
  score: number;
  /** 0–1 confidence. */
  confidence: number;
  analysis: OutfitAnalysis;
  reason: string;
  strengths: string[];
  tradeoffs: string[];
  suggestions: string[];
  // --- v2 additions -------------------------------------------------------
  reasonCodes: ReasonCode[];
  breakdown: ScoreBreakdown;
  constraintsPassed: HardConstraint[];
  diversity: DiversityDecision;
  // --- v1-compatible debug block (kept so existing UI keeps working) ------
  debug?: {
    savedOutfitScore?: number;
    generatedScore?: number;
    sourceRank: number;
    rejectionReasons?: string[];
    penalties?: string[];
    boosts?: string[];
  };
  metadata: {
    generatedAt: string;
    engineVersion: string;
  };
}

/** Per-run quality metrics for the developer surface + tests. */
export interface RecommendationQuality {
  eligibleCandidateCount: number;
  rejectedCandidateCount: number;
  rejections: RejectedCandidate[];
  /** 0–1 — how different the returned top-K are from one another. */
  diversityScore: number;
  /** 0–1 — mean confidence across the returned recommendations. */
  averageConfidence: number;
  sourceMix: { saved: number; generated: number };
  /** 0–1 — how much weather scoring moved the returned ordering. */
  weatherInfluence: number;
  /** 0–1 — how much personalization scoring moved the returned ordering. */
  personalizationInfluence: number;
}

/** THE standardized output. Recommendation Center + AI + Orchestrator read this. */
export interface RecommendationResult {
  recommendations: RecommendationV2[];
  quality: RecommendationQuality;
  metadata: {
    engineVersion: string;
    generatedAt: string;
    weatherSource: WeatherSnapshotSource;
    personalizationApplied: boolean;
  };
}

export interface RecommendationV2Options {
  occasion?: string | null;
  /** Max recommendations to return (default 5). */
  limit?: number;
  /** Restrict candidates to saved outfits only. */
  favoritesOnly?: boolean;
  /**
   * Whether the `context.preferences` reflect a learned profile (RFC-004). When
   * false the personalization dimension still runs but is reported as not
   * applied in metadata. Defaults to true.
   */
  personalizationApplied?: boolean;
}
