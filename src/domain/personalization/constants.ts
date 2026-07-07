/**
 * Tunable constants for the Personalization Engine (RFC-004).
 *
 * Signal weights, recency half-life, and thresholds live here so they can be
 * calibrated with tests rather than buried in logic. No AI, no ML — "learning"
 * is deterministic weighted aggregation with recency decay.
 */

import type { PreferenceSignalType } from "@/domain/personalization/types";

export const PERSONALIZATION_ENGINE_VERSION = "1.0.0";

/**
 * Per-signal-type weights. Positive signals reveal preference; a rejected
 * recommendation is a negative signal (its `polarity` is -1, so it subtracts).
 * Values mirror RFC-004 §9.
 */
export const SIGNAL_WEIGHTS: Record<PreferenceSignalType, number> = {
  wear: 1.0,
  favorite: 0.8,
  outfit_saved: 0.6,
  purchase: 0.5,
  recommendation_accepted: 0.4,
  acquisition_decision: 0.4,
  manual_edit: 0.2,
  recommendation_rejected: 0.5, // magnitude; direction comes from polarity = -1
};

/** Exponential recency decay half-life, in days. Older signals weigh less. */
export const HALF_LIFE_DAYS = 120;

/** Below this total signal count the profile is cold-start (prior dominates). */
export const MIN_EVIDENCE = 5;

/** Smoothing constant for the confidence volume curve (higher = slower to certainty). */
export const CONFIDENCE_VOLUME_K = 3;

/** Number of temporal buckets used to measure stability across the history window. */
export const STABILITY_BUCKETS = 4;

/** Cap on how many preferences to keep per dimension (ranked by weight). */
export const MAX_PER_DIMENSION = 8;

/** Confidence assigned to prior-sourced (cold-start / fallback) preferences. */
export const PRIOR_CONFIDENCE = 0.2;
