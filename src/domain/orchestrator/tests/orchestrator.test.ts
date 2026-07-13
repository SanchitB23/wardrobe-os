import { describe, expect, it } from "vitest";

import {
  buildDependencyGraph,
  createCapabilityRegistry,
  createExecutionContext,
  DEFAULT_CAPABILITY_REGISTRY,
  DependencyCycleError,
  orchestrate,
  planExecution,
  resolveExecutionOrder,
  UnknownCapabilityError,
  type CapabilityDefinition,
  type CapabilityRegistry,
  type ExecutionContext,
} from "@/domain/orchestrator";
import { buildRecommendationContext } from "@/domain/recommendation";
import type { WardrobeItemInput } from "@/domain/recommendation/RecommendationContextBuilder";
import type { StyleDNAItem } from "@/domain/style-dna";

const AT = "2026-07-08T00:00:00.000Z";

/** A deterministic, monotonically-increasing clock for timing assertions. */
function fakeClock(step = 5): () => number {
  let t = 0;
  return () => {
    const now = t;
    t += step;
    return now;
  };
}

// ---------------------------------------------------------------------------
// Mechanics — a custom registry of trivial capabilities (no real engines).
// ---------------------------------------------------------------------------

function def(
  id: CapabilityDefinition["id"],
  dependsOn: CapabilityDefinition["dependsOn"],
  run: CapabilityDefinition["run"],
  confidenceOf?: CapabilityDefinition["confidenceOf"],
): CapabilityDefinition {
  return { id, dependsOn, run, confidenceOf };
}

/** health → usage → analytics → recommendation-ish chain, plus a leaf. */
function mechanicsRegistry(overrides: Partial<Record<string, CapabilityDefinition>> = {}): CapabilityRegistry {
  const base: CapabilityDefinition[] = [
    def("health", [], () => "H"),
    def("usage", [], () => "U"),
    def("analytics", ["health", "usage"], () => "A", () => 0.8),
    def("recommendation", ["analytics"], () => "R", () => 0.6),
    def("personalization", [], () => "prefs"),
    def("vision", [], () => ({ item: { name: "Navy Polo" } })),
    def("acquisition", ["personalization"], (ctx) => ctx.upstream.vision ?? "no-vision"),
  ];
  return createCapabilityRegistry(base.map((d) => overrides[d.id] ?? d));
}

const emptyContext = (): ExecutionContext =>
  createExecutionContext({
    // The mechanics registry never reads the context, so a stub is fine.
    recommendation: { generatedAt: AT } as never,
    generatedAt: AT,
  });

describe("ExecutionGraph — dependency resolution", () => {
  it("expands transitive dependencies", () => {
    const graph = buildDependencyGraph(["recommendation"], mechanicsRegistry());
    expect(Object.keys(graph).sort()).toEqual(["analytics", "health", "recommendation", "usage"]);
    expect(graph.recommendation).toEqual(["analytics"]);
    expect(graph.analytics).toEqual(["health", "usage"]);
  });

  it("resolves a deterministic, dependency-respecting order", () => {
    const graph = buildDependencyGraph(["recommendation"], mechanicsRegistry());
    const order = resolveExecutionOrder(graph);
    // health/usage (alphabetical) before analytics before recommendation.
    expect(order).toEqual(["health", "usage", "analytics", "recommendation"]);
  });

  it("detects cycles instead of looping forever", () => {
    const cyclic = createCapabilityRegistry([
      def("health", ["usage"], () => 1),
      def("usage", ["health"], () => 2),
    ]);
    expect(() => planExecution({ capabilities: ["health"] }, cyclic)).toThrow(DependencyCycleError);
  });

  it("rejects unknown / unregistered capabilities", () => {
    expect(() => planExecution({ capabilities: ["travel"] }, DEFAULT_CAPABILITY_REGISTRY)).toThrow(
      UnknownCapabilityError,
    );
  });
});

describe("orchestrate — execution + report", () => {
  it("executes capabilities in order and reports them", () => {
    const report = orchestrate({ capabilities: ["recommendation"] }, emptyContext(), {
      registry: mechanicsRegistry(),
      clock: fakeClock(),
    });
    expect(report.executionOrder).toEqual(["health", "usage", "analytics", "recommendation"]);
    expect(report.executedCapabilities).toEqual(["health", "usage", "analytics", "recommendation"]);
    expect(report.failedCapabilities).toEqual([]);
    expect(report.skippedCapabilities).toEqual([]);
    expect(report.outcomes.recommendation.output).toBe("R");
    expect(report.metadata.orchestratorVersion).toBeTruthy();
  });

  it("threads upstream outputs to dependents (vision → acquisition)", () => {
    const report = orchestrate({ capabilities: ["vision", "acquisition"] }, emptyContext(), {
      registry: mechanicsRegistry(),
      clock: fakeClock(),
    });
    // vision runs before acquisition; acquisition receives its output.
    expect(report.executionOrder.indexOf("vision")).toBeLessThan(
      report.executionOrder.indexOf("acquisition"),
    );
    expect(report.outcomes.acquisition.output).toEqual({ item: { name: "Navy Polo" } });
  });

  it("isolates failures: a failed capability skips its dependents, siblings still run", () => {
    const registry = mechanicsRegistry({
      usage: def("usage", [], () => {
        throw new Error("usage boom");
      }),
    });
    const report = orchestrate({ capabilities: ["recommendation"] }, emptyContext(), {
      registry,
      clock: fakeClock(),
    });
    expect(report.failedCapabilities).toEqual(["usage"]);
    expect(report.outcomes.usage.error).toContain("boom");
    // analytics depends on usage → skipped; recommendation depends on analytics → skipped.
    expect(report.skippedCapabilities.sort()).toEqual(["analytics", "recommendation"]);
    expect(report.outcomes.analytics.skippedBecause).toBe("usage");
    expect(report.outcomes.recommendation.skippedBecause).toBe("analytics");
    // health is independent → still executed.
    expect(report.executedCapabilities).toContain("health");
  });

  it("aggregates confidence and timings", () => {
    const report = orchestrate({ capabilities: ["recommendation"] }, emptyContext(), {
      registry: mechanicsRegistry(),
      clock: fakeClock(5),
    });
    // analytics (0.8) + recommendation (0.6) reported → mean 0.7.
    expect(report.confidence).toBeCloseTo(0.7, 5);
    // Each capability took one clock step (5ms); total = 4 × 5.
    expect(report.timings.recommendation).toBe(5);
    expect(report.metadata.totalDurationMs).toBe(20);
    expect(report.explainability.some((line) => line.startsWith("Ran recommendation"))).toBe(true);
  });

  it("is deterministic given an injected clock", () => {
    const run = () =>
      orchestrate({ capabilities: ["recommendation", "vision", "acquisition"] }, emptyContext(), {
        registry: mechanicsRegistry(),
        clock: fakeClock(),
      });
    expect(run()).toEqual(run());
  });
});

