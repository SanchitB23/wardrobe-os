import { describe, expect, it, vi } from "vitest";

import { ParseError } from "@/ai/types";
import type { AIRuntime, AIRuntimeRequest, AIRuntimeResult } from "@/runtime/ai";
import type { ExplanationInput } from "@/features/recommendations/ai/explanation.types";
import { explainRecommendation } from "@/features/recommendations/services/recommendation-explanation.service";

const input: ExplanationInput = {
  recommendation: {
    id: "gen:abc",
    name: "Navy polo + chinos",
    source: "generated_combo",
    score: 8.2,
    confidence: 0.86,
    reason: "Balanced.",
    strengths: [],
    tradeoffs: [],
    suggestions: [],
    items: [{ slot: "top", name: "Navy polo", category: "Tops" }],
  },
  outfitAnalysis: {
    overallScore: 8.2,
    confidence: 0.86,
    summary: "Cohesive.",
    breakdown: [],
    strengths: [],
    weaknesses: [],
    suggestions: [],
  },
  wardrobeHealth: { overallScore: 72, strengths: [], weaknesses: [], recommendations: [] },
  insights: { overallSummary: "Healthy.", topActions: [] },
  weather: { season: "summer", condition: "hot", temperatureC: 34, humidity: 60 },
  commute: { mode: "wfh", officeDaysPerWeek: 1, durationMinutes: null },
};

const validJson = JSON.stringify({
  summary: "A crisp look.",
  whyThisWorks: "Balanced palette.",
  stylingTips: ["Cuff the chinos."],
  confidenceExplanation: "High color harmony.",
  thingsToAvoid: ["Bulky sneakers."],
});

/**
 * Fake AIRuntime that mirrors production: parser validates canned text and
 * attaches `parsed` (or throws ParseError).
 */
function fakeRuntime(text: string, cached = false): Pick<AIRuntime, "run"> {
  return {
    async run<T>(req: AIRuntimeRequest<T>): Promise<AIRuntimeResult<T>> {
      const base = {
        text,
        provider: "gemini" as const,
        model: "fake",
        finishReason: "stop" as const,
        cached,
        capability: req.capability,
        promptVersion: "adhoc",
        servedBy: "gemini" as const,
        usedFallback: false,
        costUsd: 0,
      };
      if (req.parser) {
        const result = req.parser.parse(text);
        if (!result.ok) throw new ParseError(result.errors);
        return { ...base, parsed: result.data } as AIRuntimeResult<T>;
      }
      return base as AIRuntimeResult<T>;
    },
  };
}

describe("explainRecommendation", () => {
  it("returns the validated explanation", async () => {
    const result = await explainRecommendation(input, { runtime: fakeRuntime(validJson) });
    expect(result.explanation.summary).toBe("A crisp look.");
    expect(result.explanation.stylingTips).toEqual(["Cuff the chinos."]);
    expect(result.explanation.thingsToAvoid).toEqual(["Bulky sneakers."]);
    expect(result.cached).toBe(false);
  });

  it("passes a parser and a 7-day cache descriptor to AIRuntime", async () => {
    const runtime = fakeRuntime(validJson);
    const spy = vi.spyOn(runtime, "run");
    await explainRecommendation(input, { runtime });

    const [req] = spy.mock.calls[0];
    expect(req.capability).toBe("explanation");
    expect(req.request?.responseFormat).toBe("json");
    expect(req.parser).toBeDefined();
    expect(req.cache?.promptBuilder).toBe("recommendation-explanation");
    expect(req.cache?.promptVersion).toBe("v1");
    expect(req.cache?.input).toBe(input);
    expect(req.cache?.ttlSeconds).toBe(7 * 24 * 60 * 60);
  });

  it("forwards forceRefresh to bypass the cache", async () => {
    const runtime = fakeRuntime(validJson);
    const spy = vi.spyOn(runtime, "run");
    await explainRecommendation(input, { runtime, forceRefresh: true });
    expect(spy.mock.calls[0][0].forceRefresh).toBe(true);
  });

  it("throws (for graceful fallback) when the model returns invalid JSON", async () => {
    await expect(
      explainRecommendation(input, { runtime: fakeRuntime("sorry, no json here") }),
    ).rejects.toBeInstanceOf(ParseError);
  });

  it("propagates provider failures", async () => {
    const failing: Pick<AIRuntime, "run"> = {
      async run() {
        throw new Error("provider down");
      },
    };
    await expect(explainRecommendation(input, { runtime: failing })).rejects.toThrow(
      "provider down",
    );
  });
});
