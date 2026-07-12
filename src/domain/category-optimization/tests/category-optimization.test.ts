/**
 * Category Optimization (RFC-015A) — domain unit tests.
 */

import { describe, expect, it } from "vitest";

import {
  buildCategoryOptimization,
  clusterCategoryKey,
  computeCategoryScore,
  computeIdealCount,
  densityScore,
  toCategoryKey,
  type CategoryOptimizationContext,
  type CategoryOptimizationItemInput,
} from "@/domain/category-optimization";
import { fromHealth } from "@/domain/intelligence/ActionGenerator";

const AT = "2026-07-12T00:00:00.000Z";

function item(
  partial: Partial<CategoryOptimizationItemInput> & {
    id: string;
    name: string;
  },
): CategoryOptimizationItemInput {
  return {
    category: "tops",
    color: "white",
    colorFamily: "white",
    formality: "casual",
    wearCount: 0,
    purchasePrice: 40,
    ...partial,
  };
}

function whiteCasualContext(
  items: CategoryOptimizationItemInput[],
): CategoryOptimizationContext {
  return {
    categoryKey: "tops-white-casual",
    label: "White Casual Tops",
    items,
    wardrobeSize: 60,
    healthScore: 62,
    roiScore: 55,
    coverageScore: 70,
    gapLabels: [],
    missingStyleHints: ["blue", "navy"],
  };
}

describe("category key + ideal count", () => {
  it("slugifies labels deterministically", () => {
    expect(toCategoryKey("6 white tops (casual)")).toBe("6-white-tops-casual");
    expect(clusterCategoryKey("tops", "white", "casual")).toBe(
      "tops-white-casual",
    );
  });

  it("ideal count stays in 2–4 and does not inflate dense clusters", () => {
    expect(computeIdealCount(0, 40)).toBe(2);
    expect(computeIdealCount(1, 40)).toBe(2);
    expect(computeIdealCount(6, 40)).toBe(2);
    expect(computeIdealCount(6, 90)).toBe(3);
    expect(computeIdealCount(3, 40)).toBe(2);
  });

  it("density score penalizes over-dense clusters", () => {
    expect(densityScore(2, 2)).toBe(100);
    expect(densityScore(6, 2)).toBeLessThan(50);
    expect(densityScore(1, 2)).toBe(50);
  });

  it("category score degrades gracefully when ROI/health missing", () => {
    const withAll = computeCategoryScore({
      currentCount: 6,
      idealCount: 2,
      healthScore: 70,
      roiScore: 60,
      coverageScore: 80,
      usageDistribution: [
        { bucket: "never", count: 2 },
        { bucket: "regular", count: 4 },
      ],
    });
    const cold = computeCategoryScore({
      currentCount: 6,
      idealCount: 2,
      healthScore: null,
      roiScore: null,
      coverageScore: null,
      usageDistribution: [{ bucket: "never", count: 6 }],
    });
    expect(withAll).toBeGreaterThan(0);
    expect(cold).toBeGreaterThan(0);
    expect(cold).toBeLessThanOrEqual(withAll + 15);
  });
});

