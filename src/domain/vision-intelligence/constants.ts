/**
 * Vision Intelligence constants (RFC-019) — thresholds for similarity bands.
 */

export const VISION_INTELLIGENCE_VERSION = "1.0.0";

/** Similarity ≥ this → treat as duplicate warning. */
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.72;

/** Similarity ≥ this (and &lt; duplicate) → possible match. */
export const POSSIBLE_MATCH_SIMILARITY_THRESHOLD = 0.45;

/** Minimum detection confidence to enter the review queue. */
export const MIN_DETECTION_CONFIDENCE = 0.25;

/** Minimum similarity to propose an inventory piece for outfit logging. */
export const OUTFIT_MATCH_SIMILARITY_THRESHOLD = 0.4;
