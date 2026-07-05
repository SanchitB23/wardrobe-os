import { describe, expect, it } from "vitest";

import { buildOutfitWearStats } from "@/domain/wardrobe/wear-analytics";

describe("buildOutfitWearStats", () => {
  it("returns empty stats when the outfit was never worn", () => {
    const stats = buildOutfitWearStats([]);

    expect(stats.timesWorn).toBe(0);
    expect(stats.lastWornOn).toBeNull();
    expect(stats.averageComfort).toBeNull();
    expect(stats.events).toEqual([]);
  });

  it("counts one wear event per worn_on date, not per item row", () => {
    const stats = buildOutfitWearStats([
      { worn_on: "2026-07-04", comfort_rating: 8 },
      { worn_on: "2026-07-04", comfort_rating: 8 },
      { worn_on: "2026-07-04", comfort_rating: 8 },
      { worn_on: "2026-07-01", comfort_rating: 6 },
      { worn_on: "2026-07-01", comfort_rating: 6 },
    ]);

    expect(stats.timesWorn).toBe(2);
    expect(stats.lastWornOn).toBe("2026-07-04");
    expect(stats.averageComfort).toBe(7);
    expect(stats.events).toEqual([
      { worn_on: "2026-07-04", comfort_rating: 8 },
      { worn_on: "2026-07-01", comfort_rating: 6 },
    ]);
  });

  it("ignores null comfort ratings in the average but keeps the events", () => {
    const stats = buildOutfitWearStats([
      { worn_on: "2026-06-30", comfort_rating: null },
      { worn_on: "2026-06-28", comfort_rating: 9 },
    ]);

    expect(stats.timesWorn).toBe(2);
    expect(stats.averageComfort).toBe(9);
    expect(stats.events).toHaveLength(2);
  });

  it("rounds average comfort to one decimal", () => {
    const stats = buildOutfitWearStats([
      { worn_on: "2026-06-01", comfort_rating: 7 },
      { worn_on: "2026-06-02", comfort_rating: 8 },
      { worn_on: "2026-06-03", comfort_rating: 8 },
    ]);

    expect(stats.averageComfort).toBe(7.7);
  });
});
