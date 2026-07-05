import type {
  InventoryFilters,
  ItemStatus,
  LookupOption,
  UsageFrequency,
  WardrobeItemRow,
  WardrobeLookups,
} from "@/types/wardrobe";

export type QuickFilterKey = "favorites" | "hero" | "rare" | "needs_review";

export const QUICK_FILTERS: { key: QuickFilterKey; label: string }[] = [
  { key: "favorites", label: "Favorites" },
  { key: "hero", label: "Hero" },
  { key: "rare", label: "Rare" },
  { key: "needs_review", label: "Needs review" },
];

export type SortDirection = "asc" | "desc";

export type SortableColumn =
  | "code"
  | "name"
  | "category"
  | "brand"
  | "color"
  | "status"
  | "usage"
  | "rating";

export type SortRule = { column: SortableColumn; direction: SortDirection };

/** An item "needs review" when it is missing a category, image, or rating. */
export function itemNeedsReview(item: WardrobeItemRow): boolean {
  return !item.category || !item.primary_image_url || item.rating === null;
}

function matchesQuickFilter(item: WardrobeItemRow, key: QuickFilterKey): boolean {
  switch (key) {
    case "favorites":
      return item.favorite;
    case "hero":
      return item.usage === "hero";
    case "rare":
      return item.usage === "rare";
    case "needs_review":
      return itemNeedsReview(item);
    default: {
      const _exhaustive: never = key;
      return _exhaustive;
    }
  }
}

/** Keeps items that satisfy every active quick filter (AND semantics). */
export function applyQuickFilters(
  items: readonly WardrobeItemRow[],
  active: ReadonlySet<QuickFilterKey>,
): WardrobeItemRow[] {
  if (active.size === 0) {
    return [...items];
  }
  return items.filter((item) =>
    [...active].every((key) => matchesQuickFilter(item, key)),
  );
}

function sortValue(item: WardrobeItemRow, column: SortableColumn): string | number {
  switch (column) {
    case "code":
      return item.code.toLowerCase();
    case "name":
      return item.name.toLowerCase();
    case "category":
      return item.category?.name.toLowerCase() ?? "";
    case "brand":
      return item.brand?.name.toLowerCase() ?? "";
    case "color":
      return item.primary_color?.name.toLowerCase() ?? "";
    case "status":
      return item.status ?? "";
    case "usage":
      return item.usage ?? "";
    case "rating":
      return item.rating ?? -1;
    default: {
      const _exhaustive: never = column;
      return _exhaustive;
    }
  }
}

function compareBy(
  a: WardrobeItemRow,
  b: WardrobeItemRow,
  rule: SortRule,
): number {
  const left = sortValue(a, rule.column);
  const right = sortValue(b, rule.column);
  let result = 0;
  if (typeof left === "number" && typeof right === "number") {
    result = left - right;
  } else {
    result = String(left).localeCompare(String(right));
  }
  return rule.direction === "asc" ? result : -result;
}

/** Stable multi-column sort. Returns a new array; empty rules preserve order. */
export function sortItems(
  items: readonly WardrobeItemRow[],
  rules: readonly SortRule[],
): WardrobeItemRow[] {
  if (rules.length === 0) {
    return [...items];
  }
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      for (const rule of rules) {
        const result = compareBy(a.item, b.item, rule);
        if (result !== 0) {
          return result;
        }
      }
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

type InventoryViewSelection = {
  filters: InventoryFilters;
  quickFilters: ReadonlySet<QuickFilterKey>;
};

function nameFor(id: string | undefined, options: LookupOption[]): string | null {
  if (!id) {
    return null;
  }
  return options.find((option) => option.id === id)?.name ?? null;
}

function idFor(name: string | null, options: LookupOption[]): string | undefined {
  if (!name) {
    return undefined;
  }
  return options.find(
    (option) => option.name.toLowerCase() === name.toLowerCase(),
  )?.id;
}

const QUICK_FILTER_KEYS = new Set<QuickFilterKey>(
  QUICK_FILTERS.map((entry) => entry.key),
);

/** Serializes the active view selection into a shareable query string. */
export function serializeInventoryParams(
  selection: InventoryViewSelection,
  lookups: WardrobeLookups,
): string {
  const params = new URLSearchParams();
  const { filters, quickFilters } = selection;

  const category = nameFor(filters.categoryId, lookups.categories);
  if (category) params.set("category", category);

  const subcategory = nameFor(filters.subcategoryId, lookups.subcategories);
  if (subcategory) params.set("subcategory", subcategory);

  const brand = nameFor(filters.brandId, lookups.brands);
  if (brand) params.set("brand", brand);

  const color = nameFor(filters.primaryColorId, lookups.colors);
  if (color) params.set("color", color);

  if (filters.status) params.set("status", filters.status);
  if (filters.usage) params.set("usage", filters.usage);
  if (filters.search?.trim()) params.set("q", filters.search.trim());

  if (quickFilters.size > 0) {
    params.set("quick", [...quickFilters].join(","));
  }

  return params.toString();
}

/** Parses a query string back into a view selection, ignoring unknown values. */
export function parseInventoryParams(
  params: URLSearchParams,
  lookups: WardrobeLookups,
): { filters: InventoryFilters; quickFilters: Set<QuickFilterKey> } {
  const filters: InventoryFilters = {};

  const categoryId = idFor(params.get("category"), lookups.categories);
  if (categoryId) filters.categoryId = categoryId;

  const subcategoryId = idFor(params.get("subcategory"), lookups.subcategories);
  if (subcategoryId) filters.subcategoryId = subcategoryId;

  const brandId = idFor(params.get("brand"), lookups.brands);
  if (brandId) filters.brandId = brandId;

  const primaryColorId = idFor(params.get("color"), lookups.colors);
  if (primaryColorId) filters.primaryColorId = primaryColorId;

  const status = params.get("status");
  if (status) filters.status = status as ItemStatus;

  const usage = params.get("usage");
  if (usage) filters.usage = usage as UsageFrequency;

  const search = params.get("q");
  if (search) filters.search = search;

  const quickFilters = new Set<QuickFilterKey>();
  const quickParam = params.get("quick");
  if (quickParam) {
    for (const raw of quickParam.split(",")) {
      const key = raw.trim() as QuickFilterKey;
      if (QUICK_FILTER_KEYS.has(key)) {
        quickFilters.add(key);
      }
    }
  }

  return { filters, quickFilters };
}
