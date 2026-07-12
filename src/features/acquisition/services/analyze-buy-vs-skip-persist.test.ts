/**
 * analyzeBuyVsSkip silently records Decision History — analysis still returns
 * when the history write fails.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/shopping/services/decision.service", () => ({
  recordDecisionSilent: vi.fn(async () => {
    throw new Error("history write boom");
  }),
}));

vi.mock(
  "@/features/recommendations/repositories/recommendations.repository",
  () => ({
    selectRecommendationData: vi.fn(async () => ({
      data: {
        items: [],
        wearLogs: [],
        purchases: [],
        outfits: [],
        outfitItems: [],
      },
      error: null,
    })),
  }),
);

vi.mock("@/features/analytics/services/analytics.service", () => ({
  fetchWardrobeHealth: vi.fn(async () => ({ data: null, error: null })),
  fetchUsageAnalytics: vi.fn(async () => ({ data: null, error: null })),
}));

vi.mock("@/features/personalization/services/personalization.service", () => ({
  getPreferenceProfile: vi.fn(async () => ({ data: null, error: null })),
}));

vi.mock("@/domain/acquisition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/acquisition")>();
  return {
    ...actual,
    evaluateBuyVsSkip: vi.fn(() => ({
      decision: "buy",
      score: 72,
      confidence: 0.7,
      confidenceBreakdown: { overall: 0.7, data: 0.7, preference: 0.7 },
      summary: "Solid buy",
      scoreBreakdown: {
        need: 0,
        styleFit: 0,
        versatility: 0,
        duplicateRisk: 0,
        gapFillValue: 0,
        preferenceFit: 0,
        costEfficiency: 0,
        wardrobeImpact: 0,
      },
      reasonsToBuy: [],
      reasonsToSkip: [],
      tradeoffs: [],
      suggestedAlternatives: [],
      similarExistingItems: [],
      potentialOutfits: [],
      estimatedCostPerWear: 40,
      wardrobeImpactScore: 55,
      decisionTrace: [],
      explainabilityCodes: [],
      metadata: {
        engineVersion: "test",
        generatedAt: "2026-01-01T00:00:00Z",
        inputSource: "manual",
        contributingEngines: {
          buyVsSkip: "test",
          styleDNA: "test",
          outfit: "test",
          wardrobeHealth: null,
          usageAnalytics: null,
        },
      },
    })),
  };
});

import { analyzeBuyVsSkip } from "@/features/acquisition/services/acquisition.service";
import { recordDecisionSilent } from "@/features/shopping/services/decision.service";

const recordDecisionSilentMock = vi.mocked(recordDecisionSilent);

describe("analyzeBuyVsSkip silent persist", () => {
  beforeEach(() => {
    recordDecisionSilentMock.mockClear();
  });

  it("returns analysis even when decision history write throws", async () => {
    const result = await analyzeBuyVsSkip({
      name: "Navy blazer",
      category: "blazer",
    });
    expect(result.error).toBeNull();
    expect(result.data?.decision).toBe("buy");
    expect(result.data?.score).toBe(72);
    expect(result.decisionId).toBeNull();
    expect(recordDecisionSilentMock).toHaveBeenCalledOnce();
  });
});
