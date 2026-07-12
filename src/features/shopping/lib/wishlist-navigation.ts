/**
 * Deep-link helpers for wishlist rows (RFC-018C Decision History polish).
 */

export const WISHLIST_HIGHLIGHT_PARAM = "highlight";

/** Href that opens the wishlist page focused on a specific item. */
export function wishlistItemHref(wishlistItemId: string): string {
  const id = wishlistItemId.trim();
  if (!id) return "/acquisitions/wishlist";
  return `/acquisitions/wishlist?${WISHLIST_HIGHLIGHT_PARAM}=${encodeURIComponent(id)}`;
}

/** Read highlight id from a URLSearchParams-like object. */
export function readWishlistHighlight(
  params: { get(name: string): string | null } | null | undefined,
): string | null {
  const raw = params?.get(WISHLIST_HIGHLIGHT_PARAM);
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

/** DOM id for scroll/highlight targets. */
export function wishlistRowDomId(wishlistItemId: string): string {
  return `wishlist-item-${wishlistItemId}`;
}
