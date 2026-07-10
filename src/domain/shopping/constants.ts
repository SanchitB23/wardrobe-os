/**
 * Shopping Intelligence constants (RFC-018). Tunable, deterministic knobs for
 * ranking, need scoring, and duplicate detection.
 */

import type { PriorityWeights } from "@/domain/shopping/types";

export const SHOPPING_ENGINE_VERSION = "1.0.0";

/** Priority = weighted blend of Need, Impact, Buy. Sums to 1. */
export const DEFAULT_PRIORITY_WEIGHTS: PriorityWeights = {
  need: 0.4,
  impact: 0.35,
  buy: 0.25,
};

/** Need score (0–100) when the item fills a wardrobe gap of the given priority. */
export const NEED_BY_GAP_PRIORITY: Record<"high" | "medium" | "low", number> = {
  high: 100,
  medium: 65,
  low: 40,
};

/** Need score when the item matches no gap (the category may be well covered). */
export const NEED_BASELINE = 20;

/** Need score when wardrobe health is unavailable (neutral). */
export const NEED_NEUTRAL = 50;

/** Item-vs-item overlap (0–1) at/above which two pieces count as duplicates. */
export const DUPLICATE_OVERLAP_THRESHOLD = 0.6;

/** How many top queue items become explicit strategy steps. */
export const STRATEGY_TOP_N = 5;
