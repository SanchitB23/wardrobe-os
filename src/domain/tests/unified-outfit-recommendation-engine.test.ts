import { describe, expect, it } from "vitest";

import { recommendUnifiedOutfits } from "@/domain/recommendation/UnifiedOutfitRecommendationEngine";
import { buildRecommendationContext } from "@/domain/recommendation/RecommendationContextBuilder";
import type { WardrobeItemInput } from "@/domain/recommendation/RecommendationContextBuilder";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";

const GENERATED_AT = "2026-07-05T00:00:00.000Z";

function health(): WardrobeHealth {
  return {
    overallScore: 90,
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
    strengths: [],
    weaknesses: [],
    recommendations: [],
    duplicates: [],
    gaps: [],
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
  return new Date(new Date(GENERATED_AT).getTime() - days * 86400000)
    .toISOString()
    .slice(0, 10);
}

type SavedInput = Parameters<typeof buildRecommendationContext>[0]["savedOutfits"];

function ctx(config: {
  items: WardrobeItemInput[];
  savedOutfits?: SavedInput;
  wearLogs?: Parameters<typeof buildRecommendationContext>[0]["wearLogs"];
}) {
  return buildRecommendationContext(
    {
      health: health(),
      wardrobeItems: config.items,
      savedOutfits: config.savedOutfits ?? [],
      wearLogs: config.wearLogs ?? [],
    },
    { generatedAt: GENERATED_AT },
  );
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

describe("recommendUnifiedOutfits", () => {
  it("merges saved and generated outfits and returns at most the limit", () => {
    const result = recommendUnifiedOutfits(
      ctx({
        items: wardrobe(),
        savedOutfits: [{ id: "o1", name: "Saved", itemIds: ["polo", "jeans", "nb574"] }],
      }),
      { limit: 5 },
    );
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);
    expect(result.some((r) => r.source === "saved_outfit")).toBe(true);
    expect(result.some((r) => r.source === "generated_combo")).toBe(true);
    result.forEach((r, index) => {
      expect(r.debug?.sourceRank).toBe(index + 1);
      expect(r.metadata.engineVersion).toBeTruthy();
    });
  });

  it("returns results ranked by unified score", () => {
    const result = recommendUnifiedOutfits(
      ctx({ items: wardrobe(), savedOutfits: [{ id: "o1", name: "Saved", itemIds: ["polo", "jeans", "nb574"] }] }),
      { limit: 8 },
    );
    for (let i = 1; i < result.length; i += 1) {
      expect(result[i - 1].score).toBeGreaterThanOrEqual(result[i].score);
    }
  });

  it("collapses a saved outfit and an identical generated combo into one", () => {
    // The saved outfit uses exactly polo + jeans + nb574, which the generator
    // will also produce; they must not both appear.
    const result = recommendUnifiedOutfits(
      ctx({
        items: [
          item({ id: "polo", name: "Taupe Polo", category: "Top", subcategory: "Polo" }),
          item({ id: "jeans", name: "Black Jeans", category: "Bottom", subcategory: "Jeans" }),
          item({ id: "nb574", name: "NB 574", category: "Footwear", subcategory: "Sneakers" }),
        ],
        savedOutfits: [{ id: "o1", name: "Saved look", itemIds: ["polo", "jeans", "nb574"] }],
      }),
      { limit: 5 },
    );
    const sameCombo = result.filter(
      (r) =>
        r.items.some((i) => i.itemId === "polo") &&
        r.items.some((i) => i.itemId === "jeans") &&
        r.items.some((i) => i.itemId === "nb574"),
    );
    expect(sameCombo).toHaveLength(1);
  });

  it("prefers the saved outfit when a duplicate scores very close (favorited)", () => {
    const result = recommendUnifiedOutfits(
      ctx({
        items: [
          item({ id: "polo", name: "Taupe Polo", category: "Top", subcategory: "Polo" }),
          item({ id: "jeans", name: "Black Jeans", category: "Bottom", subcategory: "Jeans" }),
          item({ id: "nb574", name: "NB 574", category: "Footwear", subcategory: "Sneakers" }),
        ],
        savedOutfits: [
          { id: "fav", name: "Favorite look", itemIds: ["polo", "jeans", "nb574"], favorite: true },
        ],
      }),
      { limit: 5 },
    );
    const top = result[0];
    expect(top.source).toBe("saved_outfit");
    expect(top.savedOutfitId).toBe("fav");
  });

  it("prefers a clearly better generated outfit over a weaker saved one", () => {
    // Saved outfit is a deliberately clashing pair (low analysis score); the
    // generator can build much better combos from the same wardrobe.
    const result = recommendUnifiedOutfits(
      ctx({
        items: [
          item({ id: "polo", name: "Navy Polo", category: "Top", subcategory: "Polo", color: "Navy" }),
          item({ id: "shirt", name: "White Shirt", category: "Top", subcategory: "Shirt", color: "White", formality: "business_casual" }),
          item({ id: "chino", name: "Charcoal Chinos", category: "Bottom", subcategory: "Chinos", color: "Charcoal" }),
          item({ id: "loafer", name: "Brown Loafers", category: "Footwear", subcategory: "Loafers", color: "Brown", formality: "business_casual" }),
          item({ id: "orangeTee", name: "Orange Tee", category: "Top", subcategory: "T-Shirt", color: "Orange", formality: "casual" }),
        ],
        savedOutfits: [
          // Weak, rarely-worn saved outfit (loud orange tee), not favorited.
          { id: "weak", name: "Weak saved", itemIds: ["orangeTee", "chino", "loafer"], lastWornOn: daysAgo(3) },
        ],
      }),
      { limit: 5 },
    );
    expect(result[0].source).toBe("generated_combo");
  });

  it("never surfaces hard-ineligible outfits (gym excludes office pieces)", () => {
    const result = recommendUnifiedOutfits(
      ctx({
        items: [
          item({ id: "gymTee", name: "Performance Tee", category: "Top", subcategory: "T-Shirt", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
          item({ id: "gymShorts", name: "Training Shorts", category: "Bottom", subcategory: "Shorts", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
          item({ id: "runShoe", name: "Running Shoes", category: "Footwear", subcategory: "Running", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
          item({ id: "shirt", name: "Oxford Shirt", category: "Top", subcategory: "Shirt", formality: "business_casual", tags: ["Office"] }),
          item({ id: "chino", name: "Charcoal Chinos", category: "Bottom", subcategory: "Chinos", tags: ["Office"] }),
          item({ id: "loafer", name: "Brown Loafers", category: "Footwear", subcategory: "Loafers", formality: "business_casual", tags: ["Office"] }),
        ],
        savedOutfits: [
          { id: "office", name: "Office look", itemIds: ["shirt", "chino", "loafer"] },
        ],
      }),
      { occasion: "Gym", limit: 5 },
    );
    const names = result.flatMap((r) => r.items.map((i) => i.name.toLowerCase()));
    expect(names.some((n) => /oxford shirt|chinos|loafers/.test(n))).toBe(false);
    expect(result.every((r) => r.savedOutfitId !== "office")).toBe(true);
  });

  it("applies a recent-wear penalty to saved outfits", () => {
    // The saved outfit's boot is intentionally low-rated so it stays out of the
    // generator's top-K footwear pool — the saved outfit has no generated twin
    // to collapse into, so its recent-wear penalty is observable.
    const sneakers = Array.from({ length: 6 }, (_, i) =>
      item({ id: `sneak${i}`, name: `Sneaker ${i}`, category: "Footwear", subcategory: "Sneakers", rating: 9 }),
    );
    const build = (lastWornOn: string) =>
      recommendUnifiedOutfits(
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
    const recent = build(daysAgo(2)).find((r) => r.savedOutfitId === "o1");
    const old = build(daysAgo(300)).find((r) => r.savedOutfitId === "o1");
    expect(recent).toBeDefined();
    expect(old).toBeDefined();
    expect(recent!.score).toBeLessThan(old!.score);
    expect(recent!.debug?.penalties?.some((p) => /worn 2 days ago/i.test(p))).toBe(true);
  });

  it("is deterministic for the same context and options", () => {
    const config = {
      items: wardrobe(),
      savedOutfits: [{ id: "o1", name: "Saved", itemIds: ["polo", "chino", "loafer"] }] as SavedInput,
    };
    const a = recommendUnifiedOutfits(ctx(config), { occasion: "Office", limit: 5 });
    const b = recommendUnifiedOutfits(ctx(config), { occasion: "Office", limit: 5 });
    expect(a).toEqual(b);
  });
});
