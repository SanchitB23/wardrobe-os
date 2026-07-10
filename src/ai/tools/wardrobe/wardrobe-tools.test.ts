import { describe, expect, it, vi } from "vitest";

import { ToolExecutor } from "@/ai/tools/tool-executor";
import { validateAgainstSchema } from "@/ai/tools/json-schema";
import {
  createWardrobeToolRegistry,
  type WardrobeToolDeps,
} from "@/ai/tools/wardrobe";

const ok = <T>(data: T) => async () => ({ data, error: null });
const fail = (message: string) => async () => ({ data: null, error: new Error(message) });

function deps(overrides: Partial<WardrobeToolDeps> = {}): Partial<WardrobeToolDeps> {
  return {
    fetchOutfitRecommendations: ok({
      recommendations: [
        {
          id: "gen:1",
          name: "Navy polo + chinos",
          source: "generated_combo",
          score: 8.2,
          confidence: 0.86,
          reason: "Balanced.",
          items: [{ itemId: "i1", name: "Navy polo", slot: "top", category: "Tops" }],
          strengths: [],
          tradeoffs: [],
          suggestions: [],
          analysis: {},
          metadata: { generatedAt: "x", engineVersion: "1" },
        },
      ],
      previews: {},
      context: {},
      explainContext: {},
    }) as unknown as WardrobeToolDeps["fetchOutfitRecommendations"],
    fetchWardrobeHealth: ok({
      health: {
        overallScore: 72,
        strengths: ["Tops"],
        weaknesses: ["Outerwear"],
        recommendations: ["Add a jacket"],
        gaps: [{ label: "Rain jacket", kind: "staple", detail: "…", priority: "high" }],
        duplicates: [],
        categoryScores: {},
        occasions: {},
        seasons: {},
      },
      debug: {},
    }) as unknown as WardrobeToolDeps["fetchWardrobeHealth"],
    fetchUsageAnalytics: ok({ totalWears: 10 }) as WardrobeToolDeps["fetchUsageAnalytics"],
    fetchInsightReport: ok({
      overallSummary: "ok",
      insights: [],
      topActions: [],
      warnings: [],
      strengths: [],
    }) as WardrobeToolDeps["fetchInsightReport"],
    fetchOutfitById: ok({ id: "o1", name: "Outfit 1" }) as unknown as WardrobeToolDeps["fetchOutfitById"],
    fetchWardrobeItemDetail: ok({
      item: { id: "it1", name: "Grey tee" },
    }) as unknown as WardrobeToolDeps["fetchWardrobeItemDetail"],
    fetchWardrobeItems: ok([
      { id: "a", name: "Grey tee", formality: "casual", rating: 8, status: "active", favorite: true },
      { id: "b", name: "Blue shirt", formality: "smart_casual", rating: 7, status: "active", favorite: false },
    ]) as WardrobeToolDeps["fetchWardrobeItems"],
    fetchPurchaseAnalytics: ok({
      totalWardrobeValue: 1200,
      averageCostPerWear: 4.5,
    }) as WardrobeToolDeps["fetchPurchaseAnalytics"],
    runOrchestration: ok({
      executedCapabilities: ["recommendation"],
      skippedCapabilities: [],
      failedCapabilities: [],
      executionOrder: ["outfit", "personalization", "recommendation"],
      dependencyGraph: {},
      timings: {},
      confidence: 0.8,
      outcomes: {
        recommendation: { id: "recommendation", status: "executed", output: [], confidence: 0.8, durationMs: 1 },
      },
      explainability: ["Ran recommendation (1ms)."],
      metadata: { orchestratorVersion: "1.0.0", generatedAt: "x", totalDurationMs: 1, capabilityCount: 3 },
    }) as unknown as WardrobeToolDeps["runOrchestration"],
    ...overrides,
  };
}

