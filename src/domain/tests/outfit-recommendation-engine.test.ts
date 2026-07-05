import { describe, expect, it } from "vitest";

import {
  generateOutfitRecommendations,
  recommendOutfits,
} from "@/domain/recommendation/OutfitRecommendationEngine";
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

function item(overrides: Partial<WardrobeItemInput> = {}): WardrobeItemInput {
  return {
    id: "x",
    name: "Item",
    category: "Top",
    color: "Navy",
    formality: "smart_casual",
    usage: "regular",
    rating: 8,
    status: "active",
    seasons: ["Summer", "Year Round"],
    styles: ["Smart Casual"],
    tags: ["Office", "Casual"],
    ...overrides,
  };
}

function daysAgo(days: number): string {
  return new Date(new Date(GENERATED_AT).getTime() - days * 86400000)
    .toISOString()
    .slice(0, 10);
}

/** A wardrobe with a full set of items usable across outfits. */
const ITEMS: WardrobeItemInput[] = [
  item({ id: "top1", name: "Navy Polo", category: "Top", color: "Navy" }),
  item({ id: "top2", name: "White Shirt", category: "Top", color: "White" }),
  item({ id: "bottom1", name: "Charcoal Chinos", category: "Bottom", color: "Charcoal" }),
  item({ id: "bottom2", name: "Beige Chinos", category: "Bottom", color: "Beige" }),
  item({ id: "shoe1", name: "White Sneakers", category: "Footwear", color: "White", tags: ["Office", "Casual", "Gym"] }),
  item({ id: "shoe2", name: "Brown Loafers", category: "Footwear", color: "Brown" }),
];

function ctx(config: {
  savedOutfits?: Parameters<typeof buildRecommendationContext>[0]["savedOutfits"];
  wearLogs?: Parameters<typeof buildRecommendationContext>[0]["wearLogs"];
  items?: WardrobeItemInput[];
  weather?: Parameters<typeof buildRecommendationContext>[0]["weather"];
  commute?: Parameters<typeof buildRecommendationContext>[0]["commute"];
}) {
  return buildRecommendationContext(
    {
      health: health(),
      wardrobeItems: config.items ?? ITEMS,
      wearLogs: config.wearLogs ?? [],
      savedOutfits: config.savedOutfits ?? [],
      weather: config.weather,
      commute: config.commute,
    },
    { generatedAt: GENERATED_AT },
  );
}

