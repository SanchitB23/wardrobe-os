/**
 * Shopping Intelligence domain types (RFC-018) — pure. Shopping is a continuous
 * system layered over the Acquisition engine (RFC-001): **Acquisition decides**
 * each item, Shopping Intelligence **ranks + aggregates**, AI explains. Nothing
 * here re-scores a buy/skip verdict — every verdict is a `BuyVsSkipAnalysis`.
 * No React, no Supabase, no I/O.
 */

import type {
  BuyVsSkipAnalysis,
  BuyVsSkipInputSource,
  ProspectiveItem,
} from "@/domain/acquisition";

export type WishlistStatus = "active" | "purchased" | "dismissed";

/** User-set wishlist priority (product UX — not PriorityEngine scores). */
export type WishlistPriority = "low" | "medium" | "high";

/** The persistable core of a wishlist entry (the feature adds id/timestamps). */
export interface WishlistSpec {
  item: ProspectiveItem;
  source: BuyVsSkipInputSource;
  sourceUrl: string | null;
  imageUrl: string | null;
  notes: string | null;
  status: WishlistStatus;
  /** User-authored priority for the Acquisitions hub (not engine ranking). */
  priority: WishlistPriority;
  purchasedId: string | null;
}

/** Minimal identity + captured item that the pure engine ranks. */
export interface WishlistEntry {
  id: string;
  item: ProspectiveItem;
}

/** Weights for the priority combination (need + impact + buy). */
export interface PriorityWeights {
  need: number;
  impact: number;
  buy: number;
}

/** All 0–100. Buy + Impact come straight from Acquisition; Need from gaps. */
export interface ShoppingScores {
  need: number;
  impact: number; // = BuyVsSkipAnalysis.wardrobeImpactScore
  buy: number; // = BuyVsSkipAnalysis.score
  priority: number;
  reasonCodes: string[];
}

/** One ranked wishlist entry = identity + its acquisition verdict + scores. */
export interface ShoppingRecommendation {
  id: string;
  item: ProspectiveItem;
  analysis: BuyVsSkipAnalysis; // the DECISION lives here (RFC-001)
  scores: ShoppingScores;
}

export type ShoppingPriority = ShoppingRecommendation[];

/** A realized/owned purchase, normalized for ROI. */
export interface PurchaseRecord {
  itemId: string;
  name: string;
  category: string | null;
  price: number | null;
  wears: number;
  purchaseDate: string | null;
}

export interface ShoppingROI {
  realized: {
    itemId: string;
    name: string;
    price: number | null;
    wears: number;
    costPerWear: number | null;
  }[];
  projected: {
    id: string;
    name: string;
    estimatedCostPerWear: number | null;
  }[];
  totalSpend: number;
  averageCostPerWear: number | null;
  /** 0–100 "are you buying well?" signal — utilization of what you've bought. */
  wardrobeRoiScore: number;
}

export interface DuplicateMember {
  kind: "wardrobe" | "wishlist";
  id: string;
  name: string;
}

export interface DuplicateCluster {
  reason: string;
  members: DuplicateMember[];
  /** 0–1 max pairwise overlap in the cluster. */
  overlap: number;
}

export interface DuplicateAnalysis {
  clusters: DuplicateCluster[];
  /** Distinct wishlist entries involved in any cluster. */
  wishlistDuplicateCount: number;
}

export interface ShoppingTimelineEntry {
  date: string;
  kind: "purchased" | "planned";
  name: string;
}

export interface ShoppingStrategyStep {
  rank: number;
  name: string;
  /** e.g. "buy", "consider", "skip" — mirrors the acquisition decision. */
  action: string;
  reason: string;
}

export interface WishlistInsights {
  summary: string;
  topReasons: string[];
}

export interface ShoppingDashboard {
  priority: ShoppingPriority;
  roi: ShoppingROI;
  duplicates: DuplicateAnalysis;
  timeline: ShoppingTimelineEntry[];
  strategy: ShoppingStrategyStep[];
  insights: WishlistInsights;
  metadata: {
    engineVersion: string;
    generatedAt: string;
    wishlistCount: number;
  };
}
