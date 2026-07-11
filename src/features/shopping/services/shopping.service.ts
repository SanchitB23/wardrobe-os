/**
 * Shopping / Acquisitions service — wishlist CRUD + hub helpers + RFC-018
 * intelligence dashboard + RFC-018B Acquisitions Intelligence composer.
 */

import {
  activeWishlist,
  buildTimelineSubjects,
  computeRecommendationAccuracy,
  computeShoppingROI,
  normalizeProspectiveItem,
  outcomeByName,
  sortByUserPriority,
  type PurchaseRecord,
  type TimelineSubject,
  type TimelineSubjectInput,
} from "@/domain/shopping";
import {
  buildAcquisitionsIntelligence,
  type AcquisitionsIntelligence,
} from "@/domain/shopping/v2";
import type { BuyDecision } from "@/domain/acquisition";
import {
  evaluateWithContext,
  loadAcquisitionContext,
  type AcquisitionContext,
} from "@/features/acquisition/services/acquisition.service";
import { listDecisions } from "@/features/shopping/services/decision.service";
import {
  deleteWishlistRow,
  insertWishlist,
  selectWishlist,
  setWishlistPriority,
  setWishlistStatus,
  updateWishlist,
} from "@/features/shopping/repositories/shopping.repository";
import type {
  AcquisitionsKpis,
  AcquisitionDecisionRecord,
  SaveWishlistInput,
  ShoppingDashboard,
  WishlistItem,
  WishlistPriority,
} from "@/features/shopping/types";
import {
  buildShoppingDashboard,
  type ShoppingEngineEntry,
} from "@/domain/shopping";
import { toError } from "@/shared/utils/data-result";

type Result<T> = { data: T | null; error: Error | null };

/** Derive owned-purchase ROI records from the shared acquisition context. */
function toPurchaseRecords(raw: AcquisitionContext["raw"]): PurchaseRecord[] {
  const wearCounts = new Map<string, number>();
  for (const wear of raw.wearLogs) {
    if (!wear.item_id) continue;
    wearCounts.set(wear.item_id, (wearCounts.get(wear.item_id) ?? 0) + 1);
  }
  const itemById = new Map(
    raw.items.map((i) => [i.id, i] as const),
  );
  return raw.purchases
    .filter((p): p is typeof p & { item_id: string } => Boolean(p.item_id))
    .map((p) => {
      const item = itemById.get(p.item_id);
      return {
        itemId: p.item_id,
        name: item?.name ?? p.item_id,
        category: item?.category?.name ?? null,
        price: p.price ?? null,
        wears: wearCounts.get(p.item_id) ?? 0,
        purchaseDate: p.purchase_date ?? null,
      };
    });
}

function costPerWear(price: number | null, wears: number): number | null {
  if (price == null || wears <= 0) return null;
  return Math.round((price / wears) * 100) / 100;
}

// --- Wishlist CRUD ---------------------------------------------------------

export function listWishlist(): Promise<Result<WishlistItem[]>> {
  return selectWishlist();
}

export function addWishlistItem(
  input: SaveWishlistInput,
): Promise<Result<WishlistItem>> {
  return insertWishlist({
    ...input,
    item: normalizeProspectiveItem(input.item),
  });
}

