/**
 * Acquisitions Intelligence (RFC-018B) — Vitest coverage for evolution engines.
 * Pure fixtures; no I/O / AI.
 */

import { describe, expect, it } from "vitest";

import type { BuyVsSkipAnalysis, ProspectiveItem } from "@/domain/acquisition";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import type {
  ShoppingDashboard,
  ShoppingRecommendation,
} from "@/domain/shopping/types";
import {
  buildAcquisitionsIntelligence,
  buildDynamicStrategy,
  buildNeedTimeline,
  buildPurchaseLifecycle,
  buildRecommendationAccuracyReport,
  buildRoiTimeline,
  isDeepAccuracyHit,
  resolveLifecycleState,
  scoreOpportunities,
  ACQUISITIONS_INTELLIGENCE_VERSION,
  ESTABLISHED_MIN_WEARS,
} from "@/domain/shopping/v2";

function item(name: string, category = "top"): ProspectiveItem {
  return { name, category };
}

function analysis(
  overrides: Partial<BuyVsSkipAnalysis> = {},
): BuyVsSkipAnalysis {
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

function rec(
  id: string,
  priority: number,
  need = 50,
  decision: BuyVsSkipAnalysis["decision"] = "buy",
): ShoppingRecommendation {
  return {
    id,
    item: item(id),
    analysis: analysis({ decision, score: priority }),
    scores: {
      need,
      impact: 70,
      buy: priority,
      priority,
      reasonCodes: [],
    },
  };
}

function dashboard(priority: ShoppingRecommendation[]): ShoppingDashboard {
  return {
    priority,
    roi: {
      realized: [],
      projected: [],
      totalSpend: 0,
      averageCostPerWear: null,
      wardrobeRoiScore: 0,
    },
    duplicates: { clusters: [], wishlistDuplicateCount: 0 },
    timeline: [],
    strategy: [],
    insights: { summary: "", topReasons: [] },
    metadata: {
      engineVersion: "1.0.0",
      generatedAt: "2026-07-01T00:00:00.000Z",
      wishlistCount: priority.length,
    },
  };
}

describe("PurchaseLifecycleEngine", () => {
  it("resolves wishlist → analyzed → bought → first_wear → established", () => {
    expect(
      resolveLifecycleState({
        id: "1",
        name: "A",
        category: null,
        status: "active",
        latestDecision: null,
        purchased: false,
        wears: 0,
        costPerWear: null,
      }),
    ).toBe("wishlist");

    expect(
      resolveLifecycleState({
        id: "1",
        name: "A",
        category: null,
        status: "active",
        latestDecision: "buy",
        purchased: false,
        wears: 0,
        costPerWear: null,
      }),
    ).toBe("analyzed");

    expect(
      resolveLifecycleState({
        id: "1",
        name: "A",
        category: null,
        status: "purchased",
        latestDecision: "buy",
        purchased: true,
        wears: 0,
        costPerWear: null,
      }),
    ).toBe("bought");

    expect(
      resolveLifecycleState({
        id: "1",
        name: "A",
        category: null,
        status: "purchased",
        latestDecision: "buy",
        purchased: true,
        wears: 1,
        costPerWear: 10,
      }),
    ).toBe("first_wear");

    expect(
      resolveLifecycleState({
        id: "1",
        name: "A",
        category: null,
        status: "purchased",
        latestDecision: "buy",
        purchased: true,
        wears: ESTABLISHED_MIN_WEARS,
        costPerWear: 5,
      }),
    ).toBe("established");
  });

  it("flags low_usage and retired", () => {
    expect(
      resolveLifecycleState({
        id: "1",
        name: "A",
        category: null,
        status: "purchased",
        latestDecision: "buy",
        purchased: true,
        wears: 2,
        costPerWear: 80,
      }),
    ).toBe("low_usage");

    expect(
      resolveLifecycleState({
        id: "1",
        name: "A",
        category: null,
        status: "purchased",
        latestDecision: "buy",
        purchased: true,
        wears: 0,
        costPerWear: null,
        retired: true,
      }),
    ).toBe("retired");
  });

  it("builds subjects with statesReached", () => {
    const life = buildPurchaseLifecycle([
      {
        id: "a",
        name: "Jacket",
        category: "outerwear",
        status: "purchased",
        latestDecision: "buy",
        purchased: true,
        wears: 6,
        costPerWear: 4,
      },
    ]);
    expect(life.subjects[0].state).toBe("established");
    expect(life.subjects[0].statesReached).toContain("bought");
    expect(life.subjects[0].statesReached).toContain("established");
  });
});

describe("RecommendationAccuracyEngine", () => {
  it("scores deep buy hits only when bought, worn, and ROI ok", () => {
    expect(
      isDeepAccuracyHit({
        decisionId: "1",
        itemName: "Shirt",
        decision: "buy",
        outcome: "purchased",
        wears: 3,
        costPerWear: 10,
      }),
    ).toBe(true);

    expect(
      isDeepAccuracyHit({
        decisionId: "1",
        itemName: "Shirt",
        decision: "buy",
        outcome: "purchased",
        wears: 0,
        costPerWear: null,
      }),
    ).toBe(false);

    expect(
      isDeepAccuracyHit({
        decisionId: "1",
        itemName: "Shirt",
        decision: "buy",
        outcome: "purchased",
        wears: 2,
        costPerWear: 100,
      }),
    ).toBe(false);
  });

  it("builds shallow + deep report", () => {
    const report = buildRecommendationAccuracyReport([
      {
        decisionId: "1",
        itemName: "A",
        decision: "buy",
        outcome: "purchased",
        wears: 4,
        costPerWear: 8,
      },
      {
        decisionId: "2",
        itemName: "B",
        decision: "skip",
        outcome: "dismissed",
        wears: 0,
        costPerWear: null,
      },
      {
        decisionId: "3",
        itemName: "C",
        decision: "buy",
        outcome: "purchased",
        wears: 0,
        costPerWear: null,
      },
      {
        decisionId: "4",
        itemName: "D",
        decision: "consider",
        outcome: "purchased",
        wears: 1,
        costPerWear: 5,
      },
    ]);
    // Shallow: buy→purchased and skip→dismissed (unworn buy still counts shallow).
    expect(report.sampleSize).toBe(3);
    expect(report.hits).toBe(3);
    expect(report.accuracyPercent).toBe(100);
    // Deep: worn+ROI buy + skip dismiss hit; unworn buy misses.
    expect(report.deepSampleSize).toBe(3);
    expect(report.deepHits).toBe(2);
    expect(report.deepAccuracyPercent).toBe(67);
  });
});

describe("NeedEvolution", () => {
  it("emits gap points and purchase residuals", () => {
    const health = {
      gaps: [
        {
          label: "Blazer",
          kind: "staple",
          detail: "missing",
          priority: "high",
        },
      ],
    } as WardrobeHealth;

    const timeline = buildNeedTimeline({
      health,
      purchases: [
        { date: "2026-02-01", category: "Blazer", name: "Navy Blazer" },
      ],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(timeline.points.length).toBeGreaterThanOrEqual(2);
    expect(timeline.points.some((p) => p.needScore === 100)).toBe(true);
    const after = timeline.points.find((p) => p.date === "2026-02-01");
    expect(after?.needScore).toBe(65);
  });
});

describe("ROIEvolution", () => {
  it("builds cumulative utilization points and cohorts", () => {
    const timeline = buildRoiTimeline({
      generatedAt: "2026-06-01T00:00:00.000Z",
      purchases: [
        {
          itemId: "1",
          name: "Tee",
          category: "top",
          price: 20,
          wears: 10,
          purchaseDate: "2026-01-01",
        },
        {
          itemId: "2",
          name: "Shoes",
          category: "footwear",
          price: 200,
          wears: 0,
          purchaseDate: "2026-03-01",
        },
      ],
    });

    expect(timeline.points).toHaveLength(2);
    expect(timeline.points[0].wardrobeRoiScore).toBe(100);
    expect(timeline.points[1].wardrobeRoiScore).toBe(50);
    expect(timeline.bestCategories[0]?.category).toBe("top");
    expect(timeline.worstCategories.some((c) => c.category === "footwear")).toBe(
      true,
    );
  });
});

describe("OpportunityEngine", () => {
  it("ranks by composed opportunity score without re-scoring buy/skip", () => {
    const life = buildPurchaseLifecycle([
      {
        id: "high",
        name: "high",
        category: null,
        status: "active",
        latestDecision: "buy",
        purchased: false,
        wears: 0,
        costPerWear: null,
      },
      {
        id: "low",
        name: "low",
        category: null,
        status: "active",
        latestDecision: null,
        purchased: false,
        wears: 0,
        costPerWear: null,
      },
    ]);

    const queue = scoreOpportunities({
      dashboard: dashboard([rec("high", 90, 100), rec("low", 40, 20)]),
      lifecycle: life,
    });

    expect(queue[0].id).toBe("high");
    expect(queue[0].fromPriority).toBe(90);
    expect(queue[0].opportunityScore).toBeGreaterThan(queue[1].opportunityScore);
    expect(queue[0].reasons.length).toBeGreaterThan(0);
  });
});

describe("StrategyEvolution", () => {
  it("emits STOP_CATEGORY and GATHER_OUTCOMES appropriately", () => {
    const gather = buildDynamicStrategy({
      accuracy: {
        sampleSize: 0,
        hits: 0,
        accuracyPercent: null,
        deepSampleSize: 0,
        deepHits: 0,
        deepAccuracyPercent: null,
        cases: [],
      },
      roiTimeline: {
        points: [{ date: "2026-01-01", wardrobeRoiScore: 0, averageCostPerWear: null }],
        bestCategories: [],
        worstCategories: [],
      },
      needTimeline: { points: [] },
      opportunityQueue: [],
      generatedAt: "2026-07-01T00:00:00.000Z",
    });
    expect(gather.rules.some((r) => r.code === "GATHER_OUTCOMES")).toBe(true);

    const stop = buildDynamicStrategy({
      accuracy: {
        sampleSize: 0,
        hits: 0,
        accuracyPercent: null,
        deepSampleSize: 0,
        deepHits: 0,
        deepAccuracyPercent: null,
        cases: [],
      },
      roiTimeline: {
        points: [],
        bestCategories: [],
        worstCategories: [{ category: "shirts", score: 20 }],
      },
      needTimeline: { points: [] },
      opportunityQueue: [],
      generatedAt: "2026-07-01T00:00:00.000Z",
    });
    expect(stop.rules.some((r) => r.code === "STOP_CATEGORY")).toBe(true);
  });
});

describe("buildAcquisitionsIntelligence", () => {
  it("composes all surfaces with version metadata", () => {
    const intel = buildAcquisitionsIntelligence({
      dashboard: dashboard([rec("x", 80, 90)]),
      lifecycleSubjects: [
        {
          id: "x",
          name: "x",
          category: "top",
          status: "active",
          latestDecision: "buy",
          purchased: false,
          wears: 0,
          costPerWear: null,
        },
      ],
      accuracyDecisions: [],
      health: null,
      needPurchases: [],
      roiPurchases: [],
      generatedAt: "2026-07-12T00:00:00.000Z",
    });

    expect(intel.metadata.version).toBe(ACQUISITIONS_INTELLIGENCE_VERSION);
    expect(intel.opportunityQueue[0]?.id).toBe("x");
    expect(intel.strategy.rules.length).toBeGreaterThan(0);
    expect(intel.lifecycle.subjects[0].state).toBe("analyzed");
  });
});
