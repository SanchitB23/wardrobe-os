/**
 * WishlistEngine (RFC-018) — pure helpers over captured wishlist items:
 * normalization, evaluability, and the active-subset selector. No scoring here;
 * ranking lives in the PriorityEngine, verdicts in Acquisition.
 */

import type { ProspectiveItem } from "@/domain/acquisition";
import type { WishlistStatus } from "@/domain/shopping/types";

const trimOrNull = (v?: string | null): string | null => {
  const t = v?.trim();
  return t ? t : null;
};

/** Normalize a captured item — trim strings, drop empties. Deterministic. */
export function normalizeProspectiveItem(item: ProspectiveItem): ProspectiveItem {
  return {
    ...item,
    name: item.name.trim(),
    category: item.category.trim(),
    subcategory: trimOrNull(item.subcategory),
    brand: trimOrNull(item.brand),
    color: trimOrNull(item.color),
    material: trimOrNull(item.material),
    formality: trimOrNull(item.formality),
    notes: trimOrNull(item.notes),
    productUrl: trimOrNull(item.productUrl),
    styleTags: item.styleTags?.map((t) => t.trim()).filter(Boolean),
    intendedOccasions: item.intendedOccasions?.map((t) => t.trim()).filter(Boolean),
  };
}

/** An item is evaluable by Buy vs Skip once it has a name + category. */
export function isEvaluable(item: ProspectiveItem): boolean {
  return item.name.trim().length > 0 && item.category.trim().length > 0;
}

/** The still-considering items — the ones Shopping Intelligence ranks. */
export function activeWishlist<T extends { status: WishlistStatus }>(items: T[]): T[] {
  return items.filter((i) => i.status === "active");
}
