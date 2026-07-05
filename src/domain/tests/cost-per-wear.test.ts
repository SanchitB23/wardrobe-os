import { describe, expect, it } from "vitest";

import {
  aggregateWearCounts,
  calculateAverageCostPerWear,
  calculateCostPerWear,
  sumWearCounts,
} from "@/domain/wardrobe/cost-per-wear";

describe("CostPerWear", () => {
  describe("calculateCostPerWear", () => {
    it("returns price divided by wear count rounded to cents", () => {
      expect(calculateCostPerWear(100, 10)).toBe(10);
      expect(calculateCostPerWear(100, 3)).toBe(33.33);
    });

    it("returns null when wear count is zero", () => {
      expect(calculateCostPerWear(100, 0)).toBeNull();
    });

    it("returns null when price is null or undefined", () => {
      expect(calculateCostPerWear(null, 5)).toBeNull();
      expect(calculateCostPerWear(undefined, 5)).toBeNull();
    });
  });

  describe("calculateAverageCostPerWear", () => {
    it("returns wardrobe value divided by total wears", () => {
      expect(calculateAverageCostPerWear(500, 25)).toBe(20);
    });

    it("returns null when there are no wears", () => {
      expect(calculateAverageCostPerWear(500, 0)).toBeNull();
    });
  });

  describe("aggregateWearCounts", () => {
    it("counts wears per item id", () => {
      const counts = aggregateWearCounts([
        { item_id: "a" },
        { item_id: "a" },
        { item_id: "b" },
      ]);

      expect(counts.get("a")).toBe(2);
      expect(counts.get("b")).toBe(1);
    });
  });

  describe("sumWearCounts", () => {
    it("sums all wear counts in the map", () => {
      const counts = new Map([
        ["a", 2],
        ["b", 3],
      ]);

      expect(sumWearCounts(counts)).toBe(5);
    });
  });
});
