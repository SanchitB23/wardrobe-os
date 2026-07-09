import { describe, expect, it, vi } from "vitest";

import { planLifestyle } from "@/domain/lifestyle/LifestyleEngine";
import { eachDateInclusive, expandTripDays } from "@/domain/lifestyle/TripPlanner";
import { toWeatherSnapshot } from "@/domain/lifestyle/WeatherPlanner";
import type {
  LifestyleInput,
  OrchestrateFn,
  WeatherForecast,
} from "@/domain/lifestyle/types";
import type { CapabilityId, ExecutionReport } from "@/domain/orchestrator";
import type { RecommendationContext } from "@/domain/recommendation";
import type { UnifiedOutfitRecommendation } from "@/domain/recommendation";
import type { BuyVsSkipAnalysis } from "@/domain/acquisition";
import type { StyleDNAItem } from "@/domain/style-dna";

const AT = "2026-07-08T00:00:00.000Z";
const fakeClock = () => 1;

function mkReport(cap: CapabilityId, output: unknown): ExecutionReport {
  return {
    executedCapabilities: [cap],
    skippedCapabilities: [],
    failedCapabilities: [],
    executionOrder: [cap],
    dependencyGraph: {},
    timings: { [cap]: 1, __total: 1 },
    confidence: null,
    outcomes: {
      [cap]: { id: cap, status: "executed", output, confidence: null, durationMs: 1 },
    } as ExecutionReport["outcomes"],
    explainability: [],
    metadata: { orchestratorVersion: "1.0.0", generatedAt: AT, totalDurationMs: 1, capabilityCount: 1 },
  };
}

const rec = (itemIds: string[]): UnifiedOutfitRecommendation =>
  ({
    id: "r1",
    source: "generated_combo",
    name: "Pick",
    items: itemIds.map((id) => ({ itemId: id, slot: "top", name: id, category: "Top" })),
    score: 8,
    confidence: 0.8,
    reason: "Balanced pairing.",
  }) as unknown as UnifiedOutfitRecommendation;

const buyVsSkip: BuyVsSkipAnalysis = {
  decision: "consider",
  score: 60,
  confidence: 0.5,
} as unknown as BuyVsSkipAnalysis;

/** Orchestrator stub: recommendation → given items; acquisition → a verdict. */
function stubOrchestrate(recItemIds: string[] | null): OrchestrateFn {
  return (request) => {
    const cap = request.capabilities[0];
    if (cap === "recommendation") return mkReport("recommendation", recItemIds ? [rec(recItemIds)] : []);
    if (cap === "acquisition") return mkReport("acquisition", buyVsSkip);
    return mkReport(cap, null);
  };
}

function wardrobe(): StyleDNAItem[] {
  return [
    { id: "t1", name: "Navy Tee", category: "T-Shirt", rating: 9 },
    { id: "b1", name: "Chinos", category: "Trousers", rating: 8 },
    { id: "f1", name: "Sneakers", category: "Sneakers", rating: 7 },
    { id: "x1", name: "Spare Shirt", category: "Shirt", rating: 6 },
  ];
}

function forecast(dates: string[]): WeatherForecast {
  return {
    source: "forecast",
    days: dates.map((date) => ({ date, season: "summer", condition: "warm", highC: 30, lowC: 22, rainRisk: 0.1 })),
  };
}

function input(overrides: Partial<LifestyleInput> = {}): LifestyleInput {
  const dates = eachDateInclusive("2026-08-01", "2026-08-03");
  return {
    trip: {
      destination: "Bangalore",
      startDate: "2026-08-01",
      endDate: "2026-08-03",
      events: [{ date: "2026-08-02", occasion: "Office" }],
      travelStyle: "standard",
      laundry: { available: false },
      luggage: { kind: "unbounded" },
    },
    forecast: forecast(dates),
    recommendation: {} as unknown as RecommendationContext,
    wardrobe: wardrobe(),
    preferences: null,
    ...overrides,
  };
}

const plan = (over: Partial<LifestyleInput> = {}, opts = {}) =>
  planLifestyle(input(over), { generatedAt: AT, orchestrate: stubOrchestrate(["t1", "b1"]), clock: fakeClock, ...opts });

describe("TripPlanner — expansion", () => {
  it("expands inclusive dates and attaches events + weather", () => {
    const days = expandTripDays(input().trip, input().forecast);
    expect(days.map((d) => d.date)).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
    expect(days[1].occasion).toBe("Office"); // event day
    expect(days[0].occasion).toBe("Casual"); // default
    expect(days[0].weather.condition).toBe("warm");
  });
});

