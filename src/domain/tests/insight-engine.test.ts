import { describe, expect, it } from "vitest";

import {
  generateInsights,
  type InsightContext,
} from "@/domain/analytics/InsightEngine";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import type {
  ItemUsageSummary,
  UsageAnalytics,
} from "@/domain/analytics/UsageAnalyticsEngine";

const GENERATED_AT = "2026-07-05T00:00:00.000Z";

function health(overrides: Partial<WardrobeHealth> = {}): WardrobeHealth {
  const categoryScores = {
    tops: 90,
    bottoms: 90,
    footwear: 90,
    outerwear: 90,
    accessories: 90,
    fragrance: 90,
  } as WardrobeHealth["categoryScores"];
  const occasions = {
    officeDaily: 90,
    smartCasual: 90,
    travel: 90,
    social: 90,
    formal: 80,
    gym: 90,
    home: 90,
  } as WardrobeHealth["occasions"];
  const seasons = { summer: 90, transitional: 90, winter: 90 } as WardrobeHealth["seasons"];
  return {
    overallScore: 92,
    categoryScores,
    occasions,
    seasons,
    strengths: [],
    weaknesses: [],
    recommendations: [],
    duplicates: [],
    gaps: [],
    ...overrides,
  };
}

function usage(overrides: Partial<UsageAnalytics> = {}): UsageAnalytics {
  return {
    totalWears: 0,
    wornItemCount: 0,
    neverWornItems: [],
    mostWornItems: [],
    leastWornActiveItems: [],
    recentlyWornItems: [],
    staleItems: [],
    categoryUsage: [],
    usageByOccasion: [],
    insights: [],
    recommendations: [],
    ...overrides,
  };
}

function usageItem(overrides: Partial<ItemUsageSummary> = {}): ItemUsageSummary {
  return {
    id: "x1",
    name: "Item",
    category: "Top",
    wearCount: 1,
    lastWornOn: "2026-01-01",
    daysSinceLastWorn: 120,
    ...overrides,
  };
}

function run(ctx: InsightContext) {
  return generateInsights(ctx, { generatedAt: GENERATED_AT });
}