describe("buildCategoryOptimization — golden white casual tops", () => {
  const items = [
    item({ id: "a", name: "White Tee A", wearCount: 12, purchasePrice: 20 }),
    item({ id: "b", name: "White Tee B", wearCount: 9, purchasePrice: 25 }),
    item({ id: "c", name: "White Shirt C", wearCount: 4, purchasePrice: 45 }),
    item({ id: "d", name: "White Tank D", wearCount: 2, purchasePrice: 15 }),
    item({ id: "e", name: "White Tee E", wearCount: 0, purchasePrice: 18 }),
    item({ id: "f", name: "White Tee F", wearCount: 0, purchasePrice: 22 }),
  ];

  it("Keep / Rotate / Retire pattern for 6 over-dense peers", () => {
    const result = buildCategoryOptimization(whiteCasualContext(items), {
      generatedAt: AT,
    });
    expect(result.analysis.currentCount).toBe(6);
    expect(result.analysis.idealCount).toBe(2);
    expect(result.analysis.reasonCodes).toContain("over_dense");

    const { summary } = result.plan;
    expect(summary.keep + summary.protect).toBeGreaterThanOrEqual(2);
    expect(summary.retire).toBe(2);
    expect(summary.rotate).toBeGreaterThanOrEqual(2);
    expect(summary.keep + summary.protect + summary.rotate + summary.retire + summary.ignore).toBe(6);
  });

  it("ranks high-wear items above never-worn duplicates", () => {
    const result = buildCategoryOptimization(whiteCasualContext(items), {
      generatedAt: AT,
    });
    expect(result.comparisons[0]?.itemId).toBe("a");
    expect(result.comparisons[result.comparisons.length - 1]?.wearCount).toBe(0);
  });

  it("protects over-worn high-value pieces", () => {
    const result = buildCategoryOptimization(whiteCasualContext(items), {
      generatedAt: AT,
    });
    const protectedIds = result.plan.items
      .filter((i) => i.decision === "protect")
      .map((i) => i.itemId);
    expect(protectedIds.length).toBeGreaterThanOrEqual(1);
    expect(protectedIds).toContain("a");
  });

  it("derives replacement opportunities when retiring / over-dense", () => {
    const result = buildCategoryOptimization(whiteCasualContext(items), {
      generatedAt: AT,
    });
    expect(result.plan.replacementOpportunities.length).toBeGreaterThan(0);
    const first = result.plan.replacementOpportunities[0]!;
    expect(first.prospective.name).toBeTruthy();
    expect(first.prospective.category).toBeTruthy();
  });

  it("is deterministic for same input + generatedAt", () => {
    const a = buildCategoryOptimization(whiteCasualContext(items), {
      generatedAt: AT,
    });
    const b = buildCategoryOptimization(whiteCasualContext(items), {
      generatedAt: AT,
    });
    expect(a).toEqual(b);
  });

  it("ignores protected items (no retire)", () => {
    const withProtected = [
      ...items.slice(0, 5),
      item({
        id: "f",
        name: "Heirloom Tee",
        wearCount: 0,
        protected: true,
        purchasePrice: 10,
      }),
    ];
    const result = buildCategoryOptimization(whiteCasualContext(withProtected), {
      generatedAt: AT,
    });
    const heirloom = result.plan.items.find((i) => i.itemId === "f");
    expect(heirloom?.decision).toBe("ignore");
  });

  it("handles null ROI and missing vision gracefully", () => {
    const sparse = items.map((i) => ({
      ...i,
      purchasePrice: null,
      outfitCoverage: null,
      recommendationFrequency: null,
      visualSimilarityPeers: undefined,
    }));
    const result = buildCategoryOptimization(
      {
        ...whiteCasualContext(sparse),
        healthScore: null,
        roiScore: null,
        coverageScore: null,
      },
      { generatedAt: AT },
    );
    expect(result.analysis.reasonCodes).toContain("cold_data");
    expect(result.comparisons.every((c) => c.roi == null || c.roi >= 0)).toBe(
      true,
    );
    expect(
      result.comparisons.every((c) => c.visualSimilarityPeers.length === 0),
    ).toBe(true);
    expect(result.plan.items.length).toBe(6);
  });

  it("engine performs no destructive mutations on context items", () => {
    const frozen = whiteCasualContext(items);
    const before = JSON.stringify(frozen);
    buildCategoryOptimization(frozen, { generatedAt: AT });
    expect(JSON.stringify(frozen)).toBe(before);
  });

  it("empty opportunities when balanced with no gaps", () => {
    const balanced = [
      item({ id: "a", name: "A", wearCount: 5 }),
      item({ id: "b", name: "B", wearCount: 4 }),
    ];
    const result = buildCategoryOptimization(
      {
        categoryKey: "tops-white-casual",
        label: "White Casual Tops",
        items: balanced,
        wardrobeSize: 40,
        healthScore: 80,
        roiScore: 75,
        coverageScore: 80,
        gapLabels: [],
        missingStyleHints: [],
      },
      { generatedAt: AT },
    );
    expect(result.analysis.reasonCodes).toContain("balanced");
    expect(result.plan.replacementOpportunities.length).toBe(0);
  });
});

describe("Intelligence Center replace card href (RFC-015A)", () => {
  it("duplicate cards deep-link to /intelligence/optimize", () => {
    const actions = fromHealth({
      duplicates: [
        {
          label: "6 white tops (casual)",
          count: 6,
          categoryKey: "tops-white-casual",
        },
      ],
    });
    const replace = actions.find((a) => a.type === "replace");
    expect(replace?.href).toBe(
      "/intelligence/optimize?category=tops-white-casual",
    );
    expect(replace?.reason.toLowerCase()).toContain("optimize");
  });

  it("worn-out cards deep-link with focus item", () => {
    const actions = fromHealth({
      wornOut: [
        {
          itemId: "item_42",
          label: "Old white tee",
          categoryKey: "tops-white-casual",
        },
      ],
    });
    const replace = actions.find((a) => a.reasonCodes.includes("worn_out"));
    expect(replace?.href).toContain("/intelligence/optimize?");
    expect(replace?.href).toContain("category=tops-white-casual");
    expect(replace?.href).toContain("focus=item_42");
    expect(replace?.reason.toLowerCase()).toContain("optimize");
  });
});
