import { describe, expect, it } from "vitest";

import { evaluateBuyVsSkip } from "@/domain/acquisition/BuyVsSkipEngine";
import type { BuyVsSkipInput, ProspectiveItem } from "@/domain/acquisition/types";
import type { StyleDNAItem } from "@/domain/style-dna";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import type { UsageAnalytics } from "@/domain/analytics/UsageAnalyticsEngine";

const AT = "2026-07-07T00:00:00.000Z";

function item(overrides: Partial<StyleDNAItem> = {}): StyleDNAItem {
  return {
    id: overrides.id ?? "i1",
    name: "Item",
    category: "Tops",
    subcategory: null,
    color: "Navy",
    colorFamily: null,
    brand: null,
    formality: "smart_casual",
    usage: "regular",
    rating: 8,
    material: "Cotton",
    seasons: ["Year Round"],
    styles: ["Smart Casual"],
    tags: ["Office"],
    ...overrides,
  };
}

/** A small, varied wardrobe with the three core slots covered. */
function wardrobe(): StyleDNAItem[] {
  return [
    item({ id: "t1", name: "White Oxford Shirt", category: "Shirts", color: "White" }),
    item({ id: "t2", name: "Grey Tee", category: "T-Shirts", color: "Grey", formality: "casual" }),
    item({ id: "b1", name: "Beige Chinos", category: "Chinos", color: "Beige", formality: "smart_casual" }),
    item({ id: "b2", name: "Dark Jeans", category: "Jeans", color: "Blue", formality: "casual" }),
    item({ id: "f1", name: "White Sneakers", category: "Sneakers", color: "White", formality: "casual" }),
    item({ id: "f2", name: "Nike Air Force 1", category: "Sneakers", color: "White", formality: "casual" }),
  ];
}

const gapHealth: WardrobeHealth = {
  overallScore: 80,
  categoryScores: {} as WardrobeHealth["categoryScores"],
  occasions: {} as WardrobeHealth["occasions"],
  seasons: {} as WardrobeHealth["seasons"],
  strengths: ["Strong tops"],
  weaknesses: ["Thin on trousers"],
  recommendations: ["Add smart trousers"],
  duplicates: [],
  gaps: [
    { label: "Charcoal grey smart trousers", kind: "staple", detail: "…", priority: "high" },
  ],
};

function baseInput(overrides: Partial<BuyVsSkipInput> = {}): BuyVsSkipInput {
  return { item: prospective(), wardrobe: wardrobe(), ...overrides };
}

function prospective(overrides: Partial<ProspectiveItem> = {}): ProspectiveItem {
  return {
    name: "Charcoal Grey Smart Trousers",
    category: "Trousers",
    color: "Charcoal Grey",
    formality: "smart_casual",
    styleTags: ["Smart Casual"],
    intendedOccasions: ["Office"],
    estimatedPrice: 3000,
    material: "Wool blend",
    ...overrides,
  };
}

