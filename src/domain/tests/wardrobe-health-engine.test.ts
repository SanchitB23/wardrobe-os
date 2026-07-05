import { describe, expect, it } from "vitest";

import {
  analyzeWardrobeHealth,
  buildWardrobeHealthDebug,
  categoryBucketFor,
  colorFamilyFor,
  type WardrobeHealthItem,
} from "@/domain/analytics/WardrobeHealthEngine";
import type { ItemStatus } from "@/types/wardrobe";

let counter = 0;
function item(overrides: Partial<WardrobeHealthItem> = {}): WardrobeHealthItem {
  counter += 1;
  return {
    id: `i${counter}`,
    name: `Item ${counter}`,
    category: "Top",
    color: "Black",
    brand: "Uniqlo",
    formality: "smart_casual",
    usage: "regular",
    rating: 9,
    status: "active",
    seasons: ["Year Round"],
    styles: ["Smart Casual"],
    tags: ["Casual"],
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

/**
 * A strong smart-casual wardrobe modelled on the real owner profile: ~46 tops,
 * 19 bottoms, 14 footwear, 9 outerwear, 26 accessories, 12 fragrance, broad
 * occasion coverage, year-round/summer seasons, all well-rated and regularly
 * worn. Colours are varied so nothing clusters as a duplicate.
 */
function strongWardrobe(): WardrobeHealthItem[] {
  const base: Partial<WardrobeHealthItem> = {
    formality: "smart_casual",
    usage: "regular",
    rating: 9,
    seasons: ["Year Round", "Summer"],
    styles: ["Smart Casual", "Modern", "Everyday Casual"],
    tags: ["Office", "Casual", "Everyday", "Travel"],
  };
  return [
    ...many(30, { ...base, category: "Top" }),
    ...many(8, { ...base, category: "Top", tags: ["Dinner", "Date", "Brewery", "Party"] }),
    ...many(8, { ...base, category: "Top", tags: ["Gym"], styles: ["Athleisure"] }),
    ...many(19, { ...base, category: "Bottom" }),
    ...many(14, { ...base, category: "Footwear" }),
    ...many(9, { ...base, category: "Outerwear", seasons: ["Winter", "Year Round"] }),
    ...many(20, { ...base, category: "Accessory" }),
    ...many(6, { ...base, category: "Accessory", tags: ["Wedding", "Formal"], formality: "formal" }),
    ...many(12, { ...base, category: "Fragrance" }),
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

describe("colorFamilyFor", () => {
  it("maps specific colours onto coarse families", () => {
    expect(colorFamilyFor("Charcoal")).toBe("grey");
    expect(colorFamilyFor("Navy")).toBe("navy");
    expect(colorFamilyFor("Sage")).toBe("green");
    expect(colorFamilyFor("Off-White")).toBe("white");
    expect(colorFamilyFor("Not Specified")).toBeNull();
    expect(colorFamilyFor(null)).toBeNull();
  });
});

describe("analyzeWardrobeHealth — calibrated for a Delhi smart-casual profile", () => {
  it("returns a zeroed report for an empty wardrobe", () => {
    const health = analyzeWardrobeHealth([]);
    expect(health.overallScore).toBe(0);
    expect(Object.values(health.categoryScores).every((s) => s === 0)).toBe(true);
    expect(health.gaps.some((g) => g.kind === "category")).toBe(true);
    expect(health.duplicates).toEqual([]);
  });

  it("scores the owner's real profile as strong overall", () => {
    const health = analyzeWardrobeHealth(strongWardrobe());
    expect(health.overallScore).toBeGreaterThanOrEqual(90);
    expect(health.categoryScores.tops).toBeGreaterThanOrEqual(90);
    expect(health.occasions.officeDaily).toBeGreaterThanOrEqual(90);
    expect(health.occasions.smartCasual).toBeGreaterThanOrEqual(90);
    expect(health.strengths.length).toBeGreaterThan(0);
    // A deep, useful tops category is not flagged as a duplicate problem.
    expect(health.duplicates.some((d) => d.severity === "excess")).toBe(false);
  });

  it("does not saturate at a flat 100 — quality signals leave headroom", () => {
    // Every piece rated 9/10 (not perfect) → composites cannot reach 100.
    const health = analyzeWardrobeHealth(strongWardrobe());
    expect(health.overallScore).toBeLessThan(100);
    expect(health.occasions.officeDaily).toBeLessThan(100);
    expect(health.categoryScores.tops).toBeLessThan(100);
  });

  it("penalizes rarely-worn dead weight (usage efficiency)", () => {
    const common = {
      category: "Top",
      rating: 9,
      tags: ["Office", "Casual"],
      seasons: ["Year Round"],
      styles: ["Smart Casual"],
    } as const;
    const worn = analyzeWardrobeHealth(many(40, { ...common, usage: "regular" }));
    const unworn = analyzeWardrobeHealth(many(40, { ...common, usage: "rare" }));

    expect(unworn.overallScore).toBeLessThan(worn.overallScore);
    expect(unworn.weaknesses.some((w) => /rarely worn/i.test(w))).toBe(true);
  });

  it("does not heavily penalize a formal-light wardrobe", () => {
    const rich = analyzeWardrobeHealth(strongWardrobe());
    const formalLight = strongWardrobe().filter(
      (i) => !(i.tags?.includes("Wedding") || i.formality === "formal"),
    );
    const light = analyzeWardrobeHealth(formalLight);

    expect(light.occasions.formal).toBeLessThan(rich.occasions.formal);
    expect(rich.overallScore - light.overallScore).toBeLessThanOrEqual(6);
    expect(light.overallScore).toBeGreaterThanOrEqual(80);
  });

  it("is not penalized for a summer-heavy, low-winter wardrobe", () => {
    // Otherwise-strong wardrobe, but every piece is tagged summer-only —
    // isolating season so winter/transitional coverage are the only deficits.
    const broadTags = ["Office", "Casual", "Everyday", "Travel", "Dinner", "Gym"];
    const broadStyles = ["Smart Casual", "Everyday Casual", "Athleisure"];
    const summer: Partial<WardrobeHealthItem> = {
      seasons: ["Summer"],
      tags: broadTags,
      styles: broadStyles,
    };
    const summerOnly = [
      ...many(30, { ...summer, category: "Top" }),
      ...many(15, { ...summer, category: "Bottom" }),
      ...many(10, { ...summer, category: "Footwear" }),
      ...many(8, { ...summer, category: "Accessory" }),
      ...many(6, { ...summer, category: "Fragrance" }),
      ...many(5, { ...summer, category: "Outerwear" }),
    ];
    const health = analyzeWardrobeHealth(summerOnly);

    expect(health.seasons.summer).toBeGreaterThanOrEqual(90);
    expect(health.seasons.winter).toBe(0); // no winter/year-round pieces at all
    // Even with zero winter/transitional coverage, the low season weight keeps
    // the overall score strong — a summer wardrobe isn't punished.
    expect(health.overallScore).toBeGreaterThanOrEqual(80);
  });

  it("penalizes missing office and smart-casual coverage", () => {
    const strong = analyzeWardrobeHealth(strongWardrobe());
    const gymOnly = analyzeWardrobeHealth(
      many(40, {
        category: "Top",
        formality: "casual",
        styles: ["Athleisure"],
        tags: ["Gym", "Home"],
        seasons: ["Summer", "Year Round"],
      }),
    );

    expect(gymOnly.occasions.officeDaily).toBeLessThan(50);
    expect(gymOnly.occasions.smartCasual).toBeLessThan(50);
    expect(gymOnly.overallScore).toBeLessThan(strong.overallScore);
    expect(
      gymOnly.weaknesses.some((w) => /office|smart casual/i.test(w)),
    ).toBe(true);
  });

  it("flags excess low-use duplicate clusters and lowers the score", () => {
    const base = strongWardrobe();
    const wellUsed = many(4, {
      category: "Top",
      color: "Black",
      formality: "casual",
      usage: "regular",
      rating: 9,
    });
    const lowUse = many(4, {
      category: "Top",
      color: "Black",
      formality: "casual",
      usage: "rare",
      rating: 6,
    });

    const withWellUsed = analyzeWardrobeHealth([...base, ...wellUsed]);
    const withLowUse = analyzeWardrobeHealth([...base, ...lowUse]);

    expect(withWellUsed.duplicates.some((d) => d.severity === "excess")).toBe(false);
    const excess = withLowUse.duplicates.find((d) => d.severity === "excess");
    expect(excess?.colorFamily).toBe("black");
    expect(excess?.lowValueCount).toBe(4);
    expect(withLowUse.overallScore).toBeLessThan(withWellUsed.overallScore);
  });

  it("does not flag a deep category with well-used pieces", () => {
    // 6 navy smart-casual tops, all loved and worn — not a duplicate problem.
    const health = analyzeWardrobeHealth(
      many(6, { category: "Top", color: "Navy", usage: "regular", rating: 9 }),
    );
    expect(health.duplicates).toHaveLength(0);
  });

  it("keeps white-shirt clusters on the watch list, never excess", () => {
    const health = analyzeWardrobeHealth(
      many(5, {
        category: "Top",
        subcategory: "Shirt",
        color: "White",
        formality: "smart_casual",
        usage: "rare",
        rating: 6,
      }),
    );
    const dup = health.duplicates.find((d) => d.colorFamily === "white");
    expect(dup?.severity).toBe("watch");
  });

  it("recommends practical smart-casual staples that are absent", () => {
    const health = analyzeWardrobeHealth(strongWardrobe());
    const staples = health.gaps
      .filter((g) => g.kind === "staple")
      .map((g) => g.label);

    expect(staples).toContain("Navy knit polo");
    expect(staples).toContain("Charcoal/grey smart trousers");
    // Never recommends generic items the profile doesn't call for.
    expect(
      health.gaps.some((g) => /loafer|watch|formal shoe/i.test(g.label)),
    ).toBe(false);
  });

  it("does not flag a staple that is already owned", () => {
    const withPolo = [
      ...strongWardrobe(),
      item({
        category: "Top",
        subcategory: "Polo",
        name: "Navy Knit Polo",
        color: "Navy",
      }),
    ];
    const health = analyzeWardrobeHealth(withPolo);
    expect(health.gaps.some((g) => g.label === "Navy knit polo")).toBe(false);
  });

  it("excludes retired items from the analysis", () => {
    const health = analyzeWardrobeHealth(
      many(30, { category: "Top", status: "retired" as ItemStatus }),
    );
    expect(health.categoryScores.tops).toBe(0);
  });

  it("keeps all scores within 0–100", () => {
    const health = analyzeWardrobeHealth(strongWardrobe());
    const all = [
      health.overallScore,
      ...Object.values(health.categoryScores),
      ...Object.values(health.occasions),
      ...Object.values(health.seasons),
    ];
    for (const s of all) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
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

  it("mirrors the reported scores exactly, with weights", () => {
    const items = strongWardrobe();
    const health = analyzeWardrobeHealth(items);
    const debug = buildWardrobeHealthDebug(items);

    expect(debug.overall.score).toBe(health.overallScore);
    for (const row of debug.categoryScores) {
      expect(row.score).toBe(
        health.categoryScores[row.key as keyof typeof health.categoryScores],
      );
    }
    for (const row of debug.occasionScores) {
      expect(row.score).toBe(
        health.occasions[row.key as keyof typeof health.occasions],
      );
      expect(row.weight).toBeGreaterThan(0);
    }
    for (const row of debug.seasonScores) {
      expect(row.score).toBe(
        health.seasons[row.key as keyof typeof health.seasons],
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
