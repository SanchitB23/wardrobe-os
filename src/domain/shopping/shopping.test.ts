import { describe, expect, it } from "vitest";

import type { BuyVsSkipAnalysis, ProspectiveItem } from "@/domain/acquisition";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import {
  analyzeDuplicates,
  buildShoppingDashboard,
  buildWishlistInsights,
  computeNeedScore,
  computeShoppingROI,
  itemOverlap,
  priorityScore,
  rankWishlist,
  type PurchaseRecord,
  type ShoppingRecommendation,
} from "@/domain/shopping";

function item(overrides: Partial<ProspectiveItem> = {}): ProspectiveItem {
  return { name: "Item", category: "top", ...overrides };
}

function analysis(overrides: Partial<BuyVsSkipAnalysis> = {}): BuyVsSkipAnalysis {
  return {
    decision: "buy",
    score: 80,
    confidence: 0.8,
    confidenceBreakdown: { overall: 0.8, byDimension: {} as never, notes: [] },
    summary: "",
    scoreBreakdown: {} as never,
    reasonsToBuy: ["fills a gap"],
    reasonsToSkip: [],
    tradeoffs: [],
    suggestedAlternatives: [],
    similarExistingItems: [],
    potentialOutfits: [],
    estimatedCostPerWear: 5,
    wardrobeImpactScore: 70,
    decisionTrace: [],
    explainabilityCodes: [],
    metadata: {} as never,
    ...overrides,
  };
}

const healthWith = (gaps: WardrobeHealth["gaps"]): WardrobeHealth =>
  ({ gaps } as unknown as WardrobeHealth);

function rec(id: string, a: Partial<BuyVsSkipAnalysis>, priority: number): ShoppingRecommendation {
  return {
    id,
    item: item({ name: id }),
    analysis: analysis(a),
    scores: { need: 0, impact: a.wardrobeImpactScore ?? 0, buy: a.score ?? 0, priority, reasonCodes: [] },
  };
}

describe("computeNeedScore", () => {
  it("scores by the highest-priority matching gap", () => {
    const health = healthWith([
      { label: "Blazer", kind: "staple", detail: "No formal blazer for events", priority: "high" },
      { label: "Sneakers", kind: "category", detail: "Few casual shoes", priority: "low" },
    ]);
    expect(computeNeedScore(item({ name: "Navy blazer", category: "blazer" }), health)).toBe(100);
    expect(computeNeedScore(item({ name: "White sneakers", category: "sneakers" }), health)).toBe(40);
  });

  it("returns baseline for no gap match and neutral when health is absent", () => {
    const health = healthWith([
      { label: "Blazer", kind: "staple", detail: "formal", priority: "high" },
    ]);
    expect(computeNeedScore(item({ name: "T-shirt", category: "tee" }), health)).toBe(20);
    expect(computeNeedScore(item(), null)).toBe(50);
  });
});

describe("priorityScore", () => {
  it("is a weighted blend and emits reason codes", () => {
    const { score, reasonCodes } = priorityScore({ need: 100, impact: 100, buy: 100 });
    expect(score).toBe(100);
    expect(reasonCodes).toContain("NEED_HIGH");
    expect(reasonCodes).toContain("IMPACT_HIGH");
    expect(reasonCodes).toContain("BUY_STRONG");
    const weak = priorityScore({ need: 10, impact: 10, buy: 20 });
    expect(weak.score).toBeLessThan(score);
    expect(weak.reasonCodes).toContain("BUY_WEAK");
    expect(weak.reasonCodes).toContain("NEED_LOW");
  });
});

