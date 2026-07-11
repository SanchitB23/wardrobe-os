/**
 * Acquisitions Intelligence (RFC-018B) — tunable deterministic knobs.
 */

import type { PurchaseLifecycleState } from "@/domain/shopping/v2/types";

export const ACQUISITIONS_INTELLIGENCE_VERSION = "1.0.0";

/** Opportunity = weighted blend of 018 priority + need + lifecycle urgency. */
export const OPPORTUNITY_WEIGHTS = {
  priority: 0.6,
  need: 0.2,
  lifecycle: 0.2,
} as const;

/** Wears at/above which a purchase is "established". */
export const ESTABLISHED_MIN_WEARS = 5;

/**
 * Bought items with this many wears or fewer and a high cost-per-wear count as
 * low_usage (otherwise they stay at first_wear until established).
 */
export const LOW_USAGE_MAX_WEARS = 2;

/** CPW at/above this (same currency units as purchase price) is "poor" ROI. */
export const ACCEPTABLE_MAX_COST_PER_WEAR = 25;

/** Lifecycle urgency (0–100) used by OpportunityEngine — higher = pursue sooner. */
export const LIFECYCLE_URGENCY: Record<PurchaseLifecycleState, number> = {
  wishlist: 75,
  analyzed: 85,
  bought: 25,
  first_wear: 40,
  established: 15,
  low_usage: 10,
  retired: 0,
};

export const LIFECYCLE_STATE_ORDER: PurchaseLifecycleState[] = [
  "wishlist",
  "analyzed",
  "bought",
  "first_wear",
  "established",
  "low_usage",
  "retired",
];

export const LIFECYCLE_STATE_LABELS: Record<PurchaseLifecycleState, string> = {
  wishlist: "Wishlist",
  analyzed: "Analyzed",
  bought: "Bought",
  first_wear: "First Wear",
  established: "Established",
  low_usage: "Low Usage",
  retired: "Retired",
};