describe("createWardrobeToolRegistry", () => {
  it("registers all wardrobe tools with unique names and object schemas", () => {
    const registry = createWardrobeToolRegistry(deps());
    const names = registry.list().map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "getInsights",
        "getItem",
        "getOutfit",
        "getRecommendations",
        "getShoppingAdvice",
        "getTopActions",
        "getUsageAnalytics",
        "getWardrobeHealth",
        "runIntelligence",
        "searchInventory",
      ].sort(),
    );
    for (const tool of registry.list()) {
      expect(tool.parameters.type).toBe("object");
      expect(validateAgainstSchema({}, tool.parameters).valid || tool.parameters.required?.length)
        .toBeTruthy();
    }
  });

  it("advertises Gemini + OpenAI shapes for every tool", () => {
    const registry = createWardrobeToolRegistry(deps());
    expect(registry.toGeminiFunctionDeclarations()).toHaveLength(10);
    expect(registry.toOpenAITools().every((t) => t.type === "function")).toBe(true);
  });
});

describe("wardrobe tool execution (via executor, injected fakes)", () => {
  it("getRecommendations trims and limits results", async () => {
    const executor = new ToolExecutor(createWardrobeToolRegistry(deps()));
    const result = await executor.execute({
      name: "getRecommendations",
      args: { occasion: "Office", limit: 3 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { count: number; recommendations: unknown[] };
      expect(data.count).toBe(1);
      expect(data.recommendations[0]).toMatchObject({ id: "gen:1", source: "generated_combo" });
      // trimmed: item has slot/name/category, not itemId
      expect(data.recommendations[0]).toMatchObject({
        items: [{ slot: "top", name: "Navy polo" }],
      });
    }
  });

  it("getWardrobeHealth returns the health payload", async () => {
    const executor = new ToolExecutor(createWardrobeToolRegistry(deps()));
    const result = await executor.execute({ name: "getWardrobeHealth", args: {} });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toMatchObject({ overallScore: 72 });
  });

  it("searchInventory maps filters, applies favorite filter, and limits", async () => {
    const fetchSpy = vi.fn(
      ok([
        { id: "a", name: "Grey tee", formality: "casual", rating: 8, status: "active", favorite: true },
        { id: "b", name: "Blue shirt", formality: "smart_casual", rating: 7, status: "active", favorite: false },
      ]),
    ) as unknown as WardrobeToolDeps["fetchWardrobeItems"];
    const executor = new ToolExecutor(
      createWardrobeToolRegistry(deps({ fetchWardrobeItems: fetchSpy })),
    );
    const result = await executor.execute({
      name: "searchInventory",
      args: { query: "tee", favorite: true, limit: 10 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { count: number; items: { id: string }[] };
      expect(data.items).toHaveLength(1); // only the favourite
      expect(data.items[0].id).toBe("a");
    }
    expect((fetchSpy as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      search: "tee",
    });
  });

  it("getOutfit returns { found: false } when the id is missing", async () => {
    const executor = new ToolExecutor(
      createWardrobeToolRegistry(deps({ fetchOutfitById: ok(null) as unknown as WardrobeToolDeps["fetchOutfitById"] })),
    );
    const result = await executor.execute({ name: "getOutfit", args: { outfitId: "nope" } });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ found: false });
  });

  it("getItem requires itemId (invalid_args when missing)", async () => {
    const executor = new ToolExecutor(createWardrobeToolRegistry(deps()));
    const result = await executor.execute({ name: "getItem", args: {} });
    expect(result).toMatchObject({ ok: false, code: "invalid_args" });
  });

  it("getShoppingAdvice composes gaps + spending context", async () => {
    const executor = new ToolExecutor(createWardrobeToolRegistry(deps()));
    const result = await executor.execute({ name: "getShoppingAdvice", args: { budget: 100 } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        budget: 100,
        gaps: [{ label: "Rain jacket" }],
        spendingContext: { totalWardrobeValue: 1200 },
      });
    }
  });

  it("surfaces a service error as an execution_error result", async () => {
    const executor = new ToolExecutor(
      createWardrobeToolRegistry(deps({ fetchUsageAnalytics: fail("db down") as WardrobeToolDeps["fetchUsageAnalytics"] })),
    );
    const result = await executor.execute({ name: "getUsageAnalytics", args: {} });
    expect(result).toMatchObject({ ok: false, code: "execution_error", error: "db down" });
  });
});
