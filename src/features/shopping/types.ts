/**
 * Shopping Intelligence feature types (RFC-018). `WishlistItem` is the persisted
 * entry (the pure `WishlistSpec` + identity/timestamps); the dashboard shape is
 * re-exported from the domain.
 */

import type { BuyVsSkipInputSource, ProspectiveItem } from "@/domain/acquisition";
import type { WishlistSpec } from "@/domain/shopping";

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
  notes?: string | null;
}

export type { ShoppingDashboard } from "@/domain/shopping";
