import { createClient } from "@/lib/supabase/client";
import type {
  CategoryCountsResult,
  CreateWardrobeItemInput,
  InventoryFilters,
  InventorySort,
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

function applyListFilters<
  T extends {
    or: (filters: string) => T;
    eq: (column: string, value: string) => T;
  },
>(query: T, filters: Pick<InventoryFilters, "search" | "status">): T {
  const search = filters.search?.trim();
  if (search) {
    query = query.or(`name.ilike.%${search}%,code.ilike.%${search}%`);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  return query;
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

export async function fetchWardrobeItems(
  filters: InventoryFilters = {},
): Promise<{ data: WardrobeItemRow[] | null; error: Error | null }> {
  const supabase = createClient();

  let query = supabase.from("wardrobe_items").select(WARDROBE_ITEM_SELECT);

  query = applyListFilters(query, filters);

  if (filters.categoryId === UNCATEGORIZED_CATEGORY_ID) {
    query = query.is("category_id", null);
  } else if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }

  query = applySort(query, filters.sort ?? DEFAULT_INVENTORY_SORT);

  const { data, error } = await query;

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as WardrobeItemRow[], error: null };
}

export async function fetchCategoryCounts(
  filters: Pick<InventoryFilters, "search" | "status"> = {},
): Promise<{ data: CategoryCountsResult | null; error: Error | null }> {
  const supabase = createClient();

  let query = supabase.from("wardrobe_items").select("category_id");

  query = applyListFilters(query, filters);

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

export async function deleteWardrobeItem(
  id: string,
): Promise<{ error: Error | null }> {
  const supabase = createClient();

  const { error } = await supabase.from("wardrobe_items").delete().eq("id", id);

  if (error) {
    return { error: toError(error.message) };
  }

  return { error: null };
}
