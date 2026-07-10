/**
 * ShoppingEngine (RFC-018) — the pure top-level composer. Given each wishlist
 * entry's **Acquisition verdict** (`BuyVsSkipAnalysis`, supplied by the service),
 * it scores, ranks, and aggregates into a `ShoppingDashboard`. It never calls
 * Acquisition or AI and never decides a purchase — engines decide, it ranks.
 */

import type { BuyVsSkipAnalysis, ProspectiveItem } from "@/domain/acquisition";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import { SHOPPING_ENGINE_VERSION, STRATEGY_TOP_N } from "@/domain/shopping/constants";
import { analyzeDuplicates } from "@/domain/shopping/DuplicateEngine";
import { rankWishlist, scoreEntry } from "@/domain/shopping/PriorityEngine";
import { computeShoppingROI } from "@/domain/shopping/ROIEngine";
import { buildWishlistInsights } from "@/domain/shopping/ShoppingInsights";
import type {
  PriorityWeights,
  PurchaseRecord,
  ShoppingDashboard,
  ShoppingRecommendation,
  ShoppingStrategyStep,
  ShoppingTimelineEntry,
} from "@/domain/shopping/types";

export interface ShoppingEngineEntry {
  id: string;
  item: ProspectiveItem;
  analysis: BuyVsSkipAnalysis;
}

export interface ShoppingEngineInput {
  entries: ShoppingEngineEntry[];
  health: WardrobeHealth | null;
  purchases: PurchaseRecord[];
}

export interface ShoppingEngineOptions {
  /** Injected instant so metadata is deterministic (no wall-clock). */
  generatedAt: string;
  weights?: PriorityWeights;
}

export function buildShoppingDashboard(
  input: ShoppingEngineInput,
  options: ShoppingEngineOptions,
): ShoppingDashboard {
  const recs: ShoppingRecommendation[] = input.entries.map((entry) => ({
    id: entry.id,
    item: entry.item,
    analysis: entry.analysis,
    scores: scoreEntry(
      entry.item,
      entry.analysis.score,
      entry.analysis.wardrobeImpactScore,
      input.health,
      options.weights,
    ),
  }));

  const priority = rankWishlist(recs);
  const roi = computeShoppingROI(input.purchases, priority);
  const duplicates = analyzeDuplicates(input.entries);

  const timeline: ShoppingTimelineEntry[] = [
    ...input.purchases
      .filter((p) => p.purchaseDate)
      .map((p) => ({ date: p.purchaseDate as string, kind: "purchased" as const, name: p.name })),
    ...priority
      .slice(0, STRATEGY_TOP_N)
      .map((r) => ({ date: "", kind: "planned" as const, name: r.item.name })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const strategy: ShoppingStrategyStep[] = priority.slice(0, STRATEGY_TOP_N).map((r, i) => ({
    rank: i + 1,
    name: r.item.name,
    action: r.analysis.decision,
    reason:
      r.analysis.reasonsToBuy[0] ??
      r.scores.reasonCodes[0] ??
      "prioritised by need, impact, and verdict",
  }));

  return {
    priority,
    roi,
    duplicates,
    timeline,
    strategy,
    insights: buildWishlistInsights(priority, roi, duplicates),
    metadata: {
      engineVersion: SHOPPING_ENGINE_VERSION,
      generatedAt: options.generatedAt,
      wishlistCount: input.entries.length,
    },
  };
}
