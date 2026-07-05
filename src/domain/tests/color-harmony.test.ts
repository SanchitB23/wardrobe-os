import { describe, expect, it } from "vitest";

import {
  areColorsCompatible,
  assessOutfitColorCompatibility,
  isNeutralColor,
} from "@/domain/outfit/color-compatibility";

describe("ColorHarmony", () => {
  describe("isNeutralColor", () => {
    it("detects neutral colors by name", () => {
      expect(isNeutralColor({ name: "Navy Blue" })).toBe(true);
      expect(isNeutralColor({ name: "Charcoal" })).toBe(true);
    });

    it("detects neutral colors by low-saturation hex", () => {
      expect(isNeutralColor({ hex: "#808080" })).toBe(true);
      expect(isNeutralColor({ hex: "#f5f5f5" })).toBe(true);
      expect(isNeutralColor({ hex: "#1a1a1a" })).toBe(true);
    });

    it("does not treat saturated colors as neutral", () => {
      expect(isNeutralColor({ hex: "#ff0000", name: "Red" })).toBe(false);
    });
  });

  describe("areColorsCompatible", () => {
    it("treats neutral pairings as compatible", () => {
      expect(
        areColorsCompatible({ name: "Navy" }, { name: "Beige" }),
      ).toBe(true);
    });

    it("treats identical hex values as compatible", () => {
      expect(
        areColorsCompatible({ hex: "#336699" }, { hex: "#336699" }),
      ).toBe(true);
    });

    it("flags mid-distance saturated colors as incompatible", () => {
      expect(
        areColorsCompatible(
          { hex: "#ff0000", name: "Red" },
          { hex: "#884400", name: "Burnt Orange" },
        ),
      ).toBe(false);
    });
  });

  describe("assessOutfitColorCompatibility", () => {
    it("returns a perfect score for a single color", () => {
      expect(assessOutfitColorCompatibility([{ name: "Black" }])).toEqual({
        compatible: true,
        score: 1,
        conflictingPairs: [],
      });
    });

    it("returns a perfect score for an all-neutral palette", () => {
      const result = assessOutfitColorCompatibility([
        { name: "Navy" },
        { name: "White" },
        { name: "Charcoal" },
      ]);

      expect(result.compatible).toBe(true);
      expect(result.score).toBe(1);
      expect(result.conflictingPairs).toEqual([]);
    });

    it("reports conflicting pairs for clashing saturated colors", () => {
      const result = assessOutfitColorCompatibility([
        { hex: "#ff0000", name: "Red" },
        { hex: "#884400", name: "Burnt Orange" },
      ]);

      expect(result.compatible).toBe(false);
      expect(result.score).toBe(0);
      expect(result.conflictingPairs).toEqual([
        { left: "Red", right: "Burnt Orange" },
      ]);
    });
  });
});
