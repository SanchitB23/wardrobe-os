import { describe, expect, it } from "vitest";

import { recommendOutfits } from "@/domain/recommendation/OutfitRecommendationEngine";
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
