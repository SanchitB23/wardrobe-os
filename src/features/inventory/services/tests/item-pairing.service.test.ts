import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecoItemRow } from "@/features/recommendations/repositories/recommendations.repository";

// Mock the repository layer the service depends on.
const selectRecommendationData = vi.fn();
vi.mock("@/features/recommendations/repositories/recommendations.repository", () => ({
  selectRecommendationData: (...args: unknown[]) => selectRecommendationData(...args),
}));

import { getItemPairings } from "@/features/inventory/services/item-pairing.service";

function row(overrides: Partial<RecoItemRow> = {}): RecoItemRow {
  return {
    id: overrides.id ?? "i1",
    name: "Item",
    formality: "casual",
    usage: "regular",
    rating: 8,
    status: "active",
    category: { name: "T-Shirts" },
    subcategory: null,
    primary_color: { name: "Black" },
    item_seasons: [{ seasons: { name: "Year Round" } }],
    item_styles: [{ styles: { name: "Casual" } }],
    item_tags: [{ tags: { name: "Social" } }],
    ...overrides,
  };
}

function wardrobeRows(): RecoItemRow[] {
  return [
    row({ id: "a1", name: "Black T-Shirt" }),
    row({ id: "b1", name: "Beige Chino Pants", category: { name: "Pants" }, primary_color: { name: "Beige" } }),
    row({ id: "f1", name: "White Sneakers", category: { name: "Sneakers" }, primary_color: { name: "White" } }),
  ];
}

function mockData(items: RecoItemRow[]) {
  selectRecommendationData.mockResolvedValue({
    data: { items, wearLogs: [], purchases: [], outfits: [], outfitItems: [] },
    error: null,
  });
}

beforeEach(() => {
  selectRecommendationData.mockReset();
});

describe("getItemPairings", () => {
  it("builds a pairing report anchored on the requested item", async () => {
    mockData(wardrobeRows());
    const result = await getItemPairings("a1");

    expect(result.error).toBeNull();
    expect(result.data?.anchorItemId).toBe("a1");
    expect(result.data?.anchorSlot).toBe("top");
    expect(result.data?.outfits.length).toBeGreaterThan(0);
    expect(result.data?.outfits[0].itemNames[0]).toBe("Black T-Shirt");
  });

  it("returns an error when the item does not exist", async () => {
    mockData(wardrobeRows());
    const result = await getItemPairings("missing");

    expect(result.data).toBeNull();
    expect(result.error?.message).toMatch(/not found/i);
  });

  it("propagates repository errors without throwing", async () => {
    selectRecommendationData.mockResolvedValue({
      data: null,
      error: new Error("boom"),
    });
    const result = await getItemPairings("a1");

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("boom");
  });

  it("marks retired anchors inactive instead of pairing them", async () => {
    mockData([row({ id: "a1", name: "Black T-Shirt", status: "retired" }), ...wardrobeRows().slice(1)]);
    const result = await getItemPairings("a1");

    expect(result.error).toBeNull();
    expect(result.data?.codes).toContain("ANCHOR_INACTIVE");
    expect(result.data?.outfits).toEqual([]);
  });

  it("excludes non-active wardrobe items from the candidate pool", async () => {
    mockData([
      ...wardrobeRows(),
      row({
        id: "f9",
        name: "Retired Boots",
        category: { name: "Boots" },
        rating: 10,
        status: "retired",
      }),
    ]);
    const result = await getItemPairings("a1");

    const pairedIds = Object.values(result.data?.pairingsBySlot ?? {})
      .flat()
      .map((p) => p.itemId);
    expect(pairedIds).not.toContain("f9");
    expect(pairedIds).toContain("f1");
  });
});
