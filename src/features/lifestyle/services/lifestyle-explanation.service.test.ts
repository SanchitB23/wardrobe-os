import { describe, expect, it, vi } from "vitest";

import { lifestylePlanExplanationPromptBuilder } from "@/ai/prompt-builders/LifestylePlanExplanationPromptBuilder";
import {
  lifestylePlanExplanationParser,
  toLifestyleExplanationInput,
  type LifestylePlanExplanationInput,
} from "@/ai/schemas/LifestylePlanExplanation.schema";
import { ParseError } from "@/ai/types";
import type { LifestylePlan } from "@/domain/lifestyle";
import { explainLifestylePlan } from "@/features/lifestyle/services/LifestyleExplanationService";
import type { AIRuntime, AIRuntimeRequest, AIRuntimeResult } from "@/runtime/ai";

const input: LifestylePlanExplanationInput = {
  trip: { destination: "Bangalore", days: 3, strategy: "balanced", weatherSource: "forecast" },
  planScore: 82,
  packingConfidence: 1,
  capsule: { itemCount: 3, dayCount: 3 },
  packingCount: 3,
  dailyOutfits: [
    { date: "2026-08-01", occasion: "Office", condition: "warm", itemCount: 3, uncovered: false },
  ],
  tradeoffs: ["Carry-on → reduced outfit variety."],
  warnings: [],
  shoppingSuggestions: [],
};

const validJson = JSON.stringify({
  summary: "A tight 3-day capsule.",
  packingStrategy: "Three items rotate across all days.",
  dailyHighlights: ["Office day: smart-casual pick."],
  packingTips: ["Roll the tees."],
  tradeoffExplanation: "Carry-on keeps it light but limits variety.",
  shoppingAdvice: "Nothing missing.",
  riskAssessment: "No weather risks flagged.",
  confidenceExplanation: "Full coverage → high packing confidence.",
  travelTips: ["Wear the bulkiest shoes on the plane."],
});

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

describe("LifestylePlanExplanation — prompt builder + schema", () => {
  it("builds a decision-free prompt grounded in the curated input", () => {
    const built = lifestylePlanExplanationPromptBuilder.build({
      task: "lifestyle-plan-explanation",
      data: { input },
    });
    expect(lifestylePlanExplanationPromptBuilder.id).toBe("lifestyle-plan-explanation");
    expect(built.system).toMatch(/explain/i);
    expect(built.system).toMatch(/do not change/i);
    expect(built.prompt).toContain("Bangalore");
    expect(built.prompt).toContain("82");
  });

  it("validates a complete explanation and rejects a missing field", () => {
    expect(lifestylePlanExplanationParser.parse(validJson).ok).toBe(true);
    const missing = JSON.stringify({ summary: "x" });
    expect(lifestylePlanExplanationParser.parse(missing).ok).toBe(false);
  });

  it("maps a plan to curated input only (no item names / wardrobe)", () => {
    const plan = {
      metadata: { destination: "Goa", days: 2, strategy: "minimal", weatherSource: "manual" },
      planScore: 70,
      tradeoffs: ["Minimal → more repeats."],
      warnings: [],
      packingPlan: { packingConfidence: 0.9, packingList: { count: 4 } },
      tripPlan: {
        capsule: { itemCount: 4, dayCount: 2 },
        dailyOutfits: [
          {
            date: "2026-09-01",
            occasion: "Beach",
            weather: { condition: "hot" },
            itemIds: ["a", "b"],
            uncovered: false,
          },
        ],
      },
      shoppingPlan: {
        shoppingSuggestions: [{ need: "Rain jacket", analysis: { decision: "buy" } }],
      },
    } as unknown as LifestylePlan;

    const curated = toLifestyleExplanationInput(plan);
    expect(curated).toMatchObject({
      trip: { destination: "Goa", days: 2 },
      planScore: 70,
      packingConfidence: 0.9,
      packingCount: 4,
      shoppingSuggestions: [{ need: "Rain jacket", decision: "buy" }],
    });
    expect(curated.dailyOutfits[0]).toEqual({
      date: "2026-09-01",
      occasion: "Beach",
      condition: "hot",
      itemCount: 2,
      uncovered: false,
    });
    expect(JSON.stringify(curated)).not.toContain('"a"');
  });
});

describe("explainLifestylePlan — service", () => {
  it("returns the validated explanation (cache miss)", async () => {
    const result = await explainLifestylePlan(input, { runtime: fakeRuntime(validJson) });
    expect(result.explanation.summary).toBe("A tight 3-day capsule.");
    expect(result.explanation.travelTips).toEqual(["Wear the bulkiest shoes on the plane."]);
    expect(result.cached).toBe(false);
  });

  it("surfaces a cache hit", async () => {
    const result = await explainLifestylePlan(input, {
      runtime: fakeRuntime(validJson, true),
    });
    expect(result.cached).toBe(true);
  });

  it("passes a parser + 7-day cache descriptor keyed on the input", async () => {
    const runtime = fakeRuntime(validJson);
    const spy = vi.spyOn(runtime, "run");
    await explainLifestylePlan(input, { runtime });
    const [req] = spy.mock.calls[0];
    expect(req.capability).toBe("explanation");
    expect(req.request?.responseFormat).toBe("json");
    expect(req.parser).toBeDefined();
    expect(req.cache?.promptBuilder).toBe("lifestyle-plan-explanation");
    expect(req.cache?.promptVersion).toBe("v1");
    expect(req.cache?.input).toBe(input);
    expect(req.cache?.ttlSeconds).toBe(7 * 24 * 60 * 60);
  });

  it("forwards forceRefresh to bypass the cache", async () => {
    const runtime = fakeRuntime(validJson);
    const spy = vi.spyOn(runtime, "run");
    await explainLifestylePlan(input, { runtime, forceRefresh: true });
    expect(spy.mock.calls[0][0].forceRefresh).toBe(true);
  });

  it("throws on malformed JSON (caller degrades gracefully)", async () => {
    await expect(
      explainLifestylePlan(input, { runtime: fakeRuntime("not json") }),
    ).rejects.toBeInstanceOf(ParseError);
  });

  it("propagates provider failures (fallback happens inside AIRuntime)", async () => {
    const failing: Pick<AIRuntime, "run"> = {
      async run() {
        throw new Error("all providers down");
      },
    };
    await expect(explainLifestylePlan(input, { runtime: failing })).rejects.toThrow(
      "all providers down",
    );
  });
});