export function updateWishlistItem(
  id: string,
  input: SaveWishlistInput,
): Promise<Result<WishlistItem>> {
  return updateWishlist(id, {
    ...input,
    item: normalizeProspectiveItem(input.item),
  });
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

export function updateWishlistPriority(
  id: string,
  priority: WishlistPriority,
): Promise<Result<void>> {
  return setWishlistPriority(id, priority);
}

// --- Intelligence dashboard (RFC-018 secondary route) ----------------------

export async function getShoppingDashboard(): Promise<
  Result<ShoppingDashboard>
> {
  const generatedAt = new Date().toISOString();
  const [wishlistResult, contextResult] = await Promise.all([
    selectWishlist(),
    loadAcquisitionContext(),
  ]);

  if (wishlistResult.error) return { data: null, error: wishlistResult.error };
  if (contextResult.error || !contextResult.data) {
    return {
      data: null,
      error: contextResult.error ?? toError("Wardrobe data unavailable."),
    };
  }

  const context = contextResult.data;
  const active = activeWishlist(wishlistResult.data ?? []);

  const entries: ShoppingEngineEntry[] = active.map((w) => ({
    id: w.id,
    item: w.item,
    analysis: evaluateWithContext(w.item, context, w.source),
  }));

  const dashboard = buildShoppingDashboard(
    {
      entries,
      health: context.health,
      purchases: toPurchaseRecords(context.raw),
    },
    { generatedAt },
  );

  return { data: dashboard, error: null };
}

// --- Acquisitions hub + RFC-018B -------------------------------------------

export interface AcquisitionsHubData {
  kpis: AcquisitionsKpis;
  recentDecisions: AcquisitionDecisionRecord[];
  topOpportunities: WishlistItem[];
  timeline: TimelineSubject[];
  shoppingHistory: {
    purchasedWishlist: WishlistItem[];
    realized: ReturnType<typeof computeShoppingROI>["realized"];
    accuracyPercent: number | null;
    accuracySampleSize: number;
  };
  roi: ReturnType<typeof computeShoppingROI>;
  /** RFC-018B continuous learning surfaces. */
  intelligence: AcquisitionsIntelligence;
  /** RFC-018 queue snapshot (may be empty if wardrobe context failed). */
  shoppingDashboard: ShoppingDashboard | null;
}

function latestDecisionByName(
  decisions: AcquisitionDecisionRecord[],
): Map<string, AcquisitionDecisionRecord> {
  const map = new Map<string, AcquisitionDecisionRecord>();
  for (const d of decisions) {
    const key = d.itemName.trim().toLowerCase();
    if (!map.has(key)) map.set(key, d);
  }
  return map;
}

function buildTimelineInputs(
  wishlist: WishlistItem[],
  decisions: AcquisitionDecisionRecord[],
  purchases: PurchaseRecord[],
): TimelineSubjectInput[] {
  const byName = latestDecisionByName(decisions);
  const purchaseByName = new Map(
    purchases.map((p) => [p.name.trim().toLowerCase(), p] as const),
  );

  return wishlist.map((w) => {
    const key = w.item.name.trim().toLowerCase();
    const decision = byName.get(key);
    const purchase = purchaseByName.get(key);
    const purchased = w.status === "purchased" || Boolean(purchase);
    return {
      id: w.id,
      name: w.item.name,
      category: w.item.category || null,
      status: w.status,
      priority: w.priority,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      latestDecision: (decision?.decision as BuyDecision | undefined) ?? null,
      decisionAt: decision?.createdAt ?? null,
      purchased,
      purchaseDate: purchase?.purchaseDate ?? null,
      wears: purchase?.wears ?? 0,
      costPerWear: costPerWear(purchase?.price ?? null, purchase?.wears ?? 0),
    };
  });
}

function buildIntelligence(
  wishlist: WishlistItem[],
  decisions: AcquisitionDecisionRecord[],
  purchases: PurchaseRecord[],
  health: AcquisitionContext["health"],
  dashboard: ShoppingDashboard | null,
  generatedAt: string,
): AcquisitionsIntelligence {
  const byName = latestDecisionByName(decisions);
  const purchaseByName = new Map(
    purchases.map((p) => [p.name.trim().toLowerCase(), p] as const),
  );

  const lifecycleSubjects = wishlist.map((w) => {
    const key = w.item.name.trim().toLowerCase();
    const decision = byName.get(key);
    const purchase = purchaseByName.get(key);
    const purchased = w.status === "purchased" || Boolean(purchase);
    return {
      id: w.id,
      name: w.item.name,
      category: w.item.category || null,
      status: w.status,
      latestDecision: (decision?.decision as BuyDecision | undefined) ?? null,
      purchased,
      wears: purchase?.wears ?? 0,
      costPerWear: costPerWear(purchase?.price ?? null, purchase?.wears ?? 0),
      retired: false,
      updatedAt: w.updatedAt,
    };
  });

  // Also include purchases that never appeared on the wishlist.
  for (const purchase of purchases) {
    const key = purchase.name.trim().toLowerCase();
    if (wishlist.some((w) => w.item.name.trim().toLowerCase() === key)) {
      continue;
    }
    lifecycleSubjects.push({
      id: `purchase:${purchase.itemId}`,
      name: purchase.name,
      category: purchase.category,
      status: "purchased",
      latestDecision: byName.get(key)?.decision ?? null,
      purchased: true,
      wears: purchase.wears,
      costPerWear: costPerWear(purchase.price, purchase.wears),
      retired: false,
      updatedAt: purchase.purchaseDate ?? generatedAt,
    });
  }

  const accuracyDecisions = decisions.map((d) => {
    const key = d.itemName.trim().toLowerCase();
    const purchase = purchaseByName.get(key);
    return {
      decisionId: d.id,
      itemName: d.itemName,
      decision: d.decision,
      outcome: outcomeByName(d.itemName, wishlist),
      wears: purchase?.wears ?? 0,
      costPerWear: costPerWear(purchase?.price ?? null, purchase?.wears ?? 0),
    };
  });

  return buildAcquisitionsIntelligence({
    dashboard,
    lifecycleSubjects,
    accuracyDecisions,
    health,
    needPurchases: purchases.map((p) => ({
      date: p.purchaseDate ?? generatedAt,
      category: p.category,
      name: p.name,
    })),
    roiPurchases: purchases.map((p) => ({
      itemId: p.itemId,
      name: p.name,
      category: p.category,
      price: p.price,
      wears: p.wears,
      purchaseDate: p.purchaseDate,
    })),
    generatedAt,
  });
}

export async function getAcquisitionsHub(): Promise<
  Result<AcquisitionsHubData>
> {
  const generatedAt = new Date().toISOString();
  const [wishlistResult, decisionsResult, contextResult] = await Promise.all([
    selectWishlist(),
    listDecisions(),
    loadAcquisitionContext(),
  ]);

  if (wishlistResult.error) return { data: null, error: wishlistResult.error };
  if (decisionsResult.error)
    return { data: null, error: decisionsResult.error };

  const wishlist = wishlistResult.data ?? [];
  const decisions = decisionsResult.data ?? [];
  const context = contextResult.data;
  const purchases = context != null ? toPurchaseRecords(context.raw) : [];
  const roi = computeShoppingROI(purchases, []);

  const active = activeWishlist(wishlist);
  const boughtCount = wishlist.filter((w) => w.status === "purchased").length;
  const skippedCount =
    wishlist.filter((w) => w.status === "dismissed").length +
    decisions.filter((d) => d.decision === "skip").length;

  const impactValues = decisions
    .slice(0, 20)
    .map((d) => d.analysis?.wardrobeImpactScore)
    .filter((n): n is number => typeof n === "number");
  const impact =
    impactValues.length > 0
      ? Math.round(
          impactValues.reduce((a, b) => a + b, 0) / impactValues.length,
        )
      : null;

  const accuracy = computeRecommendationAccuracy(
    decisions.map((d) => ({
      decision: d.decision,
      outcome: outcomeByName(d.itemName, wishlist),
    })),
  );

  let shoppingDashboard: ShoppingDashboard | null = null;
  if (context) {
    const entries: ShoppingEngineEntry[] = active.map((w) => ({
      id: w.id,
      item: w.item,
      analysis: evaluateWithContext(w.item, context, w.source),
    }));
    shoppingDashboard = buildShoppingDashboard(
      {
        entries,
        health: context.health,
        purchases,
      },
      { generatedAt },
    );
  }

  const intelligence = buildIntelligence(
    wishlist,
    decisions,
    purchases,
    context?.health ?? null,
    shoppingDashboard,
    generatedAt,
  );

  const hub: AcquisitionsHubData = {
    kpis: {
      wishlistActive: active.length,
      bought: boughtCount,
      skipped: skippedCount,
      roiScore: purchases.length > 0 ? roi.wardrobeRoiScore : null,
      impact,
    },
    recentDecisions: decisions.slice(0, 5),
    topOpportunities: sortByUserPriority(active).slice(0, 5),
    timeline: buildTimelineSubjects(
      buildTimelineInputs(wishlist, decisions, purchases),
    ),
    shoppingHistory: {
      purchasedWishlist: wishlist.filter((w) => w.status === "purchased"),
      realized: roi.realized,
      accuracyPercent: accuracy.accuracyPercent,
      accuracySampleSize: accuracy.sampleSize,
    },
    roi,
    intelligence,
    shoppingDashboard,
  };

  return { data: hub, error: null };
}

/** Standalone 018B load for Developer Mode (same composer as the hub). */
export async function getAcquisitionsIntelligence(): Promise<
  Result<AcquisitionsIntelligence>
> {
  const hub = await getAcquisitionsHub();
  if (hub.error || !hub.data) {
    return { data: null, error: hub.error ?? toError("Hub unavailable.") };
  }
  return { data: hub.data.intelligence, error: null };
}
