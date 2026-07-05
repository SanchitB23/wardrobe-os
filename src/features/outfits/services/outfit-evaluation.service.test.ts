import { describe, expect, it } from "vitest";

import {
  toOutfitEvaluationInput,
  type EvaluationItemAttributes,
} from "@/features/outfits/services/outfit-evaluation.service";
import type { OutfitItemDetail } from "@/features/outfits/types";

function makeOutfitItem(overrides: Partial<OutfitItemDetail> = {}): OutfitItemDetail {
  return {
    outfit_id: "outfit-1",
    item_id: "item-1",
    slot: "top",
    item: {
      id: "item-1",
      code: "TS-001",
      name: "Black T-Shirt",
      category: null,
      brand: null,
      primary_image_url: null,
    },
    ...overrides,
  };
}

function makeAttributes(
  overrides: Partial<EvaluationItemAttributes> = {},
): EvaluationItemAttributes {
  return {
    item_id: "item-1",
    name: "Black T-Shirt",
    formality: "casual",
    rating: 7,
    colorHex: "#000000",
    colorName: "Black",
    material: "Cotton",
    seasonTags: ["Summer", "All Season"],
    occasionTags: ["Office"],
    ...overrides,
  };
}

describe("toOutfitEvaluationInput", () => {
  it("maps outfit items with attributes into engine items", () => {
    const input = toOutfitEvaluationInput(
      {
        season: { id: "s1", name: "Summer" },
        occasion: { id: "o1", name: "Office" },
        items: [makeOutfitItem()],
      },
      new Map([["item-1", makeAttributes()]]),
    );

    expect(input.items).toHaveLength(1);
    expect(input.items[0]).toMatchObject({
      slot: "top",
      name: "Black T-Shirt",
      formality: "casual",
      colorHex: "#000000",
      colorName: "Black",
      material: "Cotton",
      rating: 7,
    });
    expect(input.items[0].seasonTags).toEqual(["Summer", "All Season"]);
    expect(input.items[0].occasionTags).toEqual(["Office"]);
  });

  it("builds context from outfit season and occasion with no weather", () => {
    const input = toOutfitEvaluationInput(
      {
        season: { id: "s1", name: "Winter" },
        occasion: { id: "o1", name: "Party" },
        items: [makeOutfitItem()],
      },
      new Map(),
    );

    expect(input.context).toEqual({
      targetSeason: "Winter",
      targetOccasion: "Party",
      weather: null,
    });
  });

  it("falls back to null attributes when item has no enrichment row", () => {
    const input = toOutfitEvaluationInput(
      {
        season: null,
        occasion: null,
        items: [makeOutfitItem()],
      },
      new Map(),
    );

    expect(input.items[0]).toMatchObject({
      slot: "top",
      name: "Black T-Shirt",
      formality: null,
      colorHex: null,
      material: null,
      rating: null,
    });
    expect(input.items[0].seasonTags).toEqual([]);
    expect(input.context).toEqual({
      targetSeason: null,
      targetOccasion: null,
      weather: null,
    });
  });

  it("uses attribute name over picker name and skips nothing when picker item is null", () => {
    const input = toOutfitEvaluationInput(
      {
        season: null,
        occasion: null,
        items: [
          makeOutfitItem({ item: null }),
          makeOutfitItem({
            item_id: "item-2",
            slot: "bottom",
            item: null,
          }),
        ],
      },
      new Map([["item-2", makeAttributes({ item_id: "item-2", name: "Chinos" })]]),
    );

    expect(input.items).toHaveLength(2);
    expect(input.items[0].name).toBe("Unknown item");
    expect(input.items[1].name).toBe("Chinos");
  });
});
