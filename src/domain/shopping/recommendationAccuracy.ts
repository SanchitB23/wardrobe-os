/**
 * Recommendation accuracy (Acquisitions product UX) — pure.
 * Compares stored Buy vs Skip decisions to later wishlist outcomes.
 * buy → purchased and skip → dismissed count as hits; consider never scores.
 */

import type { BuyDecision } from "@/domain/acquisition";
import type { WishlistStatus } from "@/domain/shopping/types";

export interface DecisionOutcomePair {
  decision: BuyDecision;
  /** Later wishlist status for a name-matched item, if any. */
  outcome: WishlistStatus | null;
}

export interface RecommendationAccuracy {
  sampleSize: number;
  hits: number;
  /** 0–100, or null when sampleSize === 0. */
  accuracyPercent: number | null;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Match a decision item name to a wishlist outcome by normalized name. */
export function outcomeByName(
  itemName: string,
  wishlist: { item: { name: string }; status: WishlistStatus }[],
): WishlistStatus | null {
  const key = normalizeName(itemName);
  const match = wishlist.find((w) => normalizeName(w.item.name) === key);
  return match?.status ?? null;
}

export function isAccuracyHit(
  decision: BuyDecision,
  outcome: WishlistStatus,
): boolean {
  if (decision === "buy" && outcome === "purchased") return true;
  if (decision === "skip" && outcome === "dismissed") return true;
  return false;
}

/** Only buy/skip decisions with a purchased/dismissed outcome enter the sample. */
export function computeRecommendationAccuracy(
  pairs: DecisionOutcomePair[],
): RecommendationAccuracy {
  let sampleSize = 0;
  let hits = 0;
  for (const { decision, outcome } of pairs) {
    if (!outcome) continue;
    if (outcome !== "purchased" && outcome !== "dismissed") continue;
    if (decision === "consider") continue;
    sampleSize += 1;
    if (isAccuracyHit(decision, outcome)) hits += 1;
  }
  if (sampleSize === 0) {
    return { sampleSize: 0, hits: 0, accuracyPercent: null };
  }
  return {
    sampleSize,
    hits,
    accuracyPercent: Math.round((hits / sampleSize) * 100),
  };
}
