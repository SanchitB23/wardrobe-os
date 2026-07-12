/**
 * RFC-024 Catalog Review — domain tests.
 */

import { describe, expect, it } from "vitest";

import {
  areDuplicates,
  classifyCatalogIssues,
  collectItemIssues,
  findDuplicateGroups,
  findSimilarPairs,
  namesAreSimilar,
  scoreDuplicatePair,
  scoreSimilarPair,
  type CatalogItemView,
} from "@/domain/catalog-review";

function item(
  overrides: Partial<CatalogItemView> & Pick<CatalogItemView, "id" | "name">,
): CatalogItemView {
  return {
    code: overrides.code ?? `C-${overrides.id}`,
    status: "active",
    categoryId: "cat-top",
    categoryName: "Tops",
    subcategoryId: "sub-1",
    brandId: "brand-1",
    brandName: "Brand",
    colorId: "color-1",
    colorName: "White",
    hasMaterial: true,
    hasSeason: true,
    hasOccasion: true,
    hasPrimaryImage: true,
    visualStatus: "accepted",
    ...overrides,
  };
}

describe("duplicate detection", () => {
  it("flags same code as duplicate", () => {
    const a = item({ id: "1", name: "Shirt A", code: "ABC" });
    const b = item({
      id: "2",
      name: "Shirt B",
      code: "abc",
      colorId: "color-2",
      colorName: "Wine",
    });
    expect(scoreDuplicatePair(a, b)).toEqual({
      kind: "duplicate",
      reason: "same_code",
    });
    expect(areDuplicates(a, b)).toBe(true);
  });

  it("flags same name + category + color as same_identity", () => {
    const a = item({ id: "1", name: "Oxford Shirt", code: "A1" });
    const b = item({ id: "2", name: "Oxford Shirt", code: "A2" });
    expect(scoreDuplicatePair(a, b)).toEqual({
      kind: "duplicate",
      reason: "same_identity",
    });
  });

  it("does not treat fuzzy name alone as duplicate", () => {
    const a = item({
      id: "1",
      name: "Solid White Shirt",
      code: "W1",
      colorId: "c-white",
      colorName: "White",
    });
    const b = item({
      id: "2",
      name: "Solid Wine Shirt",
      code: "W2",
      colorId: "c-wine",
      colorName: "Wine",
    });
    expect(scoreDuplicatePair(a, b)).toEqual({ kind: "none" });
    expect(areDuplicates(a, b)).toBe(false);
  });

  it("excludes retired by default from groups", () => {
    const a = item({ id: "1", name: "Same", code: "X" });
    const b = item({ id: "2", name: "Other", code: "X", status: "retired" });
    expect(findDuplicateGroups([a, b])).toHaveLength(0);
    expect(findDuplicateGroups([a, b], { includeRetired: true })).toHaveLength(
      1,
    );
  });
});

describe("similar item detection — color-aware false positives", () => {
  it("Solid White Shirt vs Solid Wine Shirt → similar, not duplicate", () => {
    const a = item({
      id: "1",
      name: "Solid White Shirt",
      code: "W1",
      colorId: "c-white",
      colorName: "White",
    });
    const b = item({
      id: "2",
      name: "Solid Wine Shirt",
      code: "W2",
      colorId: "c-wine",
      colorName: "Wine",
    });
    expect(areDuplicates(a, b)).toBe(false);
    expect(namesAreSimilar(a.name, b.name)).toBe(true);
    expect(scoreSimilarPair(a, b)).toEqual({
      kind: "similar",
      reason: "similar_name_diff_color",
    });
  });

  it("Olive Activewear T-Shirt vs White Activewear T-Shirt → similar, not duplicate", () => {
    const a = item({
      id: "1",
      name: "Olive Activewear T-Shirt",
      code: "O1",
      colorId: "c-olive",
      colorName: "Olive",
    });
    const b = item({
      id: "2",
      name: "White Activewear T-Shirt",
      code: "W1",
      colorId: "c-white",
      colorName: "White",
    });
    expect(areDuplicates(a, b)).toBe(false);
    expect(scoreSimilarPair(a, b)).toEqual({
      kind: "similar",
      reason: "similar_name_diff_color",
    });
  });

  it("similar name + different brand → similar_name_diff_meta", () => {
    const x = item({
      id: "3",
      name: "Solid White Shirt",
      code: "C",
      brandId: "b1",
      brandName: "Acme",
      colorId: "c-white",
      colorName: "White",
    });
    const y = item({
      id: "4",
      name: "Solid Wine Shirt",
      code: "D",
      brandId: "b2",
      brandName: "Other",
      colorId: "c-white",
      colorName: "White",
    });
    expect(areDuplicates(x, y)).toBe(false);
    expect(scoreSimilarPair(x, y)).toEqual({
      kind: "similar",
      reason: "similar_name_diff_meta",
    });
  });
});

