import { describe, expect, it } from "vitest";

import {
  buildRecommendationContext,
  RecommendationContextBuilder,
  type WardrobeItemInput,
} from "@/domain/recommendation/RecommendationContextBuilder";
import {
  DEFAULT_COMMUTE,
  DEFAULT_PREFERENCES,
} from "@/domain/recommendation/RecommendationContext";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";

const GENERATED_AT = "2026-07-05T00:00:00.000Z"; // July → monsoon

function health(overrides: Partial<WardrobeHealth> = {}): WardrobeHealth {
  return {
    overallScore: 92,
    categoryScores: {
      tops: 90,
      bottoms: 90,
      footwear: 90,
      outerwear: 90,
      accessories: 90,
      fragrance: 90,
    } as WardrobeHealth["categoryScores"],
    occasions: {
      officeDaily: 90,
      smartCasual: 90,
      travel: 90,
      social: 90,
      formal: 80,
      gym: 90,
      home: 90,
    } as WardrobeHealth["occasions"],
    seasons: { summer: 90, transitional: 90, winter: 90 } as WardrobeHealth["seasons"],
    strengths: ["Strong tops coverage."],
    weaknesses: [],
    recommendations: ["Add a navy knit polo."],
    duplicates: [],
    gaps: [],
    ...overrides,
  };
}

function item(overrides: Partial<WardrobeItemInput> = {}): WardrobeItemInput {
  return {
    id: "i1",
    name: "Item",
    category: "Top",
    color: "Navy",
    status: "active",
    ...overrides,
  };
}

/** N days before GENERATED_AT as a YYYY-MM-DD string. */
function daysAgo(days: number): string {
  const date = new Date(new Date(GENERATED_AT).getTime() - days * 86400000);
  return date.toISOString().slice(0, 10);
}

function build(input: Parameters<typeof buildRecommendationContext>[0]) {
  return buildRecommendationContext(input, { generatedAt: GENERATED_AT });
}

