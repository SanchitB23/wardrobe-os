/**
 * ShoppingService (RFC-018) — orchestrates the wishlist + the Acquisition engine
 * into a `ShoppingDashboard`. It loads the shared Buy vs Skip context ONCE
 * (`loadAcquisitionContext`, reused from RFC-001), evaluates each active wishlist
 * item with it (`evaluateWithContext` — Acquisition decides), then runs the pure
 * `buildShoppingDashboard` aggregation. No planning/decision logic is duplicated.
 */

import {
  buildShoppingDashboard,
  normalizeProspectiveItem,
  activeWishlist,
  type PurchaseRecord,
  type ShoppingEngineEntry,
} from "@/domain/shopping";
import {
  evaluateWithContext,
  loadAcquisitionContext,
  type AcquisitionContext,
} from "@/features/acquisition/services/acquisition.service";
import {
  deleteWishlistRow,
  insertWishlist,
  selectWishlist,
  setWishlistStatus,
  updateWishlist,
} from "@/features/shopping/repositories/shopping.repository";
import type { SaveWishlistInput, ShoppingDashboard, WishlistItem } from "@/features/shopping/types";
import { toError } from "@/shared/utils/data-result";

type Result<T> = { data: T | null; error: Error | null };

/** Derive owned-purchase ROI records from the shared acquisition context. */
function toPurchaseRecords(raw: AcquisitionContext["raw"]): PurchaseRecord[] {
  const wearCounts = new Map<string, number>();
  for (const wear of raw.wearLogs) {
    if (!wear.item_id) continue;
    wearCounts.set(wear.item_id, (wearCounts.get(wear.item_id) ?? 0) + 1);
  }
  const nameById = new Map(raw.items.map((i) => [i.id, i.name]));
  return raw.purchases
    .filter((p): p is typeof p & { item_id: string } => Boolean(p.item_id))
    .map((p) => ({
      itemId: p.item_id,
      name: nameById.get(p.item_id) ?? p.item_id,
      price: p.price ?? null,
      wears: wearCounts.get(p.item_id) ?? 0,
      purchaseDate: null,
    }));
}

// --- Wishlist CRUD ---------------------------------------------------------

export function listWishlist(): Promise<Result<WishlistItem[]>> {
  return selectWishlist();
}

export function addWishlistItem(input: SaveWishlistInput): Promise<Result<WishlistItem>> {
  return insertWishlist({ ...input, item: normalizeProspectiveItem(input.item) });
}

export function updateWishlistItem(
  id: string,
  input: SaveWishlistInput,
): Promise<Result<WishlistItem>> {
  return updateWishlist(id, { ...input, item: normalizeProspectiveItem(input.item) });
}

export function markPurchased(id: string): Promise<Result<void>> {
  // Flips status only. Adding the piece to inventory + purchase history is the
  // existing inventory/purchase flow (a purchase row needs a real wardrobe item).
  return setWishlistStatus(id, "purchased");
}

export function dismissWishlistItem(id: string): Promise<Result<void>> {
  return setWishlistStatus(id, "dismissed");
}

export function deleteWishlistItem(id: string): Promise<Result<void>> {
  return deleteWishlistRow(id);
}

// --- Dashboard -------------------------------------------------------------

export async function getShoppingDashboard(): Promise<Result<ShoppingDashboard>> {
  const generatedAt = new Date().toISOString();
  const [wishlistResult, contextResult] = await Promise.all([
    selectWishlist(),
    loadAcquisitionContext(),
  ]);

  if (wishlistResult.error) return { data: null, error: wishlistResult.error };
  if (contextResult.error || !contextResult.data) {
    return { data: null, error: contextResult.error ?? toError("Wardrobe data unavailable.") };
  }

  const context = contextResult.data;
  const active = activeWishlist(wishlistResult.data ?? []);

  // Acquisition decides each item — one shared context, no per-item refetch.
  const entries: ShoppingEngineEntry[] = active.map((w) => ({
    id: w.id,
    item: w.item,
    analysis: evaluateWithContext(w.item, context, w.source),
  }));

  const dashboard = buildShoppingDashboard(
    { entries, health: context.health, purchases: toPurchaseRecords(context.raw) },
    { generatedAt },
  );

  return { data: dashboard, error: null };
}
