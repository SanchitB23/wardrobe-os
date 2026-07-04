import { createClient } from "@/lib/supabase/client";
import type { CategoryCountFilters } from "@/lib/wardrobe/query-keys";
import type {
  CategoryCountsResult,
  CreateWardrobeItemInput,
  InventoryFilters,
  InventorySort,
  InventorySummary,
  LookupOption,
  SubcategoryOption,
  UpdateWardrobeItemInput,
  WardrobeItemRow,
  WardrobeLookups,
} from "@/types/wardrobe";
import {
  DEFAULT_INVENTORY_SORT,
  UNCATEGORIZED_CATEGORY_ID,
} from "@/types/wardrobe";

const WARDROBE_ITEM_SELECT = `
  id,
  code,
  name,
  category_id,
  subcategory_id,
  brand_id,
  primary_color_id,
  status,
  ownership,
  fit,
  formality,
  rating,
  usage,
  notes,
  created_at,
  category:categories(id, name),
  subcategory:subcategories(id, name),
  brand:brands(id, name),
  primary_color:colors!wardrobe_items_primary_color_id_fkey(id, name)
`;

function toError(message: string) {
  return new Error(message);
}

function buildItemPayload(input: CreateWardrobeItemInput) {
  return {
    code: input.code.trim(),
    name: input.name.trim(),
    category_id: input.category_id ?? null,
    subcategory_id: input.subcategory_id ?? null,
    brand_id: input.brand_id ?? null,
    primary_color_id: input.primary_color_id ?? null,
    status: input.status ?? "active",
    ownership: input.ownership ?? "owned",
    fit: input.fit ?? "unknown",
    formality: input.formality ?? null,
    rating: input.rating ?? null,
    usage: input.usage ?? null,
    notes: input.notes?.trim() || null,
  };
}

type FilterableQuery = {
  or: (filters: string) => FilterableQuery;
  eq: (column: string, value: string) => FilterableQuery;
  is: (column: string, value: null) => FilterableQuery;
};

function applyInventoryFilters<T extends FilterableQuery>(
  query: T,
  filters: InventoryFilters,
  options: { includeCategory?: boolean } = {},
): T {
  const { includeCategory = true } = options;
  const search = filters.search?.trim();
  let next = query;

  if (search) {
    next = next.or(`name.ilike.%${search}%,code.ilike.%${search}%`) as T;
  }

  if (filters.status) {
    next = next.eq("status", filters.status) as T;
  }

  if (filters.usage) {
    next = next.eq("usage", filters.usage) as T;
  }

  if (filters.subcategoryId) {
    next = next.eq("subcategory_id", filters.subcategoryId) as T;
  }

  if (filters.brandId) {
    next = next.eq("brand_id", filters.brandId) as T;
  }

  if (filters.primaryColorId) {
    next = next.eq("primary_color_id", filters.primaryColorId) as T;
  }

  if (includeCategory) {
    if (filters.categoryId === UNCATEGORIZED_CATEGORY_ID) {
      next = next.is("category_id", null) as T;
    } else if (filters.categoryId) {
      next = next.eq("category_id", filters.categoryId) as T;
    }
  }

  return next;
}

function applySort(
  query: ReturnType<ReturnType<typeof createClient>["from"]>,
  sort: InventorySort = DEFAULT_INVENTORY_SORT,
) {
  const ascending = sort.ascending ?? false;

  switch (sort.field) {
    case "rating":
      return query.order("rating", { ascending, nullsFirst: false });
    case "name":
      return query.order("name", { ascending });
    case "category":
      return query.order("name", {
        ascending,
        referencedTable: "categories",
      });
    case "created_at":
      return query.order("created_at", { ascending });
    default: {
      const _exhaustive: never = sort.field;
      throw new Error(`Unsupported sort field: ${String(_exhaustive)}`);
    }
  }
}

export async function fetchInventorySummary(): Promise<{
  data: InventorySummary | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("status, usage, rating");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  const rows = data ?? [];
  const ratedItems = rows.filter((row) => row.rating !== null);
  const ratingSum = ratedItems.reduce(
    (sum, row) => sum + Number(row.rating),
    0,
  );

  return {
    data: {
      totalItems: rows.length,
      activeItems: rows.filter((row) => row.status === "active").length,
      heroPieces: rows.filter((row) => row.usage === "hero").length,
      averageRating:
        ratedItems.length > 0
          ? Math.round((ratingSum / ratedItems.length) * 10) / 10
          : null,
    },
    error: null,
  };
}

