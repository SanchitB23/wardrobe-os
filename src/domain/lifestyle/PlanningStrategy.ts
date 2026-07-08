/**
 * Planning strategies (RFC-006) — a higher-level dial that tunes the whole plan:
 * capsule minimality, packing generosity, re-wear tolerance, and formality bias.
 * Distinct from TravelStyle. Default is `balanced`. Pure data + a lookup.
 */

import type { PlanningStrategy } from "@/domain/lifestyle/types";

export interface StrategyProfile {
  /** Extra items packed beyond the minimal capsule (generosity). */
  packingSlack: number;
  /** 0–1 penalty applied to re-wearing an item within the laundry cycle
   *  (higher → more variety, less reuse). */
  reusePenalty: number;
  /** Rough clean outfits worn per day (drives laundry clean-day math). */
  itemsPerDay: number;
  /** Bias toward more formal picks (business skews up). */
  formalityBias: number;
  label: string;
}

export const DEFAULT_STRATEGY: PlanningStrategy = "balanced";

export const STRATEGY_PROFILES: Record<PlanningStrategy, StrategyProfile> = {
  minimal: {
    packingSlack: 0,
    reusePenalty: 0.1, // reuse freely — smallest bag
    itemsPerDay: 1,
    formalityBias: 0,
    label: "Minimal",
  },
  balanced: {
    packingSlack: 1,
    reusePenalty: 0.4,
    itemsPerDay: 1,
    formalityBias: 0,
    label: "Balanced",
  },
  luxury: {
    packingSlack: 3,
    reusePenalty: 0.8, // maximise variety
    itemsPerDay: 1.5,
    formalityBias: 0.5,
    label: "Luxury",
  },
  business: {
    packingSlack: 2,
    reusePenalty: 0.5,
    itemsPerDay: 1.25,
    formalityBias: 1, // lean formal
    label: "Business",
  },
};

export function strategyProfile(strategy: PlanningStrategy): StrategyProfile {
  return STRATEGY_PROFILES[strategy] ?? STRATEGY_PROFILES[DEFAULT_STRATEGY];
}
