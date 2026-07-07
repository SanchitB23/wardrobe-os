import { describe, expect, it, vi } from "vitest";

import { ParseError } from "@/ai/types";
import type {
  AICallOptions,
  AIRequest,
  AIResponse,
  AIService,
  AIStreamChunk,
} from "@/ai/types";
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
 * Fake AIService that mirrors the orchestrator's parser contract: if a parser
 * is supplied it validates the canned text and attaches `parsed` (or throws
 * ParseError), so the service is exercised exactly as in production — no
 * network, no key.
 */
function fakeAI(text: string): AIService {
  return {
    async generate<T>(_req: AIRequest, opts?: AICallOptions<T>): Promise<AIResponse<T>> {
      void _req;
      const base = {
        text,
        provider: "gemini" as const,
        model: "fake",
        finishReason: "stop" as const,
      };
      if (opts?.parser) {
        const result = opts.parser.parse(text);
        if (!result.ok) throw new ParseError(result.errors);
        return { ...base, parsed: result.data } as AIResponse<T>;
      }
      return base as AIResponse<T>;
    },
    async *stream(): AsyncIterable<AIStreamChunk> {
      // unused
    },
    async vision<T>(): Promise<AIResponse<T>> {
      throw new Error("not used");
    },
  };
}

describe("explainRecommendation", () => {
  it("returns the validated explanation", async () => {
    const result = await explainRecommendation(input, { ai: fakeAI(validJson) });
    expect(result.explanation.summary).toBe("A crisp look.");
    expect(result.explanation.stylingTips).toEqual(["Cuff the chinos."]);
    expect(result.explanation.thingsToAvoid).toEqual(["Bulky sneakers."]);
    expect(result.cached).toBe(false);
  });

  it("passes a parser and a 7-day cache descriptor to the AI service", async () => {
    const ai = fakeAI(validJson);
    const spy = vi.spyOn(ai, "generate");
    await explainRecommendation(input, { ai });

    const [request, options] = spy.mock.calls[0];
    expect(request.responseFormat).toBe("json");
    expect(options?.parser).toBeDefined();
    expect(options?.cache?.promptBuilder).toBe("recommendation-explanation");
    expect(options?.cache?.promptVersion).toBe("v1");
    expect(options?.cache?.input).toBe(input);
    expect(options?.cache?.ttlSeconds).toBe(7 * 24 * 60 * 60);
  });

  it("forwards forceRefresh to bypass the cache", async () => {
    const ai = fakeAI(validJson);
    const spy = vi.spyOn(ai, "generate");
    await explainRecommendation(input, { ai, forceRefresh: true });
    expect(spy.mock.calls[0][1]?.forceRefresh).toBe(true);
  });

  it("throws (for graceful fallback) when the model returns invalid JSON", async () => {
    await expect(
      explainRecommendation(input, { ai: fakeAI("sorry, no json here") }),
    ).rejects.toBeInstanceOf(ParseError);
  });

  it("propagates provider failures", async () => {
    const failing: AIService = {
      async generate() {
        throw new Error("provider down");
      },
      async *stream() {},
      async vision<T>(): Promise<AIResponse<T>> {
        throw new Error("x");
      },
    };
    await expect(explainRecommendation(input, { ai: failing })).rejects.toThrow(
      "provider down",
    );
  });
});