describe("generateInsights", () => {
  it("generates warnings for stale items", () => {
    const report = run({
      wardrobeHealth: health(),
      usageAnalytics: usage({
        staleItems: [
          usageItem({ id: "s1", name: "Dusty Chino", daysSinceLastWorn: 130 }),
          usageItem({ id: "s2", name: "Old Blazer", daysSinceLastWorn: 200 }),
        ],
      }),
    });

    const stale = report.warnings.find((i) => i.id === "stale-items");
    expect(stale).toBeDefined();
    expect(stale?.type).toBe("warning");
    expect(stale?.relatedItemIds).toEqual(["s1", "s2"]);
  });

  it("generates an opportunity for practical gaps", () => {
    const report = run({
      wardrobeHealth: health({
        gaps: [
          {
            label: "Navy knit polo",
            kind: "staple",
            detail: "Missing smart-casual staple.",
            priority: "high",
          },
        ],
      }),
      usageAnalytics: usage(),
    });

    const gap = report.insights.find((i) => i.id === "gap-navy-knit-polo");
    expect(gap?.type).toBe("opportunity");
    expect(gap?.priority).toBe("high");
    expect(report.topActions.some((i) => i.id === "gap-navy-knit-polo")).toBe(true);
  });

  it("generates a strength for high office coverage", () => {
    const report = run({
      wardrobeHealth: health({
        occasions: {
          officeDaily: 95,
          smartCasual: 70,
          travel: 70,
          social: 70,
          formal: 70,
          gym: 70,
          home: 70,
        } as WardrobeHealth["occasions"],
      }),
      usageAnalytics: usage(),
    });

    const strength = report.strengths.find((i) => i.id === "office-coverage");
    expect(strength).toBeDefined();
    expect(strength?.type).toBe("strength");
  });

  it("deduplicates similar insights across sources", () => {
    const report = run({
      wardrobeHealth: health({
        recommendations: [
          "Style or rehome never-worn pieces like Beige Chinos, Armani Code.",
        ],
      }),
      usageAnalytics: usage({
        neverWornItems: [
          { id: "n1", name: "Beige Chinos", category: "Bottom" },
          { id: "n2", name: "Armani Code", category: "Fragrance" },
        ],
      }),
    });

    const matches = report.insights.filter((i) => i.id === "never-worn");
    expect(matches).toHaveLength(1);
    // The structured warning kept its type, and merged the recommendation text.
    expect(matches[0].type).toBe("warning");
    expect(
      matches[0].suggestedActions.some((a) => a.includes("rehome never-worn")),
    ).toBe(true);
  });

  it("prioritizes high-impact issues first", () => {
    const report = run({
      wardrobeHealth: health({
        overallScore: 45, // critical
        occasions: {
          officeDaily: 95, // low-priority strength
          smartCasual: 90,
          travel: 90,
          social: 90,
          formal: 80,
          gym: 90,
          home: 90,
        } as WardrobeHealth["occasions"],
      }),
      usageAnalytics: usage(),
    });

    expect(report.insights[0].priority).toBe("critical");
    expect(report.insights[0].id).toBe("low-overall-health");
    // Priority is non-increasing across the sorted list.
    const ranks = report.insights.map((i) =>
      ({ low: 0, medium: 1, high: 2, critical: 3 })[i.priority],
    );
    for (let k = 1; k < ranks.length; k += 1) {
      expect(ranks[k]).toBeLessThanOrEqual(ranks[k - 1]);
    }
  });

  it("limits topActions to five", () => {
    const report = run({
      wardrobeHealth: health({
        gaps: Array.from({ length: 8 }, (_, i) => ({
          label: `Staple ${i}`,
          kind: "staple" as const,
          detail: "Missing.",
          priority: "medium" as const,
        })),
      }),
      usageAnalytics: usage({
        neverWornItems: [{ id: "n1", name: "A", category: "Top" }],
        staleItems: [usageItem({ id: "s1" })],
      }),
    });
    expect(report.topActions.length).toBeLessThanOrEqual(5);
  });

  it("surfaces poor cost-per-wear from usage and purchase data", () => {
    const report = run({
      wardrobeHealth: health(),
      usageAnalytics: usage({
        costPerWearHighlights: {
          bestValue: [],
          worstValue: [
            { id: "w1", name: "Splurge Jacket", category: "Outerwear", price: 8000, wearCount: 1, costPerWear: 8000 },
          ],
        },
      }),
      purchaseAnalytics: {
        totalWardrobeValue: 100000,
        averageCostPerWear: 500,
        mostExpensiveItem: {
          id: "w1",
          code: "C1",
          name: "Splurge Jacket",
          price: 8000,
          brand: "Brand",
          category: "Outerwear",
          wearCount: 1,
          costPerWear: 8000,
        },
        cheapestItem: null,
        topBrandsByValue: [],
        spendingByBrand: [],
        spendingByCategory: [],
        monthlyTimeline: [],
      },
    });

    const cpw = report.insights.filter((i) => i.id === "poor-cost-per-wear");
    expect(cpw).toHaveLength(1); // usage + purchase merged
    expect(cpw[0].priority).toBe("high");
    expect(cpw[0].relatedItemIds).toContain("w1");
  });

  it("is deterministic and stamps the injected createdAt", () => {
    const ctx: InsightContext = {
      wardrobeHealth: health({ gaps: [{ label: "Sage linen shirt", kind: "staple", detail: "x", priority: "medium" }] }),
      usageAnalytics: usage({ staleItems: [usageItem({ id: "s1" })] }),
    };
    const a = generateInsights(ctx, { generatedAt: GENERATED_AT });
    const b = generateInsights(ctx, { generatedAt: GENERATED_AT });
    expect(a).toEqual(b);
    expect(a.insights.every((i) => i.createdAt === GENERATED_AT)).toBe(true);
    expect(a.overallSummary).toContain("insights");
  });

  it("handles an empty context without crashing", () => {
    const report = run({ wardrobeHealth: health(), usageAnalytics: usage() });
    expect(Array.isArray(report.insights)).toBe(true);
    expect(report.overallSummary).toContain("Wardrobe health 92/100");
  });
});