// ---------------------------------------------------------------------------
// Integration — the DEFAULT registry composing real engines.
// ---------------------------------------------------------------------------

describe("orchestrate — real-engine composition (default registry)", () => {
  function item(overrides: Partial<WardrobeItemInput>): WardrobeItemInput {
    return {
      id: "x",
      name: "Item",
      category: "Top",
      color: "Navy",
      formality: "smart_casual",
      usage: "regular",
      rating: 8,
      seasons: ["Year Round", "Summer"],
      styles: ["Smart Casual"],
      tags: [],
      ...overrides,
    };
  }

  it("runs the recommendation capability graph over a built context", () => {
    const recommendation = buildRecommendationContext(
      {
        health: { overallScore: 80 } as never,
        wardrobeItems: [
          item({ id: "t1", name: "Tee", category: "T-Shirt" }),
          item({ id: "b1", name: "Chinos", category: "Trousers" }),
          item({ id: "f1", name: "Sneakers", category: "Sneakers" }),
        ],
      },
      { generatedAt: AT },
    );
    const context = createExecutionContext({ recommendation, generatedAt: AT });

    const report = orchestrate({ capabilities: ["recommendation"] }, context, { clock: fakeClock() });

    // RFC-011: recommendation + outfit now depend on the `weather` capability.
    expect(report.executionOrder).toEqual([
      "personalization",
      "weather",
      "outfit",
      "recommendation",
    ]);
    expect(report.failedCapabilities).toEqual([]);
    expect(report.outcomes.weather.output).toBeTruthy(); // WeatherSnapshot surfaced
    expect(Array.isArray(report.outcomes.recommendation.output)).toBe(true);
  });

  // RFC-030: item-anchored pairing as an orchestrator capability.
  function pairingWardrobe(): StyleDNAItem[] {
    const dnaItem = (id: string, name: string, category: string): StyleDNAItem => ({
      id,
      name,
      category,
      color: "Black",
      formality: "casual",
      rating: 8,
      seasons: ["Year Round"],
      styles: ["Casual"],
      tags: [],
    });
    return [
      dnaItem("a1", "Black T-Shirt", "T-Shirt"),
      dnaItem("b1", "Beige Chino Pants", "Pants"),
      dnaItem("f1", "White Sneakers", "Sneakers"),
    ];
  }

  it("runs the pairing capability over the context wardrobe", () => {
    const context = createExecutionContext({
      recommendation: { generatedAt: AT } as never,
      wardrobe: pairingWardrobe(),
      inputs: { itemId: "a1" },
      generatedAt: AT,
    });

    const report = orchestrate({ capabilities: ["pairing"] }, context, { clock: fakeClock() });

    expect(report.executionOrder).toEqual(["pairing"]);
    expect(report.failedCapabilities).toEqual([]);
    const output = report.outcomes.pairing.output as {
      anchorItemId: string;
      outfits: unknown[];
    };
    expect(output.anchorItemId).toBe("a1");
    expect(output.outfits.length).toBeGreaterThan(0);
  });

  it("fails the pairing capability cleanly without inputs.itemId", () => {
    const context = createExecutionContext({
      recommendation: { generatedAt: AT } as never,
      wardrobe: pairingWardrobe(),
      generatedAt: AT,
    });

    const report = orchestrate({ capabilities: ["pairing"] }, context, { clock: fakeClock() });

    expect(report.failedCapabilities).toEqual(["pairing"]);
    expect(report.outcomes.pairing.error).toContain("itemId");
  });

  it("fails the pairing capability cleanly for an unknown anchor item", () => {
    const context = createExecutionContext({
      recommendation: { generatedAt: AT } as never,
      wardrobe: pairingWardrobe(),
      inputs: { itemId: "nope" },
      generatedAt: AT,
    });

    const report = orchestrate({ capabilities: ["pairing"] }, context, { clock: fakeClock() });

    expect(report.failedCapabilities).toEqual(["pairing"]);
    expect(report.outcomes.pairing.error).toContain("nope");
  });
});
