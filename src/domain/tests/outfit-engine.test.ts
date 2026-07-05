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
  describe("RuleResult contract", () => {
    it("every engine returns a complete RuleResult", () => {
      const input = buildInput();
      const engines = [
        ColorEngine,
        FormalityEngine,
        SeasonEngine,
        OccasionEngine,
        TextureEngine,
        WeatherEngine,
      ];

      for (const engine of engines) {
        const result = engine.evaluate(input);

        expect(result.engineId).toBe(engine.id);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(10);
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        expect(typeof result.reason).toBe("string");
        expect(Array.isArray(result.strengths)).toBe(true);
        expect(Array.isArray(result.weaknesses)).toBe(true);
        expect(Array.isArray(result.suggestions)).toBe(true);
      }
    });
  });

  describe("ColorEngine", () => {
    it("scores a neutral palette highly with full confidence", () => {
      const result = ColorEngine.evaluate(buildInput());

      expect(result.score).toBeGreaterThanOrEqual(8);
      expect(result.confidence).toBe(1);
      expect(result.reason).toContain("compatible");
      expect(result.strengths.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it("reports low confidence when no color data exists", () => {
      const result = ColorEngine.evaluate(
        buildInput({
          items: businessOutfitItems.map((item) => ({
            ...item,
            colorHex: null,
            colorName: null,
          })),
        }),
      );

      expect(result.confidence).toBeLessThanOrEqual(0.3);
    });
  });

  describe("FormalityEngine", () => {
    it("rewards aligned formality levels", () => {
      const result = FormalityEngine.evaluate(buildInput());

      expect(result.score).toBeGreaterThanOrEqual(8);
      expect(result.engineId).toBe("formality");
      expect(result.confidence).toBe(1);
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
      expect(result.weaknesses.length).toBeGreaterThan(0);
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
      expect(result.suggestions.some((entry) => entry.includes("heavy"))).toBe(true);
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
      expect(result.suggestions).toContain(
        "Add outerwear for cold weather protection.",
      );
    });

    it("reports low confidence without weather context", () => {
      const result = WeatherEngine.evaluate(
        buildInput({ context: { targetSeason: "All Season" } }),
      );

      expect(result.confidence).toBeLessThanOrEqual(0.3);
    });
  });

  describe("OutfitAnalysis composition", () => {
    it("scores a high-quality outfit strongly with structured metadata", () => {
      const analysis = evaluateOutfit(buildInput(), {
        generatedAt: "2026-07-05T00:00:00.000Z",
      });

      expect(analysis.overallScore).toBeGreaterThanOrEqual(7.5);
      expect(analysis.confidence).toBeGreaterThan(0.8);
      expect(analysis.summary).toContain("Overall outfit score");
      expect(analysis.breakdown.color.score).toBeGreaterThanOrEqual(8);
      expect(analysis.breakdown.formality.score).toBeGreaterThanOrEqual(8);
      expect(analysis.breakdown.weather?.score).toBeGreaterThanOrEqual(8);
      expect(analysis.strengths.length).toBeGreaterThan(0);
      expect(analysis.metadata.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
      expect(analysis.metadata.generatedAt).toBe("2026-07-05T00:00:00.000Z");
      expect(analysis.metadata.rulesApplied).toEqual([
        "color",
        "formality",
        "season",
        "occasion",
        "texture",
        "weather",
      ]);
    });

    it("scores a low-quality outfit poorly with weaknesses", () => {
      const analysis = evaluateOutfit(
        buildInput({
          items: [
            {
              slot: "top",
              name: "Formal Tuxedo Jacket",
              formality: "formal",
              colorHex: "#000000",
              colorName: "Black",
              seasonTags: ["Winter"],
              material: "Wool",
            },
            {
              slot: "bottom",
              name: "Olive Cargo Shorts",
              formality: "casual",
              colorHex: "#708238",
              colorName: "Olive",
              seasonTags: ["Summer"],
              material: "Denim",
            },
            {
              slot: "footwear",
              name: "Neon Running Shoes",
              formality: "casual",
              colorHex: "#ff2400",
              colorName: "Scarlet",
              seasonTags: ["Summer"],
              material: "Leather",
            },
          ],
          context: {
            targetSeason: "Winter",
            targetOccasion: "Formal Gala",
            weather: { temperatureC: 2, precipitation: "heavy", wind: "strong" },
          },
        }),
        { generatedAt: "2026-07-05T00:00:00.000Z" },
      );

      expect(analysis.overallScore).toBeLessThan(5.5);
      expect(analysis.weaknesses.length).toBeGreaterThan(0);
      expect(analysis.suggestions.length).toBeGreaterThan(0);
      expect(analysis.breakdown.formality.score).toBeLessThan(5);
    });

    it("handles missing optional metadata with neutral scores and low confidence", () => {
      const analysis = evaluateOutfit(
        {
          items: [
            { slot: "top", name: "Mystery Top", formality: null, colorHex: null },
            { slot: "bottom", name: "Mystery Bottom", formality: null, colorHex: null },
          ],
        },
        { generatedAt: "2026-07-05T00:00:00.000Z" },
      );

      expect(analysis.overallScore).toBeGreaterThanOrEqual(5);
      expect(analysis.overallScore).toBeLessThanOrEqual(7);
      expect(analysis.confidence).toBeLessThan(0.5);
      expect(analysis.metadata.rulesApplied).toHaveLength(6);
    });

    it("surfaces formality mismatch in the breakdown", () => {
      const analysis = evaluateOutfit(
        buildInput({
          items: [
            ...businessOutfitItems.slice(0, 2),
            {
              slot: "footwear",
              name: "Flip Flops",
              formality: "casual",
              colorHex: "#ffffff",
              colorName: "White",
            },
          ],
        }),
        { generatedAt: "2026-07-05T00:00:00.000Z" },
      );

      expect(analysis.breakdown.formality.score).toBeLessThan(8);
      expect(
        analysis.weaknesses.some((entry) => entry.includes("formality")) ||
          analysis.breakdown.formality.weaknesses.length > 0,
      ).toBe(true);
    });

    it("surfaces seasonal mismatch in the breakdown", () => {
      const analysis = evaluateOutfit(
        buildInput({
          context: { targetSeason: "Winter", targetOccasion: "Office" },
          items: businessOutfitItems.map((item) => ({
            ...item,
            seasonTags: ["Summer"],
          })),
        }),
        { generatedAt: "2026-07-05T00:00:00.000Z" },
      );

      expect(analysis.breakdown.season.score).toBeLessThanOrEqual(3);
      expect(analysis.breakdown.season.suggestions.length).toBeGreaterThan(0);
    });

    it("supports extensible engine overrides via config", () => {
      const customEngine = {
        id: "color" as const,
        evaluate: () => ({
          engineId: "color" as const,
          score: 5,
          confidence: 0.9,
          reason: "Custom color stub.",
          strengths: [],
          weaknesses: ["Custom weakness."],
          suggestions: ["Custom recommendation."],
        }),
      };

      const analysis = OutfitEngine.evaluate(buildInput(), {
        extraEngines: [customEngine],
        generatedAt: "2026-07-05T00:00:00.000Z",
      });

      expect(analysis.breakdown.color.score).toBe(5);
      expect(analysis.breakdown.color.reason).toBe("Custom color stub.");
    });
  });
});
