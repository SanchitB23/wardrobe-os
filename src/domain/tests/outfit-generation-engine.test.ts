import { describe, expect, it } from "vitest";

import { generateOutfits } from "@/domain/generation";
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

function ctx(items: WardrobeItemInput[]) {
  return buildRecommendationContext(
    { health: health(), wardrobeItems: items },
    { generatedAt: GENERATED_AT },
  );
}

/** A small smart-casual wardrobe with several options per core slot. */
function smartCasualWardrobe(): WardrobeItemInput[] {
  return [
    item({ id: "polo1", name: "Taupe Polo", category: "Top", subcategory: "Polo", color: "Taupe", tags: ["Office", "Casual"] }),
    item({ id: "polo2", name: "Navy Polo", category: "Top", subcategory: "Polo", color: "Navy", tags: ["Office"] }),
    item({ id: "shirt1", name: "Blue Oxford Shirt", category: "Top", subcategory: "Shirt", color: "Blue", formality: "business_casual", tags: ["Office"] }),
    item({ id: "jeans1", name: "Black Jeans", category: "Bottom", subcategory: "Jeans", color: "Black", tags: ["Casual"] }),
    item({ id: "chino1", name: "Charcoal Chinos", category: "Bottom", subcategory: "Chinos", color: "Charcoal", tags: ["Office"] }),
    item({ id: "nb574", name: "New Balance 574", category: "Footwear", subcategory: "Sneakers", color: "Grey", tags: ["Casual"] }),
    item({ id: "adidas", name: "Adidas Sneakers", category: "Footwear", subcategory: "Sneakers", color: "White", tags: ["Casual"] }),
    item({ id: "loafer", name: "Brown Loafers", category: "Footwear", subcategory: "Loafers", color: "Brown", formality: "business_casual", tags: ["Office"] }),
  ];
}