describe("evaluateBuyVsSkip", () => {
  it("returns buy for a high gap-fill, versatile item", () => {
    const usage: UsageAnalytics = {
      totalWears: 50,
      wornItemCount: 6,
      neverWornItems: [],
      mostWornItems: [],
      leastWornActiveItems: [],
      recentlyWornItems: [],
      staleItems: [],
      categoryUsage: [
        { category: "Trousers", itemCount: 2, wearCount: 16, wearsPerItem: 8, neverWornCount: 0 },
      ],
      usageByOccasion: [],
      insights: [],
      recommendations: [],
    };
    const result = evaluateBuyVsSkip(baseInput({ health: gapHealth, usage }), { generatedAt: AT });

    expect(result.decision).toBe("buy");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.explainabilityCodes).toContain("GAP_MATCH");
    expect(result.explainabilityCodes).toContain("DECISION_BUY");
    expect(result.reasonsToBuy.length).toBeGreaterThan(0);
  });

  it("returns skip (or consider) for a near-duplicate, low-use item", () => {
    const dupWardrobe = [
      ...wardrobe(),
      item({ id: "dup1", name: "White Sneakers B", category: "Sneakers", color: "White", formality: "casual" }),
      item({ id: "dup2", name: "White Sneakers C", category: "Sneakers", color: "White", formality: "casual" }),
    ];
    const usage: UsageAnalytics = {
      totalWears: 5,
      wornItemCount: 8,
      neverWornItems: [],
      mostWornItems: [],
      leastWornActiveItems: [
        { id: "f1", name: "White Sneakers", category: "Sneakers", wearCount: 0, lastWornOn: null, daysSinceLastWorn: null },
        { id: "f2", name: "Nike Air Force 1", category: "Sneakers", wearCount: 1, lastWornOn: null, daysSinceLastWorn: 200 },
      ],
      recentlyWornItems: [],
      staleItems: [
        { id: "dup1", name: "White Sneakers B", category: "Sneakers", wearCount: 0, lastWornOn: null, daysSinceLastWorn: null },
      ],
      categoryUsage: [
        { category: "Sneakers", itemCount: 4, wearCount: 2, wearsPerItem: 0.5, neverWornCount: 3 },
      ],
      usageByOccasion: [],
      insights: [],
      recommendations: [],
    };
    const result = evaluateBuyVsSkip(
      baseInput({
        item: prospective({
          name: "White Sneakers",
          category: "Sneakers",
          color: "White",
          formality: "casual",
          intendedOccasions: [],
        }),
        wardrobe: dupWardrobe,
        usage,
      }),
      { generatedAt: AT },
    );

    expect(["skip", "consider"]).toContain(result.decision);
    expect(result.explainabilityCodes).toContain("GUARD_DUPLICATE_CAP");
    expect(result.scoreBreakdown.duplicateRisk.score).toBeGreaterThanOrEqual(8);
    expect(result.similarExistingItems.length).toBeGreaterThan(0);
  });

  it("lowers confidence and never returns buy for sparse input", () => {
    const result = evaluateBuyVsSkip(
      { item: { name: "Mystery thing", category: "Accessories" }, wardrobe: wardrobe() },
      { generatedAt: AT },
    );
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.decision).not.toBe("buy");
    expect(result.explainabilityCodes).toContain("SPARSE_INPUT");
  });

  it("handles a missing price gracefully (cost confidence 0, no crash)", () => {
    const result = evaluateBuyVsSkip(
      baseInput({ item: prospective({ estimatedPrice: null }), health: gapHealth }),
      { generatedAt: AT },
    );
    expect(result.estimatedCostPerWear).toBeNull();
    expect(result.scoreBreakdown.costEfficiency.confidence).toBe(0);
    expect(result.explainabilityCodes).toContain("COST_UNKNOWN");
  });

  it("high outfit compatibility improves the score vs a poor match", () => {
    const strong = evaluateBuyVsSkip(baseInput({ health: gapHealth }), { generatedAt: AT });
    // A wardrobe with no complementary items → weaker outfit compatibility.
    const weak = evaluateBuyVsSkip(
      baseInput({ wardrobe: [item({ id: "only", name: "Lonely Tee", category: "T-Shirts" })], health: gapHealth }),
      { generatedAt: AT },
    );
    expect(strong.scoreBreakdown.outfitCompatibility.score).toBeGreaterThanOrEqual(
      weak.scoreBreakdown.outfitCompatibility.score,
    );
  });

  it("caps the decision when duplicate risk is high", () => {
    const dupWardrobe = [
      item({ id: "b1", name: "Beige Chinos", category: "Trousers", color: "Beige", formality: "smart_casual" }),
      item({ id: "b2", name: "Beige Chinos 2", category: "Trousers", color: "Beige", formality: "smart_casual" }),
      item({ id: "t1", name: "White Shirt", category: "Shirts", color: "White" }),
      item({ id: "f1", name: "Sneakers", category: "Sneakers", color: "White", formality: "casual" }),
    ];
    const result = evaluateBuyVsSkip(
      baseInput({
        item: prospective({ name: "Beige Chinos", category: "Trousers", color: "Beige", formality: "smart_casual" }),
        wardrobe: dupWardrobe,
      }),
      { generatedAt: AT },
    );
    expect(result.decision).not.toBe("buy");
    expect(result.explainabilityCodes).toContain("GUARD_DUPLICATE_CAP");
  });

  it("is deterministic for the same input + generatedAt", () => {
    const a = evaluateBuyVsSkip(baseInput({ health: gapHealth }), { generatedAt: AT });
    const b = evaluateBuyVsSkip(baseInput({ health: gapHealth }), { generatedAt: AT });
    expect(a).toEqual(b);
  });

  it("computes a wardrobe impact score", () => {
    const result = evaluateBuyVsSkip(baseInput({ health: gapHealth }), { generatedAt: AT });
    expect(result.wardrobeImpactScore).toBeGreaterThanOrEqual(0);
    expect(result.wardrobeImpactScore).toBeLessThanOrEqual(100);
  });

  it("records contributing engines in the decision trace + metadata", () => {
    const result = evaluateBuyVsSkip(baseInput({ health: gapHealth }), { generatedAt: AT });
    expect(result.metadata.contributingEngines.buyVsSkip).toBeTruthy();
    expect(result.metadata.contributingEngines.styleDNA).toBeTruthy();
    expect(result.metadata.contributingEngines.outfit).toBeTruthy();
    expect(result.metadata.contributingEngines.wardrobeHealth).toBeTruthy();
    expect(result.decisionTrace.some((t) => t.step.startsWith("dimension:"))).toBe(true);
    expect(result.decisionTrace.some((t) => t.step === "composite")).toBe(true);
  });

  it("generates explainability codes and a final decision code", () => {
    const result = evaluateBuyVsSkip(baseInput({ health: gapHealth }), { generatedAt: AT });
    expect(result.explainabilityCodes.length).toBeGreaterThan(0);
    expect(
      result.explainabilityCodes.some((c) =>
        ["DECISION_BUY", "DECISION_CONSIDER", "DECISION_SKIP"].includes(c),
      ),
    ).toBe(true);
  });
});
