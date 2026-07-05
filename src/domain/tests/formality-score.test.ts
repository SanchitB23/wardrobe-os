import { describe, expect, it } from "vitest";

import {
  areFormalitiesCompatible,
  assessOutfitFormalityCompatibility,
  getFormalityRank,
} from "@/domain/outfit/formality-compatibility";

describe("FormalityScore", () => {
  describe("getFormalityRank", () => {
    it("maps formality levels to ordered ranks", () => {
      expect(getFormalityRank("casual")).toBe(0);
      expect(getFormalityRank("business_casual")).toBe(2);
      expect(getFormalityRank("formal")).toBe(4);
    });

    it("returns null for unset formality", () => {
      expect(getFormalityRank(null)).toBeNull();
    });
  });

  describe("areFormalitiesCompatible", () => {
    it("allows adjacent formality levels", () => {
      expect(areFormalitiesCompatible("casual", "smart_casual")).toBe(true);
      expect(areFormalitiesCompatible("business_casual", "business_formal")).toBe(
        true,
      );
    });

    it("rejects formality levels more than one step apart", () => {
      expect(areFormalitiesCompatible("casual", "formal")).toBe(false);
    });

    it("treats unset formality as compatible with anything", () => {
      expect(areFormalitiesCompatible(null, "formal")).toBe(true);
      expect(areFormalitiesCompatible("casual", null)).toBe(true);
    });
  });

  describe("assessOutfitFormalityCompatibility", () => {
    it("returns a compatible assessment for uniform formality", () => {
      expect(
        assessOutfitFormalityCompatibility([
          "business_casual",
          "business_casual",
          "smart_casual",
        ]),
      ).toEqual({
        compatible: true,
        spread: 1,
        dominantFormality: "business_casual",
        outliers: [],
      });
    });

    it("flags a wide formality spread and records outliers", () => {
      const result = assessOutfitFormalityCompatibility([
        "casual",
        "formal",
      ]);

      expect(result.compatible).toBe(false);
      expect(result.spread).toBe(4);
      expect(result.dominantFormality).toBe("business_casual");
      expect(result.outliers).toEqual(["casual", "formal"]);
    });

    it("returns a neutral assessment when no formality is set", () => {
      expect(assessOutfitFormalityCompatibility([null, undefined])).toEqual({
        compatible: true,
        spread: 0,
        dominantFormality: null,
        outliers: [],
      });
    });
  });
});
