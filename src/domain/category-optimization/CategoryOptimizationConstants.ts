/**
 * Category Optimization (RFC-015A) — tunable constants.
 * Calibrated with golden tests; change only with test updates.
 */

export const CATEGORY_OPTIMIZATION_VERSION = "1.0.0";

/** Minimum ideal peer count in a color/formality cluster. */
export const IDEAL_CLUSTER_MIN = 2;

/** Maximum ideal peer count in a color/formality cluster. */
export const IDEAL_CLUSTER_MAX = 4;

/** Large wardrobes can sustain one more peer in a cluster. */
export const IDEAL_WARDROBE_SIZE_BOOST_AT = 80;

/** Wear count at/above which a high-value item is "over-worn" → Protect. */
export const OVER_WORN_WEAR_THRESHOLD = 8;

/** Composite value floor for "high value" (0–1 scale). */
export const HIGH_VALUE_COMPOSITE = 0.55;

/** Composite value ceiling for "low value". */
export const LOW_VALUE_COMPOSITE = 0.35;

/** Max replacement opportunities surfaced per plan. */
export const MAX_REPLACEMENT_OPPORTUNITIES = 3;

/** Category score weights (must sum to 1). */
export const CATEGORY_SCORE_WEIGHTS = {
  density: 0.35,
  health: 0.2,
  roi: 0.2,
  coverage: 0.15,
  usageBalance: 0.1,
} as const;

/** Item composite-value weights (renormalized over present signals). */
export const ITEM_VALUE_WEIGHTS = {
  wears: 0.25,
  costPerWear: 0.2,
  roi: 0.2,
  outfitCoverage: 0.15,
  recommendationFrequency: 0.1,
  styleRichness: 0.1,
} as const;

/** Estimated health points gained per retired low-value duplicate. */
export const HEALTH_IMPROVEMENT_PER_RETIRE = 4;

/** Estimated ROI points gained per rotated under-used item. */
export const ROI_IMPROVEMENT_PER_ROTATE = 3;

/** Deterministic staple-style replacements when gaps are empty. */
export const DEFAULT_REPLACEMENT_TEMPLATES: ReadonlyArray<{
  name: string;
  styleHints: string[];
  color: string;
}> = [
  {
    name: "Medium Blue Oxford",
    styleHints: ["oxford", "smart casual", "blue"],
    color: "medium blue",
  },
  {
    name: "Grey Knit Polo",
    styleHints: ["polo", "knit", "grey"],
    color: "grey",
  },
  {
    name: "Navy Knit Polo",
    styleHints: ["polo", "knit", "navy"],
    color: "navy",
  },
];
