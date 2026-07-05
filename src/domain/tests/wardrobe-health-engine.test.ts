import { describe, expect, it } from "vitest";

import {
  analyzeWardrobeHealth,
  buildWardrobeHealthDebug,
  categoryBucketFor,
  type WardrobeHealthItem,
} from "@/domain/analytics/WardrobeHealthEngine";
import type { FormalityEnum, ItemStatus } from "@/types/wardrobe";

let counter = 0;
function item(overrides: Partial<WardrobeHealthItem> = {}): WardrobeHealthItem {
  counter += 1;
  return {
    id: `i${counter}`,
    name: `Item ${counter}`,
    category: "Top",
    color: "Black",
    brand: "Uniqlo",
    formality: "casual",
    status: "active",
    ...overrides,
  };
}

function many(
  count: number,
  overrides: Partial<WardrobeHealthItem> = {},
): WardrobeHealthItem[] {
  return Array.from({ length: count }, (_, index) =>
    item({ ...overrides, color: overrides.color ?? `Color${index}` }),
  );
}

/** A balanced wardrobe that meets every category target. */
function balancedWardrobe(): WardrobeHealthItem[] {
  return [
    ...many(8, { category: "Top", formality: "business_casual" }),
    ...many(5, { category: "Bottom", formality: "business_casual" }),
    ...many(4, { category: "Footwear", formality: "business_casual" }),
    ...many(3, { category: "Outerwear", formality: "smart_casual" }),
    ...many(4, { category: "Accessory", formality: "casual" }),
    ...many(2, { category: "Fragrance", formality: "casual" }),
  ];
}

describe("categoryBucketFor", () => {
  it("maps raw category names onto buckets", () => {
    expect(categoryBucketFor("Top")).toBe("tops");
    expect(categoryBucketFor("Jeans")).toBe("bottoms");
    expect(categoryBucketFor("Sneakers")).toBe("footwear");
    expect(categoryBucketFor("Blazer")).toBe("outerwear");
    expect(categoryBucketFor("Belt")).toBe("accessories");
    expect(categoryBucketFor("Fragrance")).toBe("fragrance");
    expect(categoryBucketFor("Nonsense")).toBeNull();
    expect(categoryBucketFor(null)).toBeNull();
  });
});