describe("similar item detection — generic suffix false positives (RFC-025)", () => {
  it("Peach Waffle Blazer vs Grey Blazer → not similar", () => {
    const a = item({
      id: "1",
      name: "Peach Waffle Blazer",
      code: "P1",
      categoryId: "cat-outer",
      categoryName: "Outerwear",
      colorId: "c-peach",
      colorName: "Peach",
    });
    const b = item({
      id: "2",
      name: "Grey Blazer",
      code: "G1",
      categoryId: "cat-outer",
      categoryName: "Outerwear",
      colorId: "c-grey",
      colorName: "Grey",
    });
    expect(namesAreSimilar(a.name, b.name)).toBe(false);
    expect(scoreSimilarPair(a, b)).toEqual({ kind: "none" });
    expect(findSimilarPairs([a, b])).toHaveLength(0);
  });

  it("Navy Chinos vs Pleated Wool Chinos → not similar", () => {
    const a = item({
      id: "1",
      name: "Navy Chinos",
      code: "N1",
      colorId: "c-navy",
      colorName: "Navy",
    });
    const b = item({
      id: "2",
      name: "Pleated Wool Chinos",
      code: "P1",
      colorId: "c-khaki",
      colorName: "Khaki",
    });
    expect(scoreSimilarPair(a, b)).toEqual({ kind: "none" });
  });

  it("Blue Oxford vs White Oxford Shirt → not similar (abbreviated)", () => {
    const a = item({
      id: "1",
      name: "Blue Oxford",
      code: "B1",
      colorId: "c-blue",
      colorName: "Blue",
    });
    const b = item({
      id: "2",
      name: "White Oxford Shirt",
      code: "W1",
      colorId: "c-white",
      colorName: "White",
    });
    expect(scoreSimilarPair(a, b)).toEqual({ kind: "none" });
  });
});

describe("similar item detection — category gate (RFC-025)", () => {
  it("parallel skeleton + different categoryId (both set) → not similar", () => {
    const a = item({
      id: "1",
      name: "Solid White Shirt",
      code: "A",
      categoryId: "cat-tops",
      categoryName: "Tops",
      colorId: "c-white",
      colorName: "White",
    });
    const b = item({
      id: "2",
      name: "Solid Wine Shirt",
      code: "B",
      categoryId: "cat-other",
      categoryName: "Other",
      colorId: "c-wine",
      colorName: "Wine",
    });
    expect(namesAreSimilar(a.name, b.name)).toBe(true);
    expect(scoreSimilarPair(a, b)).toEqual({ kind: "none" });
  });

  it("parallel skeleton + one categoryId null → still similar", () => {
    const a = item({
      id: "1",
      name: "Solid White Shirt",
      code: "A",
      categoryId: null,
      categoryName: null,
      colorId: "c-white",
      colorName: "White",
    });
    const b = item({
      id: "2",
      name: "Solid Wine Shirt",
      code: "B",
      categoryId: "cat-tops",
      categoryName: "Tops",
      colorId: "c-wine",
      colorName: "Wine",
    });
    expect(scoreSimilarPair(a, b)).toEqual({
      kind: "similar",
      reason: "similar_name_diff_color",
    });
  });

  it("parallel skeleton + same category + color diff → similar", () => {
    const a = item({
      id: "1",
      name: "Solid White Shirt",
      code: "A",
      categoryId: "cat-tops",
      colorId: "c-white",
      colorName: "White",
    });
    const b = item({
      id: "2",
      name: "Solid Wine Shirt",
      code: "B",
      categoryId: "cat-tops",
      colorId: "c-wine",
      colorName: "Wine",
    });
    expect(scoreSimilarPair(a, b)).toEqual({
      kind: "similar",
      reason: "similar_name_diff_color",
    });
  });
});

