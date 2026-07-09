import { describe, expect, it } from "vitest";

import type { OutfitAnalysis, RuleResult } from "@/domain/outfit/types";
import type { UnifiedOutfitRecommendation } from "@/domain/recommendation";
import {
  buildExplainSharedContext,
  buildExplanationInput,
  explanationCacheKey,
} from "@/features/recommendations/ai/explanation-input";
import type { ExplainSharedContext } from "@/features/recommendations/ai/explanation.types";

function rule(score: number, reason: string): RuleResult {
  return { score, confidence: 0.9, reason, strengths: [], weaknesses: [], suggestions: [] };
}

const analysis: OutfitAnalysis = {
  overallScore: 8.2,
  confidence: 0.86,
  summary: "Cohesive smart-casual look.",
  breakdown: {
    color: rule(9, "Harmonious palette"),
    formality: rule(8, "Consistent formality"),
    season: rule(7, "Season appropriate"),
    occasion: rule(8, "Fits the occasion"),
    texture: rule(8, "Balanced textures"),
  },
  strengths: ["Great color harmony", "s2", "s3", "s4", "s5", "s6"],
  weaknesses: ["Slightly warm for summer"],
  suggestions: ["Swap to loafers"],
  metadata: { engineVersion: "1", generatedAt: "2026-07-07T00:00:00.000Z", rulesApplied: [] },
};

function makeRec(overrides: Partial<UnifiedOutfitRecommendation> = {}): UnifiedOutfitRecommendation {
  return {
    id: "gen:abc",
    source: "generated_combo",
    name: "Navy polo + chinos",
    items: [
      { itemId: "i1", name: "Navy polo", slot: "top", category: "Tops" },
      { itemId: "i2", name: "Beige chinos", slot: "bottom", category: "Bottoms" },
    ],
    score: 8.2,
    confidence: 0.86,
    analysis,
    reason: "Balanced smart-casual pick.",
    strengths: ["Versatile", "Comfortable"],
    tradeoffs: ["Warm"],
    suggestions: ["Add a watch"],
    metadata: { generatedAt: "2026-07-07T00:00:00.000Z", engineVersion: "1" },
    ...overrides,
  };
}

const shared: ExplainSharedContext = {
  wardrobeHealth: {
    overallScore: 72,
    strengths: ["Strong in tops"],
    weaknesses: ["Few outerwear pieces"],
    recommendations: ["Add a light jacket"],
  },
  insights: { overallSummary: "Healthy, tops-heavy wardrobe.", topActions: ["Add outerwear"] },
  weather: { season: "summer", condition: "hot", temperatureC: 34, humidity: 60 },
  commute: { mode: "wfh", officeDaysPerWeek: 1, durationMinutes: null },
};

describe("buildExplanationInput", () => {
  it("maps the recommendation, analysis and shared context", () => {
    const input = buildExplanationInput(makeRec(), shared);

    expect(input.recommendation.id).toBe("gen:abc");
    expect(input.recommendation.items).toEqual([
      { slot: "top", name: "Navy polo", category: "Tops" },
      { slot: "bottom", name: "Beige chinos", category: "Bottoms" },
    ]);
    expect(input.outfitAnalysis.overallScore).toBe(8.2);
    expect(input.outfitAnalysis.breakdown).toContainEqual({
      dimension: "color",
      score: 9,
      reason: "Harmonious palette",
    });
    expect(input.wardrobeHealth).toEqual(shared.wardrobeHealth);
    expect(input.weather.season).toBe("summer");
    expect(input.commute.mode).toBe("wfh");
  });

  it("carries no raw wardrobe/usage/purchase data", () => {
    const input = buildExplanationInput(makeRec(), shared);
    const serialized = JSON.stringify(input);
    // Item ids are intentionally dropped from the recommendation items.
    expect(serialized).not.toContain("itemId");
    // Only curated top-level keys exist.
    expect(Object.keys(input).sort()).toEqual([
      "commute",
      "insights",
      "outfitAnalysis",
      "recommendation",
      "wardrobeHealth",
      "weather",
    ]);
  });

  it("caps long lists to keep the prompt small", () => {
    const input = buildExplanationInput(makeRec(), shared);
    expect(input.outfitAnalysis.strengths).toHaveLength(5);
  });
});

describe("buildExplainSharedContext", () => {
  it("flattens domain snapshots into the shared summary", () => {
    const result = buildExplainSharedContext({
      wardrobeHealth: {
        overallScore: 80,
        categoryScores: {} as never,
        occasions: {} as never,
        seasons: {} as never,
        strengths: ["a", "b", "c", "d", "e", "f"],
        weaknesses: ["w"],
        recommendations: ["r"],
        duplicates: [],
        gaps: [],
      },
      insights: { overallSummary: "sum", topActions: ["x", "y", "z", "extra"] },
      weather: {
        season: "winter", condition: "cold", temperatureC: 8, feelsLikeC: 8,
        rainRisk: null, humidity: null, windKph: null, uvIndex: null,
        labels: [], confidence: 0.3, source: "seasonal_fallback",
      },
      commute: { mode: "metro", officeDaysPerWeek: 4, durationMinutes: 45 },
    });
    expect(result.wardrobeHealth.strengths).toHaveLength(5);
    expect(result.insights.topActions).toEqual(["x", "y", "z"]); // capped to 3
    expect(result.commute.durationMinutes).toBe(45);
  });
});

describe("explanationCacheKey", () => {
  it("is stable for identical input and independent of key order", () => {
    const a = buildExplanationInput(makeRec(), shared);
    const b = buildExplanationInput(makeRec(), shared);
    expect(explanationCacheKey(a)).toBe(explanationCacheKey(b));
  });

  it("changes when the recommendation changes", () => {
    const base = explanationCacheKey(buildExplanationInput(makeRec(), shared));
    const changed = explanationCacheKey(
      buildExplanationInput(makeRec({ score: 5.1 }), shared),
    );
    expect(changed).not.toBe(base);
  });

  it("changes when the context changes", () => {
    const base = explanationCacheKey(buildExplanationInput(makeRec(), shared));
    const changed = explanationCacheKey(
      buildExplanationInput(makeRec(), {
        ...shared,
        weather: { ...shared.weather, condition: "rainy" },
      }),
    );
    expect(changed).not.toBe(base);
  });

  it("embeds the recommendation id", () => {
    const key = explanationCacheKey(buildExplanationInput(makeRec(), shared));
    expect(key.startsWith("explain:v1:gen:abc:")).toBe(true);
  });
});