describe("analyzeWardrobeHealth", () => {
  it("returns a zeroed report for an empty wardrobe", () => {
    const health = analyzeWardrobeHealth([]);
    expect(health.overallScore).toBe(0);
    expect(Object.values(health.categoryScores).every((s) => s === 0)).toBe(true);
    expect(health.gaps).toHaveLength(6);
    expect(health.duplicates).toEqual([]);
  });

  it("scores a balanced wardrobe highly with no gaps", () => {
    const health = analyzeWardrobeHealth(balancedWardrobe());
    expect(health.overallScore).toBeGreaterThan(70);
    expect(health.gaps).toHaveLength(0);
    expect(health.categoryScores.tops).toBe(100);
    expect(health.categoryScores.bottoms).toBe(100);
    expect(health.strengths.length).toBeGreaterThan(0);
  });

  it("flags underrepresented categories as gaps and weaknesses", () => {
    const health = analyzeWardrobeHealth([
      ...many(8, { category: "Top" }),
      ...many(1, { category: "Bottom" }),
    ]);
    const bottomsGap = health.gaps.find((gap) => gap.category === "bottoms");
    expect(bottomsGap).toEqual({
      category: "bottoms",
      current: 1,
      recommended: 5,
    });
    expect(
      health.weaknesses.some((w) => w.toLowerCase().includes("bottoms")),
    ).toBe(true);
    expect(
      health.recommendations.some((r) => r.includes("more bottoms")),
    ).toBe(true);
  });

  it("detects duplicate colors within a category", () => {
    const health = analyzeWardrobeHealth(
      many(5, { category: "Top", color: "Black" }),
    );
    const colorDup = health.duplicates.find((d) => d.type === "color");
    expect(colorDup?.count).toBe(5);
    expect(colorDup?.label).toContain("Black");
  });

  it("detects over-purchased categories", () => {
    const health = analyzeWardrobeHealth(
      many(20, { category: "Top", color: "Varied" }).map((it, i) => ({
        ...it,
        color: `C${i}`,
      })),
    );
    expect(
      health.duplicates.some((d) => d.type === "category"),
    ).toBe(true);
  });

  it("flags brand over-concentration", () => {
    const health = analyzeWardrobeHealth([
      ...many(8, { category: "Top", brand: "Nike", color: "Blue" }).map(
        (it, i) => ({ ...it, color: `B${i}` }),
      ),
      ...many(2, { category: "Bottom", brand: "Levis" }),
    ]);
    expect(
      health.weaknesses.some((w) => w.includes("Over-concentrated")),
    ).toBe(true);
    expect(
      health.recommendations.some((r) => r.includes("Diversify")),
    ).toBe(true);
  });

  it("computes office coverage from business-appropriate core items", () => {
    const business = [
      ...many(4, { category: "Top", formality: "business_casual" as FormalityEnum }),
      ...many(4, { category: "Bottom", formality: "business_formal" as FormalityEnum }),
      ...many(4, { category: "Footwear", formality: "formal" as FormalityEnum }),
    ];
    const casual = many(12, { category: "Top", formality: "casual" as FormalityEnum });
    expect(analyzeWardrobeHealth(business).coverage.office).toBeGreaterThan(
      analyzeWardrobeHealth(casual).coverage.office,
    );
  });

  it("excludes retired items from the analysis", () => {
    const retired = many(8, {
      category: "Top",
      status: "retired" as ItemStatus,
    });
    const health = analyzeWardrobeHealth(retired);
    expect(health.categoryScores.tops).toBe(0);
  });

  it("keeps all scores within 0–100", () => {
    const health = analyzeWardrobeHealth(balancedWardrobe());
    const all = [
      health.overallScore,
      ...Object.values(health.categoryScores),
      ...Object.values(health.coverage),
    ];
    for (const score of all) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});

describe("buildWardrobeHealthDebug", () => {
  it("reports total active items and excludes retired ones", () => {
    const debug = buildWardrobeHealthDebug([
      ...many(3, { category: "Top" }),
      ...many(2, { category: "Top", status: "retired" as ItemStatus }),
    ]);
    expect(debug.totalActiveItems).toBe(3);
    expect(debug.totalItems).toBe(5);
  });

  it("mirrors the reported scores exactly", () => {
    const items = balancedWardrobe();
    const health = analyzeWardrobeHealth(items);
    const debug = buildWardrobeHealthDebug(items);

    expect(debug.overall.score).toBe(health.overallScore);
    for (const row of debug.categoryScores) {
      expect(row.score).toBe(
        health.categoryScores[row.key as keyof typeof health.categoryScores],
      );
    }
    for (const row of debug.coverageScores) {
      expect(row.score).toBe(
        health.coverage[row.key as keyof typeof health.coverage],
      );
    }
  });

  it("tallies single-valued facets with a trailing none bucket", () => {
    const debug = buildWardrobeHealthDebug([
      item({ category: "Top" }),
      item({ category: "Top" }),
      item({ category: null }),
    ]);
    const category = debug.distributions.find((d) => d.key === "category");
    expect(category?.distinct).toBe(1);
    expect(category?.total).toBe(3);
    expect(category?.buckets[0]).toMatchObject({ label: "Top", count: 2 });
    expect(category?.buckets[0]?.percentage).toBe(67);
    expect(category?.buckets.at(-1)).toMatchObject({
      label: "— none —",
      count: 1,
    });
  });

  it("tallies multi-valued facets across items", () => {
    const debug = buildWardrobeHealthDebug([
      item({ seasons: ["Summer", "Winter"] }),
      item({ seasons: ["Summer"] }),
      item({ seasons: [] }),
    ]);
    const season = debug.distributions.find((d) => d.key === "season");
    expect(season?.distinct).toBe(2);
    expect(season?.total).toBe(4); // 2 Summer + 1 Winter + 1 none
    expect(season?.buckets.find((b) => b.label === "Summer")?.count).toBe(2);
    expect(season?.buckets.find((b) => b.label === "Winter")?.count).toBe(1);
    expect(season?.buckets.at(-1)).toMatchObject({ label: "— none —", count: 1 });
  });

  it("warns about missing metadata, unbranded, and unspecified colors", () => {
    const debug = buildWardrobeHealthDebug([
      item({ category: null, brand: "Unbranded", color: "Not Specified" }),
      item({ subcategory: null, seasons: [], styles: [], tags: [] }),
    ]);
    const keys = debug.warnings.map((w) => w.key);
    expect(keys).toContain("missing-category");
    expect(keys).toContain("missing-subcategory");
    expect(keys).toContain("missing-season");
    expect(keys).toContain("missing-style");
    expect(keys).toContain("missing-tags");
    expect(keys).toContain("unbranded");
    expect(keys).toContain("unspecified-color");

    const unbranded = debug.warnings.find((w) => w.key === "unbranded");
    expect(unbranded?.count).toBe(1);
    expect(unbranded?.items[0]?.name).toBeTruthy();
  });

  it("omits warnings with zero matching items", () => {
    const debug = buildWardrobeHealthDebug([
      item({
        category: "Top",
        subcategory: "Polo",
        color: "Black",
        brand: "Uniqlo",
        seasons: ["Summer"],
        styles: ["Minimal"],
        tags: ["Everyday"],
      }),
    ]);
    expect(debug.warnings).toHaveLength(0);
  });
});
