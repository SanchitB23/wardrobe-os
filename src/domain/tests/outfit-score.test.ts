import { describe, expect, it } from "vitest";

import { scoreOutfit } from "@/domain/outfit/outfit-scoring";

describe("OutfitScore", () => {
  it("penalizes missing required slots", () => {
    const result = scoreOutfit([]);

    expect(result.completeness).toBe(0);
    expect(result.missingRequiredSlots).toEqual(["top", "bottom", "footwear"]);
    expect(result.score).toBe(48);
  });

  it("scores a complete neutral business-casual outfit highly", () => {
    const result = scoreOutfit([
      {
        slot: "top",
        formality: "business_casual",
        colorHex: "#1a1a1a",
        colorName: "Black",
        rating: 8,
      },
      {
        slot: "bottom",
        formality: "business_casual",
        colorHex: "#2f4f4f",
        colorName: "Charcoal",
        rating: 8,
      },
      {
        slot: "footwear",
        formality: "business_casual",
        colorHex: "#000000",
        colorName: "Black",
        rating: 7,
      },
    ]);

    expect(result.completeness).toBe(1);
    expect(result.missingRequiredSlots).toEqual([]);
    expect(result.formality.compatible).toBe(true);
    expect(result.colors.compatible).toBe(true);
    expect(result.averageItemRating).toBe(7.7);
    expect(result.score).toBe(97);
  });

  it("lowers the score when required slots are incomplete", () => {
    const result = scoreOutfit([
      {
        slot: "top",
        formality: "casual",
        colorHex: "#ffffff",
        colorName: "White",
        rating: 6,
      },
      {
        slot: "bottom",
        formality: "casual",
        colorHex: "#000080",
        colorName: "Navy",
        rating: 6,
      },
    ]);

    expect(result.completeness).toBeCloseTo(0.67, 2);
    expect(result.missingRequiredSlots).toEqual(["footwear"]);
    expect(result.score).toBeLessThan(90);
  });

  it("adds optional-slot bonus without changing required completeness", () => {
    const baseOutfit = [
      {
        slot: "top" as const,
        formality: "smart_casual" as const,
        colorHex: "#111111",
        colorName: "Black",
        rating: 8,
      },
      {
        slot: "bottom" as const,
        formality: "smart_casual" as const,
        colorHex: "#222222",
        colorName: "Charcoal",
        rating: 8,
      },
      {
        slot: "footwear" as const,
        formality: "smart_casual" as const,
        colorHex: "#333333",
        colorName: "Gray",
        rating: 8,
      },
    ];

    const withoutOptional = scoreOutfit(baseOutfit);
    const withOptional = scoreOutfit([
      ...baseOutfit,
      {
        slot: "outerwear",
        formality: "smart_casual",
        colorHex: "#444444",
        colorName: "Navy",
        rating: 8,
      },
    ]);

    expect(withOptional.score).toBeGreaterThan(withoutOptional.score);
    expect(withOptional.completeness).toBe(withoutOptional.completeness);
  });
});
