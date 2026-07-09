import { describe, expect, it } from "vitest";

import { recommendV2 } from "@/domain/recommendation/v2/RecommendationEngineV2";
import { buildRecommendationContext } from "@/domain/recommendation/RecommendationContextBuilder";
import type { WardrobeItemInput } from "@/domain/recommendation/RecommendationContextBuilder";
import type {
  RecommendationContext,
  WeatherSnapshot,
} from "@/domain/recommendation/RecommendationContext";
import type { PreferenceSnapshot } from "@/domain/recommendation/RecommendationContext";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";

const GENERATED_AT = "2026-07-05T00:00:00.000Z";

function health(): WardrobeHealth {
  return {
    overallScore: 90,
    categoryScores: {
      tops: 90, bottoms: 90, footwear: 90, outerwear: 90, accessories: 90, fragrance: 90,
    } as WardrobeHealth["categoryScores"],
    occasions: {
      officeDaily: 90, smartCasual: 90, travel: 90, social: 90, formal: 80, gym: 90, home: 90,
    } as WardrobeHealth["occasions"],
    seasons: { summer: 90, transitional: 90, winter: 90 } as WardrobeHealth["seasons"],
    strengths: [], weaknesses: [], recommendations: [], duplicates: [], gaps: [],
  };
}

let counter = 0;
function item(overrides: Partial<WardrobeItemInput> = {}): WardrobeItemInput {
  counter += 1;
  return {
    id: `i${counter}`,
    name: `Item ${counter}`,
    category: "Top",
    color: "Navy",
    formality: "smart_casual",
    usage: "regular",
    rating: 8,
    seasons: ["Year Round", "Summer"],
    styles: ["Smart Casual"],
    tags: ["Casual"],
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(new Date(GENERATED_AT).getTime() - days * 86400000).toISOString().slice(0, 10);
}

type BuildInput = Parameters<typeof buildRecommendationContext>[0];

function ctx(config: {
  items: WardrobeItemInput[];
  savedOutfits?: BuildInput["savedOutfits"];
  wearLogs?: BuildInput["wearLogs"];
  preferences?: PreferenceSnapshot;
  protectedItemIds?: string[];
  avoidedItemIds?: string[];
  weather?: Partial<WeatherSnapshot>;
}): RecommendationContext {
  return buildRecommendationContext(
    {
      health: health(),
      wardrobeItems: config.items,
      savedOutfits: config.savedOutfits ?? [],
      wearLogs: config.wearLogs ?? [],
      preferences: config.preferences,
      protectedItemIds: config.protectedItemIds,
      avoidedItemIds: config.avoidedItemIds,
      weather: config.weather,
    },
    { generatedAt: GENERATED_AT },
  );
}

/** Clone a context with a patched weather snapshot (for weather-aware tests). */
function withWeather(context: RecommendationContext, override: Partial<WeatherSnapshot>): RecommendationContext {
  return { ...context, weather: { ...context.weather, ...override } };
}

/** A smart-casual wardrobe with several core options. */
function wardrobe(): WardrobeItemInput[] {
  return [
    item({ id: "polo", name: "Taupe Polo", category: "Top", subcategory: "Polo", color: "Taupe", tags: ["Office", "Casual"] }),
    item({ id: "shirt", name: "Blue Oxford Shirt", category: "Top", subcategory: "Shirt", color: "Blue", formality: "business_casual", tags: ["Office"] }),
    item({ id: "jeans", name: "Black Jeans", category: "Bottom", subcategory: "Jeans", color: "Black", tags: ["Casual"] }),
    item({ id: "chino", name: "Charcoal Chinos", category: "Bottom", subcategory: "Chinos", color: "Charcoal", tags: ["Office"] }),
    item({ id: "nb574", name: "New Balance 574", category: "Footwear", subcategory: "Sneakers", color: "Grey", tags: ["Casual"] }),
    item({ id: "loafer", name: "Brown Loafers", category: "Footwear", subcategory: "Loafers", color: "Brown", formality: "business_casual", tags: ["Office"] }),
  ];
}

const ids = (result: { recommendations: { id: string }[] }) => result.recommendations.map((r) => r.id);

describe("recommendV2 — output + determinism", () => {
  it("merges saved and generated outfits into one ranked, explainable list", () => {
    const result = recommendV2(
      ctx({ items: wardrobe(), savedOutfits: [{ id: "o1", name: "Saved", itemIds: ["polo", "jeans", "nb574"] }] }),
      { limit: 5 },
    );
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeLessThanOrEqual(5);
    expect(result.recommendations.some((r) => r.source === "saved_outfit")).toBe(true);
    expect(result.recommendations.some((r) => r.source === "generated_combo")).toBe(true);
    // Ranked by score descending.
    for (let i = 1; i < result.recommendations.length; i += 1) {
      expect(result.recommendations[i - 1].score).toBeGreaterThanOrEqual(result.recommendations[i].score);
    }
    // Every rec is fully explainable.
    for (const rec of result.recommendations) {
      expect(rec.breakdown.dimensions.length).toBe(9);
      expect(rec.constraintsPassed).toContain("no_avoided_items");
      expect(rec.metadata.engineVersion).toBe("2.0.0");
      expect(Array.isArray(rec.reasonCodes)).toBe(true);
      expect(rec.diversity.rank).toBeGreaterThan(0);
    }
  });

  it("is deterministic for the same context and options", () => {
    const config = { items: wardrobe(), savedOutfits: [{ id: "o1", name: "Saved", itemIds: ["polo", "chino", "loafer"] }] };
    const a = recommendV2(ctx(config), { occasion: "Office", limit: 5 });
    const b = recommendV2(ctx(config), { occasion: "Office", limit: 5 });
    expect(a).toEqual(b);
  });
});

describe("recommendV2 — hard constraints", () => {
  it("never recommends an outfit containing an avoided item", () => {
    const result = recommendV2(
      ctx({
        items: wardrobe(),
        savedOutfits: [{ id: "o1", name: "Saved", itemIds: ["polo", "jeans", "nb574"] }],
        avoidedItemIds: ["nb574"],
      }),
      { limit: 8 },
    );
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.every((r) => r.items.every((i) => i.itemId !== "nb574"))).toBe(true);
    // The avoided candidate is recorded as a rejection.
    expect(result.quality.rejections.some((rej) => rej.failed.includes("no_avoided_items"))).toBe(true);
  });

  it("rejects occasion-incompatible outfits (gym excludes office pieces)", () => {
    const result = recommendV2(
      ctx({
        items: [
          item({ id: "gymTee", name: "Performance Tee", category: "Top", subcategory: "T-Shirt", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
          item({ id: "gymShorts", name: "Training Shorts", category: "Bottom", subcategory: "Shorts", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
          item({ id: "runShoe", name: "Running Shoes", category: "Footwear", subcategory: "Running", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
          item({ id: "shirt", name: "Oxford Shirt", category: "Top", subcategory: "Shirt", formality: "business_casual", tags: ["Office"] }),
          item({ id: "chino", name: "Charcoal Chinos", category: "Bottom", subcategory: "Chinos", tags: ["Office"] }),
          item({ id: "loafer", name: "Brown Loafers", category: "Footwear", subcategory: "Loafers", formality: "business_casual", tags: ["Office"] }),
        ],
        savedOutfits: [{ id: "office", name: "Office look", itemIds: ["shirt", "chino", "loafer"] }],
      }),
      { occasion: "Gym", limit: 5 },
    );
    const names = result.recommendations.flatMap((r) => r.items.map((i) => i.name.toLowerCase()));
    expect(names.some((n) => /oxford shirt|chinos|loafers/.test(n))).toBe(false);
  });

  it("rejects severe weather mismatch — open footwear in heavy rain", () => {
    const base = ctx({
      items: [
        item({ id: "tee", name: "Cotton Tee", category: "Top", subcategory: "T-Shirt" }),
        item({ id: "shorts", name: "Chino Shorts", category: "Bottom", subcategory: "Shorts" }),
        item({ id: "sandal", name: "Leather Sandals", category: "Footwear", subcategory: "Sandals", rating: 9 }),
        item({ id: "sneaker", name: "Canvas Sneakers", category: "Footwear", subcategory: "Sneakers", rating: 7 }),
      ],
    });
    const rainy = withWeather(base, {
      season: "monsoon",
      condition: "rainy",
      rainRisk: 0.85,
      confidence: 0.9,
      labels: ["WARM", "RAINY", "WATERPROOF", "HUMID"],
    });
    const result = recommendV2(rainy, { limit: 8 });
    // Sandal outfits are rejected; closed-shoe outfits still surface.
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.every((r) => r.items.every((i) => i.itemId !== "sandal"))).toBe(true);
    expect(result.quality.rejections.some((rej) => rej.failed.includes("weather_compatible"))).toBe(true);
  });

  it("does NOT reject on low-confidence (seasonal fallback) weather — degrades gracefully", () => {
    const base = ctx({
      items: [
        item({ id: "tee", name: "Cotton Tee", category: "Top", subcategory: "T-Shirt" }),
        item({ id: "shorts", name: "Chino Shorts", category: "Bottom", subcategory: "Shorts" }),
        item({ id: "sandal", name: "Leather Sandals", category: "Footwear", subcategory: "Sandals" }),
      ],
    });
    const rainyLowConf = withWeather(base, {
      season: "monsoon", condition: "rainy", rainRisk: 0.85, confidence: 0.3,
      labels: ["WARM", "RAINY", "WATERPROOF"],
    });
    const result = recommendV2(rainyLowConf, { limit: 5 });
    // Sandal outfit is only penalized, not rejected — still returned.
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});

describe("recommendV2 — protected item handling", () => {
  it("does not apply the over-rotation penalty to a protected item", () => {
    // "hero" is worn far above the wardrobe average → over-rotated.
    const wearLogs = Array.from({ length: 12 }, (_, i) => ({ itemId: "hero", wornOn: daysAgo(30 + i) }));
    const items = [
      item({ id: "hero", name: "Hero Tee", category: "Top", subcategory: "T-Shirt" }),
      item({ id: "jeans", name: "Black Jeans", category: "Bottom", subcategory: "Jeans" }),
      item({ id: "loafer", name: "Brown Loafers", category: "Footwear", subcategory: "Loafers" }),
    ];
    const findHero = (protectedIds: string[]) => {
      const result = recommendV2(ctx({ items, wearLogs, protectedItemIds: protectedIds }), { limit: 5 });
      return result.recommendations.find((r) => r.items.some((i) => i.itemId === "hero"));
    };
    const unprotected = findHero([]);
    const protectedRec = findHero(["hero"]);
    expect(unprotected).toBeDefined();
    expect(protectedRec).toBeDefined();
    expect(unprotected!.reasonCodes).toContain("over_rotation");
    expect(protectedRec!.reasonCodes).not.toContain("over_rotation");
    expect(protectedRec!.score).toBeGreaterThanOrEqual(unprotected!.score);
  });
});

describe("recommendV2 — weather-aware ranking", () => {
  it("changes the ranking with the weather", () => {
    const base = ctx({
      items: [
        item({ id: "linen", name: "Linen Shirt", category: "Top", subcategory: "Shirt", seasons: ["Summer"] }),
        item({ id: "wool", name: "Wool Sweater", category: "Top", subcategory: "Sweater", seasons: ["Winter"] }),
        item({ id: "chino", name: "Chinos", category: "Bottom", subcategory: "Chinos", seasons: ["Year Round"] }),
        item({ id: "sneaker", name: "Sneakers", category: "Footwear", subcategory: "Sneakers", seasons: ["Year Round"] }),
      ],
    });
    const summer = recommendV2(
      withWeather(base, { season: "summer", condition: "hot", confidence: 0.9, labels: ["HOT", "LIGHTWEIGHT", "SUNNY", "SNEAKER_SAFE"] }),
      { limit: 8 },
    );
    const winter = recommendV2(
      withWeather(base, { season: "winter", condition: "cold", confidence: 0.9, labels: ["COLD", "LAYER_REQUIRED"] }),
      { limit: 8 },
    );
    // Weather materially changes the ranking.
    expect(ids(summer).join(",")).not.toBe(ids(winter).join(","));
    // The summer-appropriate outfit ranks at least as high in summer as in winter.
    const linenRank = (r: typeof summer) => ids(r).findIndex((id) => id.includes("linen"));
    expect(linenRank(summer)).toBeGreaterThanOrEqual(0);
    expect(linenRank(summer)).toBeLessThanOrEqual(linenRank(winter));
  });
});

describe("recommendV2 — personalization-aware ranking", () => {
  it("scores an outfit higher when it matches the user's preferences", () => {
    const items = [
      item({ id: "tee", name: "Navy Tee", category: "Top", subcategory: "T-Shirt", formality: "casual", color: "Navy" }),
      item({ id: "chino", name: "Chinos", category: "Bottom", subcategory: "Chinos", formality: "casual", color: "Beige" }),
      item({ id: "sneaker", name: "Sneakers", category: "Footwear", subcategory: "Sneakers", formality: "casual", color: "White" }),
    ];
    const prefs = (
      preferredFormality: PreferenceSnapshot["preferredFormality"],
      avoidedColors: string[],
    ): PreferenceSnapshot => ({
      preferredStyles: [],
      avoidedColors,
      preferredFormality,
      lifestyle: "hybrid",
      climate: "delhi-ncr",
      monthlyBudget: null,
    });
    const prefRaw = (result: ReturnType<typeof recommendV2>) =>
      result.recommendations[0].breakdown.dimensions.find((d) => d.dimension === "personalPreferenceFit")!.raw;

    const matching = recommendV2(ctx({ items, preferences: prefs(["casual"], []) }), { limit: 5 });
    const mismatched = recommendV2(
      ctx({ items, preferences: prefs(["business_formal"], ["navy", "beige"]) }),
      { limit: 5 },
    );
    // Same outfit, different preferences → the personalization dimension moves,
    // and the outfit scores higher under the matching profile.
    expect(prefRaw(matching)).toBeGreaterThan(prefRaw(mismatched));
    expect(matching.recommendations[0].score).toBeGreaterThan(mismatched.recommendations[0].score);
  });
});

describe("recommendV2 — diversity reranking", () => {
  it("keeps the top-K from repeating the same footwear/skeleton", () => {
    // Many combos share one top + one bottom; footwear varies but several are
    // the same sneaker class. Diversity should spread the returned list.
    const items = [
      item({ id: "top", name: "Grey Tee", category: "Top", subcategory: "T-Shirt" }),
      item({ id: "bottom", name: "Blue Jeans", category: "Bottom", subcategory: "Jeans" }),
      item({ id: "sneakA", name: "White Sneakers", category: "Footwear", subcategory: "Sneakers", rating: 9 }),
      item({ id: "sneakB", name: "Court Sneakers", category: "Footwear", subcategory: "Sneakers", rating: 9 }),
      item({ id: "sneakC", name: "Canvas Sneakers", category: "Footwear", subcategory: "Sneakers", rating: 9 }),
      item({ id: "loafer", name: "Brown Loafers", category: "Footwear", subcategory: "Loafers", rating: 8 }),
      item({ id: "boot", name: "Chelsea Boots", category: "Footwear", subcategory: "Boot", rating: 8 }),
    ];
    const result = recommendV2(ctx({ items }), { limit: 5 });
    expect(result.recommendations.length).toBeGreaterThan(1);
    expect(result.quality.diversityScore).toBeGreaterThan(0);
    // The returned footwear classes are not all identical.
    const footwearNames = result.recommendations.map(
      (r) => r.items.find((i) => i.slot === "footwear")?.name ?? "",
    );
    expect(new Set(footwearNames).size).toBeGreaterThan(1);
  });
});

describe("recommendV2 — recent wear penalty", () => {
  it("penalizes a recently-worn saved outfit", () => {
    const sneakers = Array.from({ length: 6 }, (_, i) =>
      item({ id: `sneak${i}`, name: `Sneaker ${i}`, category: "Footwear", subcategory: "Sneakers", rating: 9 }),
    );
    const build = (lastWornOn: string) =>
      recommendV2(
        ctx({
          items: [
            item({ id: "polo", name: "Taupe Polo", category: "Top", subcategory: "Polo" }),
            item({ id: "jeans", name: "Black Jeans", category: "Bottom", subcategory: "Jeans" }),
            item({ id: "boot", name: "Chelsea Boots", category: "Footwear", subcategory: "Boot", formality: "smart_casual", rating: 2 }),
            ...sneakers,
          ],
          savedOutfits: [{ id: "o1", name: "Look", itemIds: ["polo", "jeans", "boot"], lastWornOn }],
        }),
        { limit: 8 },
      );
    const recent = build(daysAgo(2)).recommendations.find((r) => r.savedOutfitId === "o1");
    const old = build(daysAgo(300)).recommendations.find((r) => r.savedOutfitId === "o1");
    expect(recent).toBeDefined();
    expect(old).toBeDefined();
    expect(recent!.score).toBeLessThan(old!.score);
    expect(recent!.reasonCodes).toContain("recent_wear");
  });
});

describe("recommendV2 — quality metrics", () => {
  it("returns coherent per-run metrics", () => {
    const result = recommendV2(
      ctx({ items: wardrobe(), savedOutfits: [{ id: "o1", name: "Saved", itemIds: ["polo", "jeans", "nb574"] }] }),
      { limit: 5 },
    );
    const q = result.quality;
    expect(q.eligibleCandidateCount).toBeGreaterThan(0);
    expect(q.rejectedCandidateCount).toBe(q.rejections.length);
    expect(q.diversityScore).toBeGreaterThanOrEqual(0);
    expect(q.diversityScore).toBeLessThanOrEqual(1);
    expect(q.averageConfidence).toBeGreaterThanOrEqual(0);
    expect(q.averageConfidence).toBeLessThanOrEqual(1);
    expect(q.sourceMix.saved + q.sourceMix.generated).toBe(result.recommendations.length);
    expect(q.weatherInfluence).toBeGreaterThanOrEqual(0);
    expect(q.personalizationInfluence).toBeGreaterThanOrEqual(0);
    expect(result.metadata.weatherSource).toBeTruthy();
  });
});
