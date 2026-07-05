import { describe, expect, it } from "vitest";

import {
  applyQuickFilters,
  itemNeedsReview,
  parseInventoryParams,
  serializeInventoryParams,
  sortItems,
  type SortRule,
} from "@/features/inventory/lib/inventory-view";
import type { LookupOption, WardrobeItemRow } from "@/types/wardrobe";

function makeItem(overrides: Partial<WardrobeItemRow> = {}): WardrobeItemRow {
  return {
    id: "i1",
    code: "TS-001",
    name: "Black Tee",
    category_id: "c1",
    subcategory_id: null,
    brand_id: null,
    primary_color_id: null,
    status: "active",
    ownership: "owned",
    fit: null,
    formality: null,
    rating: 7,
    usage: "regular",
    notes: null,
    favorite: false,
    created_at: "2026-01-01",
    category: { id: "c1", name: "Top" },
    subcategory: null,
    brand: null,
    primary_color: null,
    primary_image_url: "http://img/1.jpg",
    ...overrides,
  };
}

const LOOKUPS = {
  categories: [{ id: "c1", name: "Top" }] as LookupOption[],
  subcategories: [{ id: "s1", name: "T-Shirt" }] as LookupOption[],
  brands: [{ id: "b1", name: "Nike" }] as LookupOption[],
  colors: [{ id: "col1", name: "Black" }] as LookupOption[],
};

describe("itemNeedsReview", () => {
  it("flags items missing a category, image, or rating", () => {
    expect(itemNeedsReview(makeItem({ category: null }))).toBe(true);
    expect(itemNeedsReview(makeItem({ primary_image_url: null }))).toBe(true);
    expect(itemNeedsReview(makeItem({ rating: null }))).toBe(true);
  });

  it("does not flag a fully described item", () => {
    expect(itemNeedsReview(makeItem())).toBe(false);
  });
});

describe("applyQuickFilters", () => {
  const items = [
    makeItem({ id: "fav", favorite: true }),
    makeItem({ id: "hero", usage: "hero" }),
    makeItem({ id: "rare", usage: "rare" }),
    makeItem({ id: "review", rating: null }),
    makeItem({ id: "plain" }),
  ];

  it("returns all items when no quick filters are active", () => {
    expect(applyQuickFilters(items, new Set())).toHaveLength(5);
  });

  it("filters favorites", () => {
    expect(applyQuickFilters(items, new Set(["favorites"])).map((i) => i.id)).toEqual([
      "fav",
    ]);
  });

  it("filters hero and rare by usage", () => {
    expect(applyQuickFilters(items, new Set(["hero"])).map((i) => i.id)).toEqual(["hero"]);
    expect(applyQuickFilters(items, new Set(["rare"])).map((i) => i.id)).toEqual(["rare"]);
  });

  it("filters needs-review items", () => {
    expect(applyQuickFilters(items, new Set(["needs_review"])).map((i) => i.id)).toEqual([
      "review",
    ]);
  });

  it("AND-combines multiple quick filters", () => {
    const combined = [
      makeItem({ id: "both", favorite: true, usage: "hero" }),
      makeItem({ id: "onlyfav", favorite: true }),
    ];
    expect(
      applyQuickFilters(combined, new Set(["favorites", "hero"])).map((i) => i.id),
    ).toEqual(["both"]);
  });
});

describe("sortItems", () => {
  const items = [
    makeItem({ id: "a", name: "Beta", rating: 5 }),
    makeItem({ id: "b", name: "Alpha", rating: 9 }),
    makeItem({ id: "c", name: "Alpha", rating: 3 }),
  ];

  it("sorts by a single column ascending", () => {
    const rules: SortRule[] = [{ column: "name", direction: "asc" }];
    expect(sortItems(items, rules).map((i) => i.name)).toEqual([
      "Alpha",
      "Alpha",
      "Beta",
    ]);
  });

  it("breaks ties with a second sort rule", () => {
    const rules: SortRule[] = [
      { column: "name", direction: "asc" },
      { column: "rating", direction: "desc" },
    ];
    expect(sortItems(items, rules).map((i) => i.id)).toEqual(["b", "c", "a"]);
  });

  it("does not mutate the input array", () => {
    const input = [...items];
    sortItems(input, [{ column: "rating", direction: "asc" }]);
    expect(input.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("returns the original order when no rules are given", () => {
    expect(sortItems(items, []).map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("inventory URL params", () => {
  it("serializes filters and quick filters using human-readable names", () => {
    const params = serializeInventoryParams(
      {
        filters: { categoryId: "c1", brandId: "b1", status: "active", search: "tee" },
        quickFilters: new Set(["favorites", "hero"]),
      },
      LOOKUPS,
    );
    const parsed = new URLSearchParams(params);
    expect(parsed.get("category")).toBe("Top");
    expect(parsed.get("brand")).toBe("Nike");
    expect(parsed.get("status")).toBe("active");
    expect(parsed.get("q")).toBe("tee");
    expect(parsed.get("quick")).toBe("favorites,hero");
  });

  it("round-trips back to the same filters and quick filters", () => {
    const original = {
      filters: {
        categoryId: "c1",
        subcategoryId: "s1",
        brandId: "b1",
        primaryColorId: "col1",
        usage: "hero" as const,
        search: "wool",
      },
      quickFilters: new Set(["rare" as const]),
    };
    const params = serializeInventoryParams(original, LOOKUPS);
    const parsed = parseInventoryParams(new URLSearchParams(params), LOOKUPS);

    expect(parsed.filters.categoryId).toBe("c1");
    expect(parsed.filters.subcategoryId).toBe("s1");
    expect(parsed.filters.brandId).toBe("b1");
    expect(parsed.filters.primaryColorId).toBe("col1");
    expect(parsed.filters.usage).toBe("hero");
    expect(parsed.filters.search).toBe("wool");
    expect([...parsed.quickFilters]).toEqual(["rare"]);
  });

  it("ignores unknown names gracefully", () => {
    const parsed = parseInventoryParams(
      new URLSearchParams("category=Nonexistent&brand=Nike"),
      LOOKUPS,
    );
    expect(parsed.filters.categoryId).toBeUndefined();
    expect(parsed.filters.brandId).toBe("b1");
  });
});