export async function fetchWardrobeItemById(
  id: string,
): Promise<{ data: WardrobeItemRow | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wardrobe_items")
    .select(WARDROBE_ITEM_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data as WardrobeItemRow | null) ?? null, error: null };
}

export async function fetchWardrobeItems(
  filters: InventoryFilters = {},
): Promise<{ data: WardrobeItemRow[] | null; error: Error | null }> {
  const supabase = createClient();

  let query = supabase.from("wardrobe_items").select(WARDROBE_ITEM_SELECT);

  query = applyInventoryFilters(query, filters);
  query = applySort(query, filters.sort ?? DEFAULT_INVENTORY_SORT);

  const { data, error } = await query;

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as WardrobeItemRow[], error: null };
}

export async function fetchCategoryCounts(
  filters: CategoryCountFilters = {},
): Promise<{ data: CategoryCountsResult | null; error: Error | null }> {
  const supabase = createClient();

  let query = supabase.from("wardrobe_items").select("category_id");

  query = applyInventoryFilters(query, filters, { includeCategory: false });

  const [countsResult, categoriesResult] = await Promise.all([
    query,
    supabase.from("categories").select("id, name").order("name"),
  ]);

  if (countsResult.error) {
    return { data: null, error: toError(countsResult.error.message) };
  }

  if (categoriesResult.error) {
    return { data: null, error: toError(categoriesResult.error.message) };
  }

  const countByCategory = new Map<string, number>();
  let uncategorized = 0;

  for (const row of countsResult.data ?? []) {
    if (!row.category_id) {
      uncategorized += 1;
      continue;
    }
    countByCategory.set(
      row.category_id,
      (countByCategory.get(row.category_id) ?? 0) + 1,
    );
  }

  const categories = ((categoriesResult.data ?? []) as LookupOption[]).map(
    (category) => ({
      ...category,
      count: countByCategory.get(category.id) ?? 0,
    }),
  );

  return {
    data: {
      total: countsResult.data?.length ?? 0,
      uncategorized,
      categories,
    },
    error: null,
  };
}

export async function fetchLookups(): Promise<{
  data: WardrobeLookups | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const [categoriesResult, subcategoriesResult, brandsResult, colorsResult] =
    await Promise.all([
      supabase.from("categories").select("id, name").order("name"),
      supabase
        .from("subcategories")
        .select("id, name, category_id")
        .order("name"),
      supabase.from("brands").select("id, name").order("name"),
      supabase.from("colors").select("id, name").order("name"),
    ]);

  const firstError =
    categoriesResult.error ??
    subcategoriesResult.error ??
    brandsResult.error ??
    colorsResult.error;

  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

  return {
    data: {
      categories: (categoriesResult.data ?? []) as LookupOption[],
      subcategories: (subcategoriesResult.data ?? []) as SubcategoryOption[],
      brands: (brandsResult.data ?? []) as LookupOption[],
      colors: (colorsResult.data ?? []) as LookupOption[],
    },
    error: null,
  };
}

export async function createWardrobeItem(
  input: CreateWardrobeItemInput,
): Promise<{ data: WardrobeItemRow | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wardrobe_items")
    .insert(buildItemPayload(input))
    .select(WARDROBE_ITEM_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as WardrobeItemRow, error: null };
}

export async function updateWardrobeItem(
  input: UpdateWardrobeItemInput,
): Promise<{ data: WardrobeItemRow | null; error: Error | null }> {
  const supabase = createClient();
  const { id, ...fields } = input;

  const { data, error } = await supabase
    .from("wardrobe_items")
    .update(buildItemPayload(fields))
    .eq("id", id)
    .select(WARDROBE_ITEM_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as WardrobeItemRow, error: null };
}

export async function retireWardrobeItem(
  id: string,
): Promise<{ data: WardrobeItemRow | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wardrobe_items")
    .update({ status: "retired" })
    .eq("id", id)
    .select(WARDROBE_ITEM_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as WardrobeItemRow, error: null };
}