describe("buildRecommendationContext", () => {
  it("assembles the wardrobe snapshot with active filtering and colour families", () => {
    const ctx = build({
      health: health(),
      wardrobeItems: [
        item({ id: "b", color: "Charcoal", brand: "Uniqlo" }),
        item({ id: "a", color: "Navy", brand: "COS" }),
        item({ id: "c", status: "retired", color: "Black" }),
      ],
    });

    // Sorted by id.
    expect(ctx.wardrobe.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(ctx.wardrobe.totalCount).toBe(3);
    expect(ctx.wardrobe.activeCount).toBe(2);
    expect(ctx.wardrobe.activeItems.map((i) => i.id)).toEqual(["a", "b"]);
    // Colour family derived; retired item's black excluded from active facets.
    expect(ctx.wardrobe.colorFamilies).toEqual(["grey", "navy"]);
    expect(ctx.wardrobe.brands).toEqual(["COS", "Uniqlo"]);
  });

  it("builds per-item usage, never-worn, and stale ids relative to generatedAt", () => {
    const ctx = build({
      health: health(),
      wardrobeItems: [
        item({ id: "worn" }),
        item({ id: "stale" }),
        item({ id: "never" }),
      ],
      wearLogs: [
        { itemId: "worn", wornOn: daysAgo(5) },
        { itemId: "worn", wornOn: daysAgo(10) },
        { itemId: "stale", wornOn: daysAgo(120) },
      ],
    });

    expect(ctx.usage.totalWears).toBe(3);
    expect(ctx.usage.wearCountByItem).toEqual({ worn: 2, stale: 1 });
    expect(ctx.usage.neverWornItemIds).toEqual(["never"]);
    expect(ctx.usage.staleItemIds).toEqual(["stale"]);

    const worn = ctx.usage.perItem.find((p) => p.itemId === "worn");
    expect(worn?.daysSinceLastWorn).toBe(5);
    expect(worn?.lastWornOn).toBe(daysAgo(5));
  });

  it("builds the purchase snapshot with highest price per item", () => {
    const ctx = build({
      health: health(),
      wardrobeItems: [item({ id: "a" }), item({ id: "b" })],
      purchases: [
        { itemId: "a", price: 1000 },
        { itemId: "a", price: 1500 }, // higher wins
        { itemId: "b", price: null }, // ignored
      ],
    });
    expect(ctx.purchase.priceByItem).toEqual({ a: 1500 });
    expect(ctx.purchase.trackedItemIds).toEqual(["a"]);
    expect(ctx.purchase.totalTrackedValue).toBe(1500);
  });

  it("copies the health snapshot from the health report", () => {
    const ctx = build({ health: health({ overallScore: 77 }) });
    expect(ctx.health.overallScore).toBe(77);
    expect(ctx.health.occasions.officeDaily).toBe(90);
    expect(ctx.health.recommendations).toEqual(["Add a navy knit polo."]);
  });

  it("applies defaults and merges overrides for preferences and commute", () => {
    const defaults = build({ health: health() });
    expect(defaults.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(defaults.commute).toEqual(DEFAULT_COMMUTE);

    const overridden = build({
      health: health(),
      preferences: { lifestyle: "wfh", monthlyBudget: 5000 },
      commute: { mode: "wfh", officeDaysPerWeek: 0 },
    });
    expect(overridden.preferences.lifestyle).toBe("wfh");
    expect(overridden.preferences.monthlyBudget).toBe(5000);
    // Untouched defaults preserved.
    expect(overridden.preferences.climate).toBe("delhi-ncr");
    expect(overridden.commute.mode).toBe("wfh");
    expect(overridden.commute.durationMinutes).toBe(DEFAULT_COMMUTE.durationMinutes);
  });

  it("derives the weather season from the month, honoring overrides", () => {
    const july = build({ health: health() }); // monsoon
    expect(july.weather.season).toBe("monsoon");
    expect(july.weather.condition).toBe("rainy");

    const december = buildRecommendationContext(
      { health: health() },
      { generatedAt: "2026-12-15T00:00:00.000Z" },
    );
    expect(december.weather.season).toBe("winter");

    const overridden = build({
      health: health(),
      weather: { temperatureC: 40, condition: "hot" },
    });
    expect(overridden.weather.season).toBe("monsoon"); // still derived
    expect(overridden.weather.temperatureC).toBe(40);
    expect(overridden.weather.condition).toBe("hot");
  });

  it("maps saved outfits, sorted by id", () => {
    const ctx = build({
      health: health(),
      savedOutfits: [
        { id: "o2", name: "Friday", itemIds: ["a", "b"], favorite: true },
        { id: "o1", name: "Office", itemIds: ["c"], score: 8.2 },
      ],
    });
    expect(ctx.savedOutfits.count).toBe(2);
    expect(ctx.savedOutfits.outfits.map((o) => o.id)).toEqual(["o1", "o2"]);
    expect(ctx.savedOutfits.outfits[0]).toMatchObject({
      name: "Office",
      score: 8.2,
      favorite: false,
    });
  });

  it("stamps the injected generatedAt and is deterministic", () => {
    const input = {
      health: health(),
      wardrobeItems: [item({ id: "a" })],
      wearLogs: [{ itemId: "a", wornOn: daysAgo(3) }],
    };
    const a = build(input);
    const b = build(input);
    expect(a.generatedAt).toBe(GENERATED_AT);
    expect(a).toEqual(b);
  });

  it("produces an empty-but-valid context with no data beyond health", () => {
    const ctx = build({ health: health() });
    expect(ctx.wardrobe.items).toEqual([]);
    expect(ctx.usage.totalWears).toBe(0);
    expect(ctx.purchase.trackedItemIds).toEqual([]);
    expect(ctx.savedOutfits.count).toBe(0);
    expect(ctx.usage.analytics).toBeNull();
  });
});

describe("RecommendationContextBuilder (fluent)", () => {
  it("produces the same context as the pure function", () => {
    const items = [item({ id: "a" }), item({ id: "b", status: "retired" })];
    const wearLogs = [{ itemId: "a", wornOn: daysAgo(2) }];
    const h = health();

    const fromFn = buildRecommendationContext(
      { health: h, wardrobeItems: items, wearLogs },
      { generatedAt: GENERATED_AT },
    );
    const fromBuilder = new RecommendationContextBuilder()
      .withHealth(h)
      .withWardrobeItems(items)
      .withWearLogs(wearLogs)
      .build({ generatedAt: GENERATED_AT });

    expect(fromBuilder).toEqual(fromFn);
  });

  it("carries a neutral health default until withHealth is called", () => {
    const ctx = new RecommendationContextBuilder().build({
      generatedAt: GENERATED_AT,
    });
    expect(ctx.health.overallScore).toBe(0);
    expect(ctx.weather.season).toBe("monsoon");
  });
});
