import { describe, expect, it } from "vitest";

import {
  ColorEngine,
  FormalityEngine,
  OccasionEngine,
  OutfitEngine,
  SeasonEngine,
  TextureEngine,
  WeatherEngine,
  evaluateOutfit,
} from "@/domain/outfit";
import type { OutfitEngineItem, OutfitEvaluationInput } from "@/domain/outfit/types";

const businessOutfitItems: OutfitEngineItem[] = [
  {
    slot: "top",
    name: "White Oxford Shirt",
    formality: "business_casual",
    colorHex: "#ffffff",
    colorName: "White",
    seasonTags: ["All Season"],
    occasionTags: ["Office"],
    material: "Cotton",
  },
  {
    slot: "bottom",
    name: "Charcoal Trousers",
    formality: "business_casual",
    colorHex: "#36454f",
    colorName: "Charcoal",
    seasonTags: ["All Season"],
    occasionTags: ["Office"],
    material: "Wool",
  },
  {
    slot: "footwear",
    name: "Brown Loafers",
    formality: "business_casual",
    colorHex: "#5c4033",
    colorName: "Brown",
    seasonTags: ["All Season"],
    occasionTags: ["Office"],
    material: "Leather",
  },
];

function buildInput(
  overrides: Partial<OutfitEvaluationInput> = {},
): OutfitEvaluationInput {
  return {
    items: businessOutfitItems,
    context: {
      targetSeason: "All Season",
      targetOccasion: "Office",
      weather: { temperatureC: 18, precipitation: "none", wind: "calm" },
    },
    ...overrides,
  };
}

describe("Outfit Domain Engine", () => {
  describe("ColorEngine", () => {
    it("scores a neutral palette highly", () => {
      const result = ColorEngine.evaluate(buildInput());

      expect(result.score).toBeGreaterThanOrEqual(8);
      expect(result.reason).toContain("compatible");
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("FormalityEngine", () => {
    it("rewards aligned formality levels", () => {
      const result = FormalityEngine.evaluate(buildInput());

      expect(result.score).toBeGreaterThanOrEqual(8);
      expect(result.engineId).toBe("formality");
    });

    it("penalizes mixed dress codes", () => {
      const result = FormalityEngine.evaluate(
        buildInput({
          items: [
            ...businessOutfitItems.slice(0, 2),
            {
              slot: "footwear",
              name: "Running Sneakers",
              formality: "casual",
              colorHex: "#ff0000",
              colorName: "Red",
            },
          ],
        }),
      );

      expect(result.score).toBeLessThan(8);
      expect(result.reason).toContain("mixes incompatible");
    });
  });

  describe("SeasonEngine", () => {
    it("matches items to a winter target", () => {
      const result = SeasonEngine.evaluate(
        buildInput({
          context: {
            targetSeason: "Winter",
            targetOccasion: "Office",
          },
          items: businessOutfitItems.map((item) => ({
            ...item,
            seasonTags: ["Winter"],
          })),
        }),
      );

      expect(result.score).toBe(10);
      expect(result.reason).toContain("winter");
    });
  });

  describe("OccasionEngine", () => {
    it("aligns business items with an office occasion", () => {
      const result = OccasionEngine.evaluate(buildInput());

      expect(result.score).toBe(10);
      expect(result.reason).toContain("office");
    });
  });

  describe("TextureEngine", () => {
    it("flags too many heavy textures", () => {
      const result = TextureEngine.evaluate(
        buildInput({
          items: [
            { slot: "top", name: "Wool Sweater", formality: "casual", colorHex: null, material: "Wool" },
            { slot: "bottom", name: "Denim Jeans", formality: "casual", colorHex: null, material: "Denim" },
            { slot: "footwear", name: "Leather Boots", formality: "casual", colorHex: null, material: "Leather" },
            { slot: "outerwear", name: "Wool Coat", formality: "casual", colorHex: null, material: "Wool" },
          ],
        }),
      );

      expect(result.score).toBeLessThan(8);
      expect(result.recommendations.some((entry) => entry.includes("heavy"))).toBe(
        true,
      );
    });
  });

  describe("WeatherEngine", () => {
    it("requires outerwear in cold weather", () => {
      const result = WeatherEngine.evaluate(
        buildInput({
          context: {
            targetSeason: "Winter",
            targetOccasion: "Office",
            weather: { temperatureC: 2, precipitation: "light", wind: "moderate" },
          },
        }),
      );

      expect(result.score).toBeLessThan(8);
      expect(result.recommendations).toContain(
        "Add outerwear for cold weather protection.",
      );
    });

    it("rewards outerwear in rainy conditions", () => {
      const result = WeatherEngine.evaluate(
        buildInput({
          items: [
            ...businessOutfitItems,
            {
              slot: "outerwear",
              name: "Rain Shell",
              formality: "business_casual",
              colorHex: "#000000",
              colorName: "Black",
              material: "Nylon",
            },
          ],
          context: {
            targetSeason: "Autumn",
            targetOccasion: "Office",
            weather: { temperatureC: 10, precipitation: "heavy", wind: "strong" },
          },
        }),
      );

      expect(result.score).toBeGreaterThan(6);
    });
  });

  describe("OutfitEngine", () => {
    it("combines all engines into a composite result", () => {
      const result = evaluateOutfit(buildInput());

      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThanOrEqual(10);
      expect(result.summary).toContain("Overall outfit score");
      expect(Object.keys(result.engines)).toEqual([
        "color",
        "formality",
        "season",
        "occasion",
        "texture",
        "weather",
      ]);
      expect(result.strengths.length + result.weaknesses.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("supports extensible engine overrides via config", () => {
      const customEngine = {
        id: "color" as const,
        evaluate: () => ({
          engineId: "color" as const,
          score: 5,
          reason: "Custom color stub.",
          recommendations: ["Custom recommendation."],
        }),
      };

      const result = OutfitEngine.evaluate(buildInput(), {
        extraEngines: [customEngine],
      });

      expect(result.engines.color.score).toBe(5);
      expect(result.engines.color.reason).toBe("Custom color stub.");
    });
  });
});
