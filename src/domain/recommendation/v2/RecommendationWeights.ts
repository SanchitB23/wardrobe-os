/**
 * Recommendation Engine v2 (RFC-012) — tunable constants.
 *
 * The single source of truth for the scoring weights, penalty magnitudes,
 * diversity thresholds, and hard-constraint cut-offs. Calibrated with tests,
 * exactly like the Health / Outfit / Personalization engines. Pure data — no
 * logic, no I/O.
 */

import type { ScoreDimensionId } from "@/domain/recommendation/v2/types";

export const RECOMMENDATION_V2_ENGINE_VERSION = "2.0.0";

/**
 * Per-dimension weights for the weighted base score. **Must sum to 1** so the
 * weighted average of the 0–10 dimensions stays on the 0–10 scale. The base
 * `outfitAnalysis` dominates (as in v1) but no longer monopolises: weather and
 * personalization now carry real, first-class weight.
 */
export const DIMENSION_WEIGHTS: Record<ScoreDimensionId, number> = {
  outfitAnalysis: 0.34,
  weatherSuitability: 0.16,
  occasionSuitability: 0.12,
  personalPreferenceFit: 0.12,
  formalityAlignment: 0.08,
  colorHarmony: 0.06,
  textureCompatibility: 0.04,
  comfortCommuteFit: 0.04,
  wardrobeHealthContribution: 0.04,
};

/** Additive adjustments (on the 0–10 scale) applied on top of the weighted base. */
export const ADJUSTMENTS = {
  /** Saved outfit the owner favourited. */
  favoriteBoost: 0.6,
  /** An item worn within RECENT_WEAR_DAYS. */
  recentWearPenalty: 1.5,
  /** An item worn within SOFT_RECENT_DAYS (softer). */
  softRecentWearPenalty: 0.6,
  /** Per over-rotated item (worn far above the wardrobe average), capped. */
  overRotationPenaltyEach: 0.5,
  overRotationPenaltyCap: 1.5,
} as const;

/** Recency windows (days) — read against `context.generatedAt`. */
export const RECENT_WEAR_DAYS = 7;
export const SOFT_RECENT_DAYS = 21;

/** An item is "over-rotated" when its wear count exceeds the active-item mean by
 *  this multiple. */
export const OVER_ROTATION_MULTIPLE = 2;

// ---------------------------------------------------------------------------
// Reason-code thresholds (0–10 dimension raws) — surface a code when a
// dimension is notably strong/weak. These do NOT change the score; they only
// label it (the dimension is already in the weighted base).
// ---------------------------------------------------------------------------

export const REASON_THRESHOLDS = {
  weatherAppropriate: 7,
  weatherMismatch: 3.5,
  occasionIdeal: 7,
  preferenceMatch: 6.5,
  formalityDrift: 3.5,
  weakColorHarmony: 3.5,
  improvesRotation: 7,
} as const;

// ---------------------------------------------------------------------------
// Hard-constraint cut-offs
// ---------------------------------------------------------------------------

export const CONSTRAINTS = {
  /** Required core slots every recommendation must fill. */
  requiredSlots: ["top", "bottom", "footwear"] as const,
  /** Formality spread (0–4 ranks) at/above which a combination is invalid. */
  invalidFormalitySpread: 3,
  /** StyleDNA occasion suitability below this reads as a severe occasion mismatch. */
  occasionFloor: 1,
  /** Mean StyleDNA season suitability at/below this is a severe weather mismatch. */
  severeWeatherFloor: 1.5,
  /**
   * Weather is only confident enough to *reject* an outfit at/above this
   * snapshot confidence. Below it (e.g. a seasonal_fallback snapshot, 0.3),
   * severe weather is a scoring penalty, never a rejection — so the engine
   * degrades gracefully rather than returning nothing.
   */
  weatherRejectMinConfidence: 0.4,
  /** feels-like °C at/below which bare (no-outerwear) outfits are severely cold. */
  severeColdC: 5,
  /** feels-like °C at/above which heavy-fabric outfits are severely hot. */
  severeHotC: 34,
} as const;

// ---------------------------------------------------------------------------
// Diversity
// ---------------------------------------------------------------------------

export const DIVERSITY = {
  /**
   * Two recommendations are compared across 3 axes (skeleton, palette,
   * footwear). This is the minimum number of axes that must DIFFER for a
   * candidate to be admitted alongside an already-admitted one. Relaxed step by
   * step (2 → 1 → 0) if the list would otherwise fall short of the limit.
   */
  minDistinctAxes: 2,
} as const;

/** Default number of recommendations returned. */
export const DEFAULT_LIMIT = 5;
/** How many candidates to pull from each source before merging. */
export const PER_SOURCE_LIMIT = 12;

export type RecommendationWeights = typeof DIMENSION_WEIGHTS;