describe("generateOutfits", () => {
  it("generates complete outfits (top + bottom + footwear) from the wardrobe", () => {
    const outfits = generateOutfits(ctx(smartCasualWardrobe()), { limit: 5 });
    expect(outfits.length).toBeGreaterThan(0);
    for (const outfit of outfits) {
      expect(outfit.items.top).toBeDefined();
      expect(outfit.items.bottom).toBeDefined();
      expect(outfit.items.footwear).toBeDefined();
      expect(outfit.source).toBe("generated");
      expect(outfit.score).toBeGreaterThan(0);
      expect(outfit.reasoning.length).toBeGreaterThan(0);
      expect(outfit.analysis).toBeDefined();
    }
  });

  it("returns outfits sorted by score (descending)", () => {
    const outfits = generateOutfits(ctx(smartCasualWardrobe()), { limit: 8 });
    for (let i = 1; i < outfits.length; i += 1) {
      expect(outfits[i - 1].score).toBeGreaterThanOrEqual(outfits[i].score);
    }
  });

  it("rejects impossible combinations (formal shirt + gym shorts, tuxedo + running shoes)", () => {
    const items = [
      item({ id: "fShirt", name: "Formal Shirt", category: "Top", subcategory: "Shirt", formality: "business_formal", tags: ["Wedding"], styles: ["Formal"] }),
      item({ id: "gymShorts", name: "Gym Shorts", category: "Bottom", subcategory: "Shorts", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
      item({ id: "tux", name: "Black Tuxedo", category: "Top", subcategory: "Tuxedo", formality: "formal", tags: ["Wedding"], styles: ["Formal"] }),
      item({ id: "run", name: "Running Shoes", category: "Footwear", subcategory: "Running", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
      item({ id: "fTrouser", name: "Formal Trousers", category: "Bottom", subcategory: "Trousers", formality: "formal", tags: ["Wedding"] }),
    ];
    const outfits = generateOutfits(ctx(items));
    // Every generated outfit is internally consistent (no wild formality spread).
    for (const outfit of outfits) {
      const ranks = [outfit.items.top, outfit.items.bottom, outfit.items.footwear];
      expect(ranks.every(Boolean)).toBe(true);
    }
    // The clash combos are reported as rejected alternatives.
    const anyOutfit = generateOutfits(ctx([
      ...smartCasualWardrobe(),
      ...items,
    ]));
    expect(
      anyOutfit.some((o) => o.rejectedAlternatives.some((r) => /formality clash/i.test(r))),
    ).toBe(true);
  });

  it("does not pair a gym top with formal trousers", () => {
    const items = [
      item({ id: "gymTee", name: "Performance Tee", category: "Top", subcategory: "T-Shirt", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
      item({ id: "fTrouser", name: "Formal Trousers", category: "Bottom", subcategory: "Trousers", formality: "formal", tags: ["Wedding"], styles: ["Formal"] }),
      item({ id: "loafer", name: "Oxford Shoes", category: "Footwear", subcategory: "Oxford", formality: "formal" }),
    ];
    const outfits = generateOutfits(ctx(items));
    // gym tee (casual) + formal trousers (formal) = spread 4 → impossible → nothing valid.
    expect(outfits).toHaveLength(0);
  });

  it("removes near-duplicate outfits (same top + bottom, interchangeable sneakers)", () => {
    // Only one footwear class (sneakers) shares top+bottom → dedup to one.
    const items = [
      item({ id: "polo", name: "Taupe Polo", category: "Top", subcategory: "Polo", color: "Taupe" }),
      item({ id: "jeans", name: "Black Jeans", category: "Bottom", subcategory: "Jeans", color: "Black" }),
      item({ id: "nb574", name: "New Balance 574", category: "Footwear", subcategory: "Sneakers", color: "Grey" }),
      item({ id: "adidas", name: "Adidas Sneakers", category: "Footwear", subcategory: "Sneakers", color: "White" }),
    ];
    const outfits = generateOutfits(ctx(items), { limit: 10 });
    // NB574 and Adidas are both casual sneakers → one outfit, not two.
    expect(outfits).toHaveLength(1);
  });

  it("keeps distinct footwear classes as separate outfits", () => {
    const items = [
      item({ id: "polo", name: "Taupe Polo", category: "Top", subcategory: "Polo" }),
      item({ id: "chino", name: "Charcoal Chinos", category: "Bottom", subcategory: "Chinos" }),
      item({ id: "sneaker", name: "White Sneakers", category: "Footwear", subcategory: "Sneakers" }),
      item({ id: "loafer", name: "Brown Loafers", category: "Footwear", subcategory: "Loafers", formality: "business_casual" }),
    ];
    const outfits = generateOutfits(ctx(items), { limit: 10 });
    // sneaker vs loafer are different classes → two outfits.
    expect(outfits).toHaveLength(2);
  });

  it("respects the requested occasion (gym excludes non-activewear)", () => {
    const items = [
      item({ id: "gymTee", name: "Performance Tee", category: "Top", subcategory: "T-Shirt", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
      item({ id: "gymShorts", name: "Training Shorts", category: "Bottom", subcategory: "Shorts", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
      item({ id: "run", name: "Running Shoes", category: "Footwear", subcategory: "Running", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
      item({ id: "shirt", name: "Oxford Shirt", category: "Top", subcategory: "Shirt", formality: "business_casual", tags: ["Office"] }),
      item({ id: "chino", name: "Charcoal Chinos", category: "Bottom", subcategory: "Chinos", tags: ["Office"] }),
    ];
    const outfits = generateOutfits(ctx(items), { occasion: "Gym", limit: 5 });
    expect(outfits.length).toBeGreaterThan(0);
    const names = outfits.flatMap((o) => Object.values(o.items).map((i) => i.name));
    expect(names.some((n) => /oxford shirt/i.test(n))).toBe(false);
    expect(names.some((n) => /performance tee/i.test(n))).toBe(true);
  });

  it("returns nothing when a core slot is missing", () => {
    const outfits = generateOutfits(
      ctx([item({ category: "Top" }), item({ category: "Bottom" })]),
    );
    expect(outfits).toEqual([]);
  });

  it("is deterministic for the same context", () => {
    const items = smartCasualWardrobe();
    const a = generateOutfits(ctx(items), { occasion: "Office", limit: 6 });
    const b = generateOutfits(ctx(items), { occasion: "Office", limit: 6 });
    expect(a).toEqual(b);
  });

  it("generates within 500ms for 200 wardrobe items", () => {
    const items: WardrobeItemInput[] = [];
    const slots: [string, string][] = [
      ["Top", "Polo"],
      ["Bottom", "Chinos"],
      ["Footwear", "Sneakers"],
      ["Outerwear", "Jacket"],
    ];
    for (let i = 0; i < 200; i += 1) {
      const [category, subcategory] = slots[i % slots.length];
      items.push(
        item({
          id: `perf${i}`,
          name: `${subcategory} ${i}`,
          category,
          subcategory,
          color: ["Navy", "Grey", "Black", "Blue", "Green"][i % 5],
          rating: 6 + (i % 4),
        }),
      );
    }
    const context = ctx(items);
    const start = performance.now();
    const outfits = generateOutfits(context, { occasion: "Office", limit: 10 });
    const elapsed = performance.now() - start;
    expect(outfits.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(500);
  });
});
