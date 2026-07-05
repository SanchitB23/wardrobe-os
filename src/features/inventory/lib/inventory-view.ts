import type {
  FitType,
  FormalityEnum,
  InventoryFilters,
  InventorySortField,
  ItemStatus,
  LookupOption,
  PurchaseStatus,
  UsageFrequency,
  WardrobeItemRow,
  WardrobeLookups,
  WornStatusFilter,
} from "@/types/wardrobe";

const SORT_FIELDS: InventorySortField[] = [
  "rating",
  "name",
  "category",
  "created_at",
];

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

/** Builds an /inventory href from raw query params (dashboard click-through). */
export function buildInventoryHref(params: Record<string, string>): string {
  const search = new URLSearchParams(params).toString();
  return search ? `/inventory?${search}` : "/inventory";
}

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
  if (filters.formality) params.set("formality", filters.formality);
  if (filters.fit) params.set("fit", filters.fit);

  if (filters.ratingMin !== undefined)
    params.set("ratingMin", String(filters.ratingMin));
  if (filters.ratingMax !== undefined)
    params.set("ratingMax", String(filters.ratingMax));

  if (filters.hasImage !== undefined)
    params.set("hasImage", filters.hasImage ? "true" : "false");
  if (filters.wornStatus) params.set("worn", filters.wornStatus);
  if (filters.purchaseStatus) params.set("purchase", filters.purchaseStatus);

  const setIds = (key: string, ids: string[] | undefined) => {
    if (ids && ids.length > 0) params.set(key, ids.join(","));
  };
  setIds("seasons", filters.seasonIds);
  setIds("styles", filters.styleIds);
  setIds("materials", filters.materialIds);
  setIds("features", filters.featureIds);
  setIds("tags", filters.tagIds);
  setIds("occasions", filters.occasionIds);

  if (filters.search?.trim()) params.set("q", filters.search.trim());

  // Only serialize a non-default sort to keep URLs clean.
  if (
    filters.sort &&
    !(filters.sort.field === "created_at" && !filters.sort.ascending)
  ) {
    params.set(
      "sort",
      `${filters.sort.field}_${filters.sort.ascending ? "asc" : "desc"}`,
    );
  }

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

  const formality = params.get("formality");
  if (formality) filters.formality = formality as FormalityEnum;

  const fit = params.get("fit");
  if (fit) filters.fit = fit as FitType;

  const ratingMin = params.get("ratingMin");
  if (ratingMin !== null && !Number.isNaN(Number(ratingMin)))
    filters.ratingMin = Number(ratingMin);
  const ratingMax = params.get("ratingMax");
  if (ratingMax !== null && !Number.isNaN(Number(ratingMax)))
    filters.ratingMax = Number(ratingMax);

  const hasImage = params.get("hasImage");
  if (hasImage === "true") filters.hasImage = true;
  else if (hasImage === "false") filters.hasImage = false;

  const worn = params.get("worn");
  if (worn === "worn" || worn === "never")
    filters.wornStatus = worn as WornStatusFilter;

  const purchase = params.get("purchase");
  if (purchase) filters.purchaseStatus = purchase as PurchaseStatus;

  const getIds = (key: string): string[] | undefined => {
    const raw = params.get(key);
    if (!raw) return undefined;
    const ids = raw.split(",").filter(Boolean);
    return ids.length > 0 ? ids : undefined;
  };
  filters.seasonIds = getIds("seasons");
  filters.styleIds = getIds("styles");
  filters.materialIds = getIds("materials");
  filters.featureIds = getIds("features");
  filters.tagIds = getIds("tags");
  filters.occasionIds = getIds("occasions");

  const search = params.get("q");
  if (search) filters.search = search;

  const sort = params.get("sort");
  if (sort) {
    const separator = sort.lastIndexOf("_");
    const field = sort.slice(0, separator);
    const direction = sort.slice(separator + 1);
    if (SORT_FIELDS.includes(field as InventorySortField)) {
      filters.sort = {
        field: field as InventorySortField,
        ascending: direction === "asc",
      };
    }
  }

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
  // `favorite=true` is sugar for the favorites quick filter.
  if (params.get("favorite") === "true") {
    quickFilters.add("favorites");
  }

  return { filters, quickFilters };
}