describe("recommendOutfits", () => {
  it("recommends from saved outfits first and returns at most 5", () => {
    const savedOutfits = Array.from({ length: 7 }, (_, i) => ({
      id: `o${i}`,
      name: `Outfit ${i}`,
      itemIds: ["top1", "bottom1", "shoe1"],
    }));
    const recs = recommendOutfits(ctx({ savedOutfits }));
    expect(recs.length).toBe(5);
    expect(recs.every((r) => r.metadata.source === "saved_outfit")).toBe(true);
    expect(recs[0].analysis.overallScore).toBeGreaterThan(0);
  });

  it("penalizes outfits worn very recently", () => {
    const base = {
      id: "o1",
      name: "Recent",
      itemIds: ["top1", "bottom1", "shoe1"],
    };
    const recent = recommendOutfits(
      ctx({ savedOutfits: [{ ...base, lastWornOn: daysAgo(2) }] }),
    )[0];
    const old = recommendOutfits(
      ctx({ savedOutfits: [{ ...base, lastWornOn: daysAgo(200) }] }),
    )[0];

    expect(recent.score).toBeLessThan(old.score);
    expect(recent.tradeoffs.some((t) => /worn 2 days ago/i.test(t))).toBe(true);
  });

  it("penalizes outfits containing retired or stale items", () => {
    const items = [
      ...ITEMS,
      item({ id: "retiredTop", name: "Old Tee", category: "Top", status: "retired" }),
    ];
    const withRetired = recommendOutfits(
      ctx({
        items,
        savedOutfits: [
          { id: "r", name: "Retired look", itemIds: ["retiredTop", "bottom1", "shoe1"] },
        ],
      }),
    )[0];
    const clean = recommendOutfits(
      ctx({
        items,
        savedOutfits: [
          { id: "c", name: "Clean look", itemIds: ["top1", "bottom1", "shoe1"] },
        ],
      }),
    )[0];

    expect(withRetired.score).toBeLessThan(clean.score);
    expect(withRetired.tradeoffs.some((t) => /retired/i.test(t))).toBe(true);
  });

  it("boosts favorite outfits", () => {
    const base = { name: "Look", itemIds: ["top1", "bottom1", "shoe1"] };
    const favorite = recommendOutfits(
      ctx({ savedOutfits: [{ id: "f", ...base, favorite: true }] }),
    )[0];
    const plain = recommendOutfits(
      ctx({ savedOutfits: [{ id: "p", ...base, favorite: false }] }),
    )[0];

    expect(favorite.score).toBeGreaterThan(plain.score);
    expect(favorite.strengths.some((s) => /favorite/i.test(s))).toBe(true);
  });

  it("boosts outfits matching the requested occasion", () => {
    const context = ctx({
      savedOutfits: [
        { id: "office", name: "Office look", itemIds: ["top1", "bottom1", "shoe1"] },
      ],
    });
    const withOccasion = recommendOutfits(context, { occasion: "Office" })[0];
    const without = recommendOutfits(context)[0];

    expect(withOccasion.score).toBeGreaterThanOrEqual(without.score);
    expect(withOccasion.strengths.some((s) => /office occasion/i.test(s))).toBe(true);
  });

  it("boosts commute-compatible outfits when not WFH", () => {
    const context = ctx({
      savedOutfits: [
        { id: "c", name: "Metro look", itemIds: ["top1", "bottom1", "shoe1"] },
      ],
      commute: { mode: "metro" },
    });
    const rec = recommendOutfits(context)[0];
    expect(rec.strengths.some((s) => /metro commute/i.test(s))).toBe(true);
  });

  it("fills with generated combos when saved outfits are scarce", () => {
    const recs = recommendOutfits(
      ctx({
        savedOutfits: [
          { id: "only", name: "Only saved", itemIds: ["top1", "bottom1", "shoe1"] },
        ],
      }),
    );
    expect(recs.length).toBeGreaterThan(1);
    expect(recs[0].metadata.source).toBe("saved_outfit");
    expect(recs.some((r) => r.metadata.source === "generated_combo")).toBe(true);
    // Generated combos are complete outfits (top + bottom + footwear).
    const combo = recs.find((r) => r.metadata.source === "generated_combo");
    expect(combo?.items.length).toBeGreaterThanOrEqual(3);
  });

  it("returns nothing when there are no saved outfits and no usable items", () => {
    const recs = recommendOutfits(ctx({ items: [], savedOutfits: [] }));
    expect(recs).toEqual([]);
  });

  it("includes a deterministic reason, strengths, tradeoffs, and suggestions", () => {
    const rec = recommendOutfits(
      ctx({ savedOutfits: [{ id: "o", name: "Look", itemIds: ["top1", "bottom1", "shoe1"] }] }),
    )[0];
    expect(rec.reason).toMatch(/Scored \d/);
    expect(Array.isArray(rec.strengths)).toBe(true);
    expect(Array.isArray(rec.tradeoffs)).toBe(true);
    expect(Array.isArray(rec.suggestions)).toBe(true);
    expect(rec.metadata.engineVersion).toBeTruthy();
  });

  it("is deterministic for the same context and options", () => {
    const config = {
      savedOutfits: [
        { id: "o1", name: "A", itemIds: ["top1", "bottom1", "shoe1"] },
        { id: "o2", name: "B", itemIds: ["top2", "bottom2", "shoe2"] },
      ],
    };
    const a = recommendOutfits(ctx(config), { occasion: "Office" });
    const b = recommendOutfits(ctx(config), { occasion: "Office" });
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// Hard eligibility — context constraints applied before scoring.
// ---------------------------------------------------------------------------

const GYM_ITEMS: WardrobeItemInput[] = [
  item({ id: "gymTop", name: "Performance Tee", category: "Top", subcategory: "T-Shirt", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
  item({ id: "gymShorts", name: "Training Shorts", category: "Bottom", subcategory: "Shorts", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
  item({ id: "runShoe", name: "Running Shoes", category: "Footwear", subcategory: "Running", formality: "casual", tags: ["Gym"], styles: ["Athleisure"] }),
];

const OFFICE_ITEMS: WardrobeItemInput[] = [
  item({ id: "shirt", name: "Oxford Shirt", category: "Top", subcategory: "Shirt", formality: "business_casual", tags: ["Office"], styles: ["Classic"] }),
  item({ id: "chino", name: "Charcoal Chinos", category: "Bottom", subcategory: "Chinos", formality: "smart_casual", tags: ["Office"], styles: ["Smart Casual"] }),
  item({ id: "sneaker", name: "White Sneakers", category: "Footwear", subcategory: "Sneakers", formality: "smart_casual", tags: ["Office", "Casual"], styles: ["Smart Casual"] }),
  item({ id: "dressShoe", name: "Oxford Shoes", category: "Footwear", subcategory: "Oxford", formality: "formal", tags: ["Wedding"], styles: ["Formal"] }),
  item({ id: "tux", name: "Black Tuxedo", category: "Outerwear", subcategory: "Tuxedo", formality: "formal", tags: ["Wedding"], styles: ["Formal"] }),
];

const WEDDING_ITEMS: WardrobeItemInput[] = [
  item({ id: "fShirt", name: "Formal Shirt", category: "Top", subcategory: "Shirt", formality: "business_formal", tags: ["Wedding"], styles: ["Formal"] }),
  item({ id: "fTrouser", name: "Formal Trousers", category: "Bottom", subcategory: "Trousers", formality: "formal", tags: ["Wedding"], styles: ["Formal"] }),
];

const CASUAL_ITEMS: WardrobeItemInput[] = [
  item({ id: "tee", name: "Casual Tee", category: "Top", subcategory: "T-Shirt", formality: "casual", tags: ["Casual"], styles: ["Everyday Casual"] }),
  item({ id: "jeans", name: "Blue Jeans", category: "Bottom", subcategory: "Jeans", formality: "casual", tags: ["Casual"], styles: ["Everyday Casual"] }),
];

const ALL_ITEMS = [...GYM_ITEMS, ...OFFICE_ITEMS, ...WEDDING_ITEMS, ...CASUAL_ITEMS];

function contextWith(
  savedOutfits: Parameters<typeof buildRecommendationContext>[0]["savedOutfits"],
  items: WardrobeItemInput[] = ALL_ITEMS,
) {
  return buildRecommendationContext(
    { health: health(), wardrobeItems: items, savedOutfits },
    { generatedAt: GENERATED_AT },
  );
}

describe("recommendOutfits — hard eligibility", () => {
  const OFFICE_OUTFIT = { id: "office", name: "Office look", itemIds: ["shirt", "chino", "dressShoe"] };
  const GYM_OUTFIT = { id: "gym", name: "Gym look", itemIds: ["gymTop", "gymShorts", "runShoe"] };
  const FORMAL_OUTFIT = { id: "formal", name: "Wedding look", itemIds: ["fShirt", "fTrouser", "dressShoe"] };
  const CASUAL_OUTFIT = { id: "casual", name: "Casual look", itemIds: ["tee", "jeans", "sneaker"] };

  it("Gym never recommends a shirt + chinos + tuxedo office outfit", () => {
    const { recommendations, rejected } = generateOutfitRecommendations(
      contextWith([OFFICE_OUTFIT, GYM_OUTFIT]),
      { occasion: "Gym" },
    );

    expect(recommendations.some((r) => r.outfitId === "gym")).toBe(true);
    expect(recommendations.some((r) => r.outfitId === "office")).toBe(false);
    // No recommendation (incl. generated combos) contains office/formal items.
    const names = recommendations.flatMap((r) => r.items.map((i) => i.name.toLowerCase()));
    expect(names.some((n) => /shirt|chino|tuxedo|oxford/.test(n))).toBe(false);
    // Rejection is explained (Rule 8).
    const officeReject = rejected.find((r) => r.outfitId === "office");
    expect(officeReject?.reasons.some((r) => /not suitable for gym/i.test(r))).toBe(true);
  });

  it("Office does not recommend gym shorts / running shoes", () => {
    const { recommendations, rejected } = generateOutfitRecommendations(
      contextWith([OFFICE_OUTFIT, GYM_OUTFIT]),
      { occasion: "Office" },
    );

    expect(recommendations.some((r) => r.outfitId === "office")).toBe(true);
    expect(recommendations.some((r) => r.outfitId === "gym")).toBe(false);
    expect(rejected.some((r) => r.outfitId === "gym")).toBe(true);
  });

  it("Wedding prefers formalwear and rejects casual outfits", () => {
    const { recommendations, rejected } = generateOutfitRecommendations(
      contextWith([FORMAL_OUTFIT, CASUAL_OUTFIT]),
      { occasion: "Wedding" },
    );

    expect(recommendations[0]?.outfitId).toBe("formal");
    expect(recommendations.some((r) => r.outfitId === "casual")).toBe(false);
    expect(rejected.some((r) => r.outfitId === "casual")).toBe(true);
  });

  it("a favorite wrong-context outfit ranks below a correct-context outfit", () => {
    const recs = recommendOutfits(
      contextWith([
        { ...OFFICE_OUTFIT, favorite: true }, // favorite but wrong for gym
        { ...GYM_OUTFIT, favorite: false },
      ]),
      { occasion: "Gym" },
    );

    const gymIndex = recs.findIndex((r) => r.outfitId === "gym");
    const officeIndex = recs.findIndex((r) => r.outfitId === "office");
    expect(gymIndex).toBe(0);
    // The favorite office outfit is excluded entirely (never outranks).
    expect(officeIndex).toBe(-1);
  });

  it("excludes saved outfits that violate the selected occasion filter", () => {
    const { recommendations } = generateOutfitRecommendations(
      contextWith([OFFICE_OUTFIT, CASUAL_OUTFIT, GYM_OUTFIT]),
      { occasion: "Gym" },
    );
    const ids = recommendations.map((r) => r.outfitId);
    expect(ids).toContain("gym");
    expect(ids).not.toContain("office");
    expect(ids).not.toContain("casual");
  });

  it("rejects and explains an outfit missing footwear", () => {
    const { rejected } = generateOutfitRecommendations(
      contextWith([{ id: "noShoes", name: "No shoes", itemIds: ["gymTop", "gymShorts"] }]),
      { occasion: "Gym" },
    );
    const entry = rejected.find((r) => r.outfitId === "noShoes");
    expect(entry?.reasons.some((r) => /missing footwear/i.test(r))).toBe(true);
  });

  it("keeps favorite boost capped so it cannot override context (<= 1 point)", () => {
    const favorite = recommendOutfits(
      contextWith([{ ...GYM_OUTFIT, favorite: true }]),
      { occasion: "Gym" },
    )[0];
    const plain = recommendOutfits(
      contextWith([{ ...GYM_OUTFIT, favorite: false }]),
      { occasion: "Gym" },
    )[0];
    expect(favorite.score - plain.score).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Travel / dinner calibration + debug output.
// ---------------------------------------------------------------------------

const TRAVEL_ITEMS: WardrobeItemInput[] = [
  item({ id: "tTop", name: "Cotton Polo", category: "Top", subcategory: "Polo", formality: "smart_casual", tags: ["Travel", "Casual"], styles: ["Smart Casual"] }),
  item({ id: "tBottom", name: "Travel Chinos", category: "Bottom", subcategory: "Chinos", formality: "smart_casual", tags: ["Travel"], styles: ["Smart Casual"] }),
  item({ id: "af1", name: "Nike Air Force 1", category: "Footwear", subcategory: "Sneakers", color: "White", formality: "smart_casual", tags: ["Casual"], styles: ["Streetwear"] }),
  item({ id: "trainer", name: "Canvas Trainers", category: "Footwear", subcategory: "Sneakers", color: "Grey", formality: "smart_casual", tags: ["Travel", "Casual"], styles: ["Smart Casual"] }),
];

const DINNER_ITEMS: WardrobeItemInput[] = [
  ...GYM_ITEMS,
  item({ id: "dPolo", name: "Knit Polo", category: "Top", subcategory: "Polo", formality: "smart_casual", tags: ["Dinner", "Casual"], styles: ["Smart Casual"] }),
  item({ id: "dChino", name: "Dark Chinos", category: "Bottom", subcategory: "Chinos", formality: "smart_casual", styles: ["Smart Casual"] }),
  item({ id: "dShoe", name: "Suede Chukka", category: "Footwear", subcategory: "Boot", color: "Brown", formality: "smart_casual", styles: ["Smart Casual"] }),
];

function contextWithItems(
  savedOutfits: Parameters<typeof buildRecommendationContext>[0]["savedOutfits"],
  items: WardrobeItemInput[],
) {
  return buildRecommendationContext(
    { health: health(), wardrobeItems: items, savedOutfits },
    { generatedAt: GENERATED_AT },
  );
}

describe("recommendOutfits — travel, dinner, debug", () => {
  it("penalizes protected AF1-type footwear for travel", () => {
    const recs = recommendOutfits(
      contextWithItems(
        [
          { id: "af", name: "AF1 look", itemIds: ["tTop", "tBottom", "af1"] },
          { id: "plain", name: "Trainer look", itemIds: ["tTop", "tBottom", "trainer"] },
        ],
        TRAVEL_ITEMS,
      ),
      { occasion: "Travel" },
    );

    const af = recs.find((r) => r.outfitId === "af");
    const plain = recs.find((r) => r.outfitId === "plain");
    expect(af).toBeDefined();
    expect(plain).toBeDefined();
    // Both are travel-eligible (soft), but the protected AF1 ranks lower.
    expect(plain!.score).toBeGreaterThan(af!.score);
    expect(af!.tradeoffs.some((t) => /protected/i.test(t))).toBe(true);
  });

  it("Dinner rejects gym-only outfits and keeps smart-casual ones", () => {
    const { recommendations, rejected } = generateOutfitRecommendations(
      contextWithItems(
        [
          { id: "gym", name: "Gym look", itemIds: ["gymTop", "gymShorts", "runShoe"] },
          { id: "smart", name: "Dinner look", itemIds: ["dPolo", "dChino", "dShoe"] },
        ],
        DINNER_ITEMS,
      ),
      { occasion: "Dinner" },
    );

    expect(recommendations.some((r) => r.outfitId === "smart")).toBe(true);
    expect(recommendations.some((r) => r.outfitId === "gym")).toBe(false);
    expect(rejected.some((r) => r.outfitId === "gym")).toBe(true);
  });

  it("exposes a score breakdown and rejection reasons in debug output", () => {
    const { recommendations, rejected } = generateOutfitRecommendations(
      contextWith([OFFICE_OUTFIT_DEBUG, GYM_OUTFIT_DEBUG]),
      { occasion: "Gym" },
    );

    const rec = recommendations[0];
    expect(rec.debug.eligible).toBe(true);
    expect(typeof rec.debug.baseScore).toBe("number");
    expect(Array.isArray(rec.debug.adjustments)).toBe(true);
    // Boosts/penalties carry a label + numeric delta.
    for (const adj of rec.debug.adjustments) {
      expect(typeof adj.label).toBe("string");
      expect(typeof adj.delta).toBe("number");
    }
    expect(rejected[0]?.reasons.length).toBeGreaterThan(0);
  });
});

const OFFICE_OUTFIT_DEBUG = { id: "officeDbg", name: "Office", itemIds: ["shirt", "chino", "dressShoe"] };
const GYM_OUTFIT_DEBUG = { id: "gymDbg", name: "Gym", itemIds: ["gymTop", "gymShorts", "runShoe"] };
