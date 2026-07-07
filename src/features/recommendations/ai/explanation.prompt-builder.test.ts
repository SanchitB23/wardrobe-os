import { describe, expect, it } from "vitest";

import { recommendationExplanationPromptBuilder } from "@/features/recommendations/ai/explanation.prompt-builder";
import type { ExplanationInput } from "@/features/recommendations/ai/explanation.types";

const input: ExplanationInput = {
  recommendation: {
    id: "gen:abc",
    name: "Navy polo + chinos",
    source: "generated_combo",
    score: 8.2,
    confidence: 0.86,
    reason: "Balanced smart-casual pick.",
    strengths: ["Versatile"],
    tradeoffs: ["Warm"],
    suggestions: ["Add a watch"],
    items: [{ slot: "top", name: "Navy polo", category: "Tops" }],
  },
  outfitAnalysis: {
    overallScore: 8.2,
    confidence: 0.86,
    summary: "Cohesive.",
    breakdown: [{ dimension: "color", score: 9, reason: "harmonious" }],
    strengths: [],
    weaknesses: [],
    suggestions: [],
  },
  wardrobeHealth: {
    overallScore: 72,
    strengths: ["Strong tops"],
    weaknesses: [],
    recommendations: [],
  },
  insights: { overallSummary: "Healthy.", topActions: [] },
  weather: { season: "summer", condition: "hot", temperatureC: 34, humidity: 60 },
  commute: { mode: "wfh", officeDaysPerWeek: 1, durationMinutes: null },
};

describe("recommendationExplanationPromptBuilder", () => {
  it("includes exactly the six required sections", () => {
    const built = recommendationExplanationPromptBuilder.build({
      task: "recommendation-explanation",
      data: { input },
    });
    for (const section of [
      "RECOMMENDATION:",
      "OUTFIT ANALYSIS:",
      "WARDROBE HEALTH SUMMARY:",
      "INSIGHT SUMMARY:",
      "WEATHER:",
      "COMMUTE:",
    ]) {
      expect(built.prompt).toContain(section);
    }
  });

  it("instructs the model to explain, not decide, and return JSON", () => {
    const built = recommendationExplanationPromptBuilder.build({
      task: "recommendation-explanation",
      data: { input },
    });
    expect(built.system).toMatch(/explain/i);
    expect(built.system).toMatch(/do NOT change it|do NOT pick different/i);
    // Schema instructions are appended to the prompt by the builder.
    expect(built.prompt).toMatch(/JSON/i);
    expect(built.schema?.name).toBe("RecommendationExplanation");
  });

  it("passes the recommendation content through", () => {
    const built = recommendationExplanationPromptBuilder.build({
      task: "recommendation-explanation",
      data: { input },
    });
    expect(built.prompt).toContain("Navy polo");
  });
});