describe("dismissed pairs do not reappear", () => {
  it("hides dismissed similar pair", () => {
    const a = item({
      id: "1",
      name: "Solid White Shirt",
      colorId: "c-white",
      colorName: "White",
      code: "A",
    });
    const b = item({
      id: "2",
      name: "Solid Wine Shirt",
      colorId: "c-wine",
      colorName: "Wine",
      code: "B",
    });
    expect(findSimilarPairs([a, b])).toHaveLength(1);
    expect(
      findSimilarPairs([a, b], {
        dismissals: [{ itemIdA: "1", itemIdB: "2", kind: "similar" }],
      }),
    ).toHaveLength(0);
  });

  it("hides dismissed duplicate pair", () => {
    const a = item({ id: "1", name: "A", code: "SAME" });
    const b = item({ id: "2", name: "B", code: "SAME" });
    expect(findDuplicateGroups([a, b])).toHaveLength(1);
    expect(
      findDuplicateGroups([a, b], {
        dismissals: [{ itemIdA: "1", itemIdB: "2", kind: "duplicate" }],
      }),
    ).toHaveLength(0);
  });
});

describe("metadata / image / visual issues", () => {
  it("detects missing metadata fields", () => {
    const sparse = item({
      id: "1",
      name: "Sparse",
      colorId: null,
      colorName: null,
      brandId: null,
      brandName: null,
      categoryId: null,
      categoryName: null,
      subcategoryId: null,
      hasMaterial: false,
      hasSeason: false,
      hasOccasion: false,
    });
    const kinds = collectItemIssues(sparse).map((i) => i.kind);
    expect(kinds).toContain("missing_color");
    expect(kinds).toContain("missing_brand");
    expect(kinds).toContain("missing_category");
    expect(kinds).toContain("missing_material");
    expect(kinds).toContain("missing_season");
    expect(kinds).toContain("missing_occasion");
  });

  it("detects unbranded brand name", () => {
    const u = item({
      id: "1",
      name: "Tee",
      brandId: "b-u",
      brandName: "Unbranded",
    });
    expect(collectItemIssues(u).some((i) => i.kind === "unbranded")).toBe(true);
  });

  it("detects missing image and visual pending/stale", () => {
    const noImg = item({
      id: "1",
      name: "No img",
      hasPrimaryImage: false,
      visualStatus: "none",
    });
    const stale = item({
      id: "2",
      name: "Stale",
      visualStatus: "stale",
    });
    expect(
      collectItemIssues(noImg).some((i) => i.kind === "missing_image"),
    ).toBe(true);
    expect(
      collectItemIssues(noImg).some((i) => i.kind === "visual_pending"),
    ).toBe(true);
    expect(
      collectItemIssues(stale).some((i) => i.kind === "visual_stale"),
    ).toBe(true);
  });

  it("detects bad code and invalid status", () => {
    const bad = item({
      id: "1",
      name: "X",
      code: "  ",
      status: null,
    });
    const kinds = collectItemIssues(bad).map((i) => i.kind);
    expect(kinds).toContain("bad_code");
    expect(kinds).toContain("invalid_status");
  });
});

describe("classifyCatalogIssues", () => {
  it("builds sections and quality score", () => {
    const model = classifyCatalogIssues([
      item({
        id: "1",
        name: "Solid White Shirt",
        code: "A",
        colorId: "cw",
        colorName: "White",
      }),
      item({
        id: "2",
        name: "Solid Wine Shirt",
        code: "B",
        colorId: "cn",
        colorName: "Wine",
      }),
      item({
        id: "3",
        name: "Incomplete",
        code: "C",
        colorId: null,
        hasPrimaryImage: false,
        visualStatus: "none",
      }),
    ]);
    expect(model.duplicates).toHaveLength(0);
    expect(model.similar.length).toBeGreaterThanOrEqual(1);
    expect(model.missingImages.length).toBeGreaterThanOrEqual(1);
    expect(model.qualityScore).toBeGreaterThanOrEqual(0);
    expect(model.qualityScore).toBeLessThanOrEqual(100);
  });
});
