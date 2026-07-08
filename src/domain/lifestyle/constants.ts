/**
 * Tunable constants for the Lifestyle Engine (RFC-006). Calibrated with tests,
 * not buried in logic. No AI, no I/O.
 */

export const LIFESTYLE_ENGINE_VERSION = "1.0.0";

/**
 * planScore (0–100) weights. Each component is 0–1; the weighted sum is scaled
 * to 100, then a penalty per warning is subtracted (floored at 0). Weights sum to 1.
 */
export const PLAN_SCORE_WEIGHTS = {
  occasionCoverage: 0.3, // every day's occasion has an outfit
  weatherCoverage: 0.25, // outfits suit each day's forecast
  packingEfficiency: 0.2, // capsule small relative to days (reuse)
  wardrobeReuse: 0.15, // items pull double-duty across days
  variety: 0.1, // distinct outfits across the trip
} as const;

/** Points subtracted from planScore per warning. */
export const WARNING_PENALTY = 6;

/** Default occasion for a trip day with no explicit event. */
export const DEFAULT_OCCASION = "Casual";