describe("WeatherPlanner — normalization", () => {
  it("averages high/low into a temperature snapshot", () => {
    const snap = toWeatherSnapshot({ date: "d", season: "winter", condition: "cold", highC: 10, lowC: 4, rainRisk: 0 });
    // RFC-011: enriched snapshot — assert the core projected fields.
    expect(snap.season).toBe("winter");
    expect(snap.condition).toBe("cold");
    expect(snap.temperatureC).toBe(7);
    expect(snap.labels).toContain("COLD");
    expect(snap.source).toBe("live");
  });
});

describe("planLifestyle — composition through the orchestrator", () => {
  it("requests the recommendation capability per day (never a direct engine call)", () => {
    const spy = vi.fn(stubOrchestrate(["t1", "b1"]));
    planLifestyle(input(), { generatedAt: AT, orchestrate: spy, clock: fakeClock });
    const recCalls = spy.mock.calls.filter((c) => c[0].capabilities.includes("recommendation"));
    expect(recCalls).toHaveLength(3); // one per trip day
    expect(recCalls[0][0].inputs?.occasion).toBeDefined();
  });

  it("produces daily outfits, a capsule, and a packing list", () => {
    const p = plan();
    expect(p.tripPlan.dailyOutfits).toHaveLength(3);
    expect(p.tripPlan.dailyOutfits.every((o) => !o.uncovered)).toBe(true);
    expect(p.tripPlan.capsule.itemCount).toBe(2); // t1 + b1 reused across days
    expect(p.packingPlan.packingList.itemIds).toContain("t1");
    expect(p.packingPlan.packingConfidence).toBe(1);
  });

  it("every day uncovered when the orchestrator returns no recommendation", () => {
    const p = planLifestyle(input(), { generatedAt: AT, orchestrate: stubOrchestrate(null), clock: fakeClock });
    expect(p.tripPlan.dailyOutfits.every((o) => o.uncovered)).toBe(true);
    expect(p.warnings.length).toBeGreaterThan(0);
    expect(p.planScore).toBeLessThan(50);
  });
});

describe("planLifestyle — packing / luggage", () => {
  it("trims to the carry-on cap and reports it (withinLuggage + tradeoff)", () => {
    const p = plan({ trip: { ...input().trip, luggage: { kind: "carry_on", maxItems: 1 } } });
    expect(p.packingPlan.packingList.count).toBe(1);
    expect(p.packingPlan.packingList.withinLuggage).toBe(true);
    expect(p.packingPlan.packingConfidence).toBeLessThan(1); // a day is no longer fully packable
    expect(p.tradeoffs).toContain("Carry-on → reduced outfit variety.");
  });

  it("business strategy records its trade-off", () => {
    const p = plan({}, { strategy: "business" });
    expect(p.tradeoffs).toContain("Business → higher packing count.");
  });
});

describe("planLifestyle — laundry", () => {
  it("flags laundry when the trip outlasts clean clothes and none is available", () => {
    const dates = eachDateInclusive("2026-08-01", "2026-08-08");
    const p = planLifestyle(
      input({
        trip: {
          ...input().trip,
          endDate: "2026-08-08",
          laundry: { available: false },
          luggage: { kind: "carry_on", maxItems: 2 },
        },
        forecast: forecast(dates),
      }),
      { generatedAt: AT, orchestrate: stubOrchestrate(["t1", "b1"]), clock: fakeClock },
    );
    expect(p.laundryPlan.schedule.needed).toBe(true);
    expect(p.laundryPlan.schedule.washOn).toEqual([]); // unavailable → warned, not scheduled
    expect(p.warnings.some((w) => /laundry/i.test(w))).toBe(true);
  });
});

describe("planLifestyle — shopping via acquisition capability", () => {
  it("turns uncovered needs into buy/skip suggestions (through the orchestrator)", () => {
    const spy = vi.fn(stubOrchestrate(null)); // no outfits → uncovered → missing
    const p = planLifestyle(input(), { generatedAt: AT, orchestrate: spy, clock: fakeClock });
    expect(p.shoppingPlan.missingItems.length).toBeGreaterThan(0);
    expect(p.shoppingPlan.shoppingSuggestions[0].analysis.decision).toBe("consider");
    expect(spy.mock.calls.some((c) => c[0].capabilities.includes("acquisition"))).toBe(true);
  });
});

describe("planLifestyle — score, confidence, determinism", () => {
  it("scores a fully-covered trip highly and carries metadata", () => {
    const p = plan();
    expect(p.planScore).toBeGreaterThan(60);
    expect(p.confidence).toBeGreaterThan(0.5);
    expect(p.metadata).toMatchObject({ destination: "Bangalore", days: 3, strategy: "balanced", weatherSource: "forecast" });
  });

  it("is deterministic for the same input + generatedAt", () => {
    expect(plan()).toEqual(plan());
  });
});
