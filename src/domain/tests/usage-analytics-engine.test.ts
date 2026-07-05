import { describe, expect, it } from "vitest";

import {
  analyzeUsage,
  type UsageAnalyticsInput,
  type UsageItem,
  type UsageWearLog,
} from "@/domain/analytics/UsageAnalyticsEngine";
import type { FormalityEnum, ItemStatus, UsageFrequency } from "@/types/wardrobe";

const ASOF = new Date("2026-07-05T00:00:00Z");

let counter = 0;
function item(overrides: Partial<UsageItem> = {}): UsageItem {
  counter += 1;
  return {
    id: `i${counter}`,
    name: `Item ${counter}`,
    category: "Top",
    formality: "smart_casual",
    usage: "regular",
    status: "active",
    ...overrides,
  };
}

/** N wear logs for an item, `daysAgo[i]` days before ASOF. */
function wears(itemId: string, daysAgo: number[], occasion?: string): UsageWearLog[] {
  return daysAgo.map((d) => {
    const date = new Date(ASOF.getTime() - d * 86400000);
    return { itemId, wornOn: date.toISOString().slice(0, 10), occasion };
  });
}

function run(input: UsageAnalyticsInput) {
  return analyzeUsage(input, { asOf: ASOF, limit: 5 });
}

describe("analyzeUsage", () => {
  it("counts total wears and worn items", () => {
    const a = item();
    const b = item();
    const result = run({
      wardrobeItems: [a, b],
      wearLogs: [...wears(a.id, [1, 5]), ...wears(b.id, [2])],
    });
    expect(result.totalWears).toBe(3);
    expect(result.wornItemCount).toBe(2);
  });

  it("rule 1 — never-worn items are active items with zero wear logs", () => {
    const worn = item({ name: "Worn Tee" });
    const never = item({ name: "Unworn Shirt" });
    const retiredNever = item({ name: "Retired", status: "retired" as ItemStatus });
    const result = run({
      wardrobeItems: [worn, never, retiredNever],
      wearLogs: wears(worn.id, [3]),
    });
    const ids = result.neverWornItems.map((i) => i.id);
    expect(ids).toContain(never.id);
    expect(ids).not.toContain(worn.id);
    expect(ids).not.toContain(retiredNever.id); // not active
  });

  it("rule 2 — stale items are worn 90+ days ago, excluding rare/formal", () => {
    const stale = item({ name: "Stale Chino" });
    const recentlyWorn = item({ name: "Fresh Tee" });
    const staleButRare = item({ name: "Rare Piece", usage: "rare" as UsageFrequency });
    const staleButFormal = item({ name: "Tux", formality: "formal" as FormalityEnum });
    const result = run({
      wardrobeItems: [stale, recentlyWorn, staleButRare, staleButFormal],
      wearLogs: [
        ...wears(stale.id, [120]),
        ...wears(recentlyWorn.id, [10]),
        ...wears(staleButRare.id, [200]),
        ...wears(staleButFormal.id, [200]),
      ],
    });
    const staleIds = result.staleItems.map((i) => i.id);
    expect(staleIds).toContain(stale.id);
    expect(staleIds).not.toContain(recentlyWorn.id);
    expect(staleIds).not.toContain(staleButRare.id); // rare excluded
    expect(staleIds).not.toContain(staleButFormal.id); // formal excluded

    const staleSummary = result.staleItems.find((i) => i.id === stale.id);
    expect(staleSummary?.daysSinceLastWorn).toBe(120);
  });

  it("rule 3 — most worn is ordered by wear count descending", () => {
    const heavy = item({ name: "Heavy" });
    const light = item({ name: "Light" });
    const result = run({
      wardrobeItems: [heavy, light],
      wearLogs: [...wears(heavy.id, [1, 2, 3, 4]), ...wears(light.id, [5])],
    });
    expect(result.mostWornItems[0]?.id).toBe(heavy.id);
    expect(result.mostWornItems[0]?.wearCount).toBe(4);
    expect(result.mostWornItems[1]?.id).toBe(light.id);
  });

  it("rule 4 — least worn active excludes rare/formal and never-worn", () => {
    const seldom = item({ name: "Seldom" });
    const often = item({ name: "Often" });
    const rareSeldom = item({ name: "Rare", usage: "rare" as UsageFrequency });
    const never = item({ name: "Never" });
    const result = run({
      wardrobeItems: [seldom, often, rareSeldom, never],
      wearLogs: [
        ...wears(seldom.id, [10]),
        ...wears(often.id, [1, 2, 3]),
        ...wears(rareSeldom.id, [10]),
      ],
    });
    const ids = result.leastWornActiveItems.map((i) => i.id);
    expect(ids[0]).toBe(seldom.id); // fewest wears among eligible
    expect(ids).not.toContain(rareSeldom.id); // rare excluded
    expect(ids).not.toContain(never.id); // never-worn handled separately
  });

  it("recently worn lists items worn within 30 days, soonest first", () => {
    const fresh = item({ name: "Fresh" });
    const old = item({ name: "Old" });
    const result = run({
      wardrobeItems: [fresh, old],
      wearLogs: [...wears(fresh.id, [3]), ...wears(old.id, [200])],
    });
    const ids = result.recentlyWornItems.map((i) => i.id);
    expect(ids).toContain(fresh.id);
    expect(ids).not.toContain(old.id);
    expect(result.recentlyWornItems[0]?.daysSinceLastWorn).toBe(3);
  });

  it("rule 5 — category usage compares ownership vs wear counts", () => {
    const top1 = item({ category: "Top", name: "Top A" });
    const top2 = item({ category: "Top", name: "Top B" });
    const shoe = item({ category: "Footwear", name: "Shoe" });
    const result = run({
      wardrobeItems: [top1, top2, shoe],
      wearLogs: [...wears(top1.id, [1, 2, 3]), ...wears(shoe.id, [1])],
    });
    const tops = result.categoryUsage.find((c) => c.category === "Top");
    expect(tops).toMatchObject({ itemCount: 2, wearCount: 3, neverWornCount: 1 });
    expect(tops?.wearsPerItem).toBe(1.5);
  });

  it("groups usage by occasion with distinct item counts", () => {
    const a = item();
    const b = item();
    const result = run({
      wardrobeItems: [a, b],
      wearLogs: [
        ...wears(a.id, [1, 2], "Office"),
        ...wears(b.id, [3], "Office"),
        ...wears(a.id, [4], "Gym"),
      ],
    });
    const office = result.usageByOccasion.find((o) => o.occasion === "Office");
    expect(office).toEqual({ occasion: "Office", wearCount: 3, itemCount: 2 });
  });

  it("rule 6 — cost-per-wear highlights best and worst value", () => {
    const cheapWorkhorse = item({ name: "Workhorse" }); // 1000 / 20 = 50
    const pricyIdle = item({ name: "Splurge" }); // 8000 / 2 = 4000
    const result = run({
      wardrobeItems: [cheapWorkhorse, pricyIdle],
      wearLogs: [
        ...wears(cheapWorkhorse.id, Array.from({ length: 20 }, (_, i) => i + 1)),
        ...wears(pricyIdle.id, [1, 2]),
      ],
      purchases: [
        { itemId: cheapWorkhorse.id, price: 1000 },
        { itemId: pricyIdle.id, price: 8000 },
      ],
    });
    expect(result.costPerWearHighlights).toBeDefined();
    expect(result.costPerWearHighlights?.bestValue[0]).toMatchObject({
      id: cheapWorkhorse.id,
      costPerWear: 50,
    });
    expect(result.costPerWearHighlights?.worstValue[0]).toMatchObject({
      id: pricyIdle.id,
      costPerWear: 4000,
    });
  });

  it("omits cost-per-wear highlights when no prices are provided", () => {
    const a = item();
    const result = run({ wardrobeItems: [a], wearLogs: wears(a.id, [1]) });
    expect(result.costPerWearHighlights).toBeUndefined();
  });

  it("excludes never-worn items from cost-per-wear (no finite value)", () => {
    const neverWorn = item({ name: "Idle" });
    const result = run({
      wardrobeItems: [neverWorn],
      wearLogs: [],
      purchases: [{ itemId: neverWorn.id, price: 5000 }],
    });
    // A price exists, but the only item has no wears → no finite cost-per-wear.
    expect(result.costPerWearHighlights?.bestValue ?? []).toHaveLength(0);
    expect(result.costPerWearHighlights?.worstValue ?? []).toHaveLength(0);
  });

  it("produces deterministic insights and recommendations", () => {
    const worn = item({ name: "Daily Driver" });
    const never = item({ name: "Forgotten" });
    const stale = item({ name: "Dusty" });
    const result = run({
      wardrobeItems: [worn, never, stale],
      wearLogs: [...wears(worn.id, [1, 2, 3]), ...wears(stale.id, [150])],
    });

    expect(result.insights[0]).toContain("total wears logged");
    expect(result.insights.some((i) => i.includes("never been worn"))).toBe(true);
    expect(result.insights.some((i) => i.includes("Most worn: Daily Driver"))).toBe(
      true,
    );

    expect(
      result.recommendations.some((r) => r.includes("Forgotten")),
    ).toBe(true);
    expect(result.recommendations.some((r) => r.includes("Dusty"))).toBe(true);

    // Deterministic: same input → identical output.
    const again = run({
      wardrobeItems: [worn, never, stale],
      wearLogs: [...wears(worn.id, [1, 2, 3]), ...wears(stale.id, [150])],
    });
    expect(again).toEqual(result);
  });

  it("handles an empty wardrobe gracefully", () => {
    const result = run({ wardrobeItems: [], wearLogs: [] });
    expect(result.totalWears).toBe(0);
    expect(result.wornItemCount).toBe(0);
    expect(result.neverWornItems).toEqual([]);
    expect(result.mostWornItems).toEqual([]);
    expect(result.categoryUsage).toEqual([]);
    expect(result.insights.length).toBeGreaterThan(0);
  });
});
