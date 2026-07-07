/**
 * Tunable constants for the Buy vs Skip engine (RFC-001).
 *
 * Weights, thresholds, and the owner's preference profile live here so they can
 * be calibrated with tests rather than buried in logic. Weights sum to 1.
 */

import type { DimensionKey } from "@/domain/acquisition/types";

export const BUY_VS_SKIP_ENGINE_VERSION = "1.0.0";

/** Per-dimension weights (sum = 1). `duplicateRisk` contributes inversely. */
export const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  gapFillValue: 0.2,
  outfitCompatibility: 0.2,
  usageProjection: 0.15,
  duplicateRisk: 0.15,
  costEfficiency: 0.1,
  wardrobeHealthImpact: 0.08,
  practicality: 0.07,
  preferenceFit: 0.05,
};

/** Dimensions whose HIGH score reduces the buy score. */
export const INVERSE_DIMENSIONS: ReadonlySet<DimensionKey> = new Set(["duplicateRisk"]);

/** Score thresholds (0–100). */
export const DECISION_THRESHOLDS = {
  buy: 70,
  consider: 45,
} as const;

/** Guard thresholds. */
export const GUARDS = {
  /** duplicateRisk (0–10) at/above this caps the decision at "consider". */
  duplicateCap: 8,
  /** overall confidence below this can never return "buy". */
  minBuyConfidence: 0.4,
  /** confidence below this flags SPARSE_INPUT. */
  sparseConfidence: 0.35,
  /** outfit score (0–10) at/above this counts as a high-quality outfit. */
  highQualityOutfit: 7,
  /** overlap (0–1) at/above this makes an existing item "similar". */
  similarOverlap: 0.6,
} as const;

/** Bounds to keep outfit-compatibility scoring tractable + deterministic. */
export const OUTFIT_COMPAT = {
  /** Top-K existing items per complementary slot (by rating, then name). */
  topKPerSlot: 3,
  /** Hard cap on candidate outfits scored with evaluateOutfit. */
  maxCandidates: 12,
  /** Potential outfits returned in the result. */
  maxReturned: 4,
} as const;

/** Cost-per-wear bands (currency-agnostic; compares price ÷ projected wears). */
export const COST_PER_WEAR = {
  /** Projected wears horizon used for the denominator when usage is thin. */
  fallbackProjectedWears: 20,
  /** At/below this cost-per-wear = efficient (score 10). */
  efficient: 50,
  /** At/above this cost-per-wear = inefficient (score 0). */
  inefficient: 500,
} as const;

/**
 * The owner's style direction (RFC-001 §Preference). Used by the preferenceFit
 * dimension. Deterministic — not learned, not AI.
 */
export const PREFERENCE_PROFILE = {
  preferredStyles: ["smart casual", "smartcasual", "minimal", "premium", "modern", "tech"],
  /** Formality levels considered "over-formal" unless explicitly intended. */
  overFormal: ["formal", "business_formal"],
  /** Footwear intent: sneakers preferred over formal shoes in most contexts. */
  preferSneakers: true,
  formalFootwearHints: ["oxford", "derby", "brogue", "loafer", "monk", "dress shoe"],
  sneakerHints: ["sneaker", "trainer", "court", "canvas", "air force", "af1", "574", "runner"],
} as const;

/** Delhi-NCR climate context for the practicality dimension. */
export const CLIMATE = {
  /** Seasons that dominate the year; heavy items score lower on practicality. */
  hotSeasons: ["summer", "monsoon"],
} as const;