describe("rankWishlist", () => {
  it("orders by priority desc with deterministic tie-breaks", () => {
    const ranked = rankWishlist([
      rec("a", { score: 50, wardrobeImpactScore: 50 }, 60),
      rec("b", { score: 90, wardrobeImpactScore: 50 }, 80),
      rec("c", { score: 70, wardrobeImpactScore: 50 }, 80), // ties b on priority; b wins on buy
    ]);
    expect(ranked.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});

describe("computeShoppingROI", () => {
  it("computes realized cost-per-wear, projected, and a utilization signal", () => {
    const purchases: PurchaseRecord[] = [
      {
        itemId: "1",
        name: "Coat",
        category: null,
        price: 200,
        wears: 20,
        purchaseDate: "2026-01-01",
      },
      {
        itemId: "2",
        name: "Shoes",
        category: null,
        price: 100,
        wears: 0,
        purchaseDate: "2026-02-01",
      },
    ];
    const queue = [rec("q", { estimatedCostPerWear: 8 }, 70)];
    const roi = computeShoppingROI(purchases, queue);
    expect(roi.realized[0].costPerWear).toBe(10); // 200 / 20
    expect(roi.realized[1].costPerWear).toBeNull(); // 0 wears
    expect(roi.totalSpend).toBe(300);
    expect(roi.wardrobeRoiScore).toBe(50); // 1 of 2 worn
    expect(roi.projected[0].estimatedCostPerWear).toBe(8);
  });

  it("is zero utilization with no purchases", () => {
    expect(computeShoppingROI([], []).wardrobeRoiScore).toBe(0);
  });
});

describe("analyzeDuplicates", () => {
  it("clusters wishlist↔wardrobe via acquisition similarity and wishlist↔wishlist by overlap", () => {
    const entries = [
      {
        id: "a",
        item: item({ name: "Blue shirt", category: "shirt", color: "blue", formality: "casual" }),
        analysis: analysis({
          similarExistingItems: [{ itemId: "w1", name: "Owned blue shirt", overlap: 0.8, lowUse: false }],
        }),
      },
      {
        id: "b",
        item: item({ name: "Navy shirt", category: "shirt", color: "blue", formality: "casual" }),
        analysis: analysis({ similarExistingItems: [] }),
      },
    ];
    const result = analyzeDuplicates(entries);
    expect(result.clusters.length).toBe(2); // one wardrobe cluster + one wishlist-pair cluster
    expect(result.wishlistDuplicateCount).toBe(2);
  });

  it("itemOverlap weights category, color, formality", () => {
    expect(itemOverlap(item({ category: "shirt" }), item({ category: "shirt" }))).toBe(0.5);
    expect(
      itemOverlap(
        item({ category: "shirt", color: "blue", formality: "casual" }),
        item({ category: "shirt", color: "blue", formality: "casual" }),
      ),
    ).toBe(1);
  });
});

describe("buildShoppingDashboard", () => {
  it("scores, ranks, and aggregates without deciding", () => {
    const dashboard = buildShoppingDashboard(
      {
        entries: [
          { id: "hi", item: item({ name: "Blazer", category: "blazer" }), analysis: analysis({ score: 90, wardrobeImpactScore: 80, decision: "buy" }) },
          { id: "lo", item: item({ name: "Cap", category: "hat" }), analysis: analysis({ score: 30, wardrobeImpactScore: 20, decision: "skip" }) },
        ],
        health: healthWith([{ label: "Blazer", kind: "staple", detail: "need a blazer", priority: "high" }]),
        purchases: [
          {
            itemId: "1",
            name: "Coat",
            category: null,
            price: 200,
            wears: 10,
            purchaseDate: "2026-01-01",
          },
        ],
      },
      { generatedAt: "2026-07-11T00:00:00.000Z" },
    );
    expect(dashboard.priority[0].id).toBe("hi");
    expect(dashboard.priority[0].scores.priority).toBeGreaterThan(dashboard.priority[1].scores.priority);
    // The verdict is never re-decided — it comes straight from the analysis.
    expect(dashboard.priority[0].analysis.decision).toBe("buy");
    expect(dashboard.strategy[0].action).toBe("buy");
    expect(dashboard.roi.realized[0].costPerWear).toBe(20);
    expect(dashboard.metadata.wishlistCount).toBe(2);
    expect(dashboard.insights.summary).toContain("Top priority: Blazer");
  });
});

describe("buildWishlistInsights", () => {
  it("handles the empty wishlist", () => {
    const insights = buildWishlistInsights([], computeShoppingROI([], []), { clusters: [], wishlistDuplicateCount: 0 });
    expect(insights.summary).toContain("empty");
    expect(insights.topReasons).toEqual([]);
  });
});
