/**
 * Shopping / Acquisitions feature types. Wishlist is the persisted prospective
 * purchase; decision history snapshots Buy vs Skip analyses; KPIs feed the hub.
 */

import type {
  BuyDecision,
  BuyVsSkipAnalysis,
  BuyVsSkipInputSource,
  ProspectiveItem,
} from "@/domain/acquisition";
import type {
  WishlistPriority,
  WishlistSpec,
  WishlistStatus,
} from "@/domain/shopping";

export interface WishlistItem extends WishlistSpec {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/** Create/update payload — the captured item plus capture metadata. */
export interface SaveWishlistInput {
  id?: string;
  item: ProspectiveItem;
  source?: BuyVsSkipInputSource;
  sourceUrl?: string | null;
  imageUrl?: string | null;
  imageStoragePath?: string | null;
  notes?: string | null;
  priority?: WishlistPriority;
  status?: WishlistStatus;
  purchasePrice?: number | null;
  purchaseDate?: string | null;
  inventoryItemId?: string | null;
  purchasedId?: string | null;
}

/** Persisted Buy vs Skip snapshot (Decision History). */
export interface AcquisitionDecisionRecord {
  id: string;
  itemName: string;
  itemCategory: string | null;
  itemSnapshot: ProspectiveItem;
  decision: BuyDecision;
  score: number | null;
  confidence: number | null;
  summary: string | null;
  analysis: BuyVsSkipAnalysis;
  source: BuyVsSkipInputSource;
  wishlistItemId: string | null;
  createdAt: string;
}

export interface DecisionListFilters {
  decision?: BuyDecision | "all";
  source?: BuyVsSkipInputSource | "all";
  linkage?: "all" | "linked" | "unlinked";
  highScore?: boolean;
  sort?: "recent" | "high_score";
  search?: string;
  /** Inclusive ISO date (YYYY-MM-DD) lower bound on createdAt. */
  from?: string | null;
  /** Inclusive ISO date (YYYY-MM-DD) upper bound on createdAt. */
  to?: string | null;
}

export interface AcquisitionsKpis {
  wishlistActive: number;
  bought: number;
  skipped: number;
  roiScore: number | null;
  /** Average wardrobeImpactScore from recent decisions, or null. */
  impact: number | null;
}

export type {
  ShoppingDashboard,
  WishlistPriority,
  WishlistStatus,
} from "@/domain/shopping";
