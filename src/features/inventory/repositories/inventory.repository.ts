import { createClient } from "@/lib/supabase/client";
import type { CategoryCountFilters } from "@/shared/query/wardrobe-keys";
import { toError } from "@/shared/utils/data-result";
import type { Database } from "@/types/database";
import type {
  InventoryFilters,
  InventorySort,
  LookupOption,
  SubcategoryOption,
  WardrobeItemRow,
  WardrobeLookups,
} from "@/features/inventory/types";
import {
  DEFAULT_INVENTORY_SORT,
  UNCATEGORIZED_CATEGORY_ID,
} from "@/features/inventory/types";

export const WARDROBE_ITEM_SELECT = `
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
  favorite,
  created_at,
  category:categories(id, name),
  subcategory:subcategories(id, name),
  brand:brands(id, name),
  primary_color:colors!wardrobe_items_primary_color_id_fkey(id, name)
`;

export type WardrobeItemInsertPayload =
  Database["public"]["Tables"]["wardrobe_items"]["Insert"];

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

export async function selectInventorySummaryRows(): Promise<{
  data: { status: string | null; usage: string | null; rating: number | null }[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("status, usage, rating");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data ?? [], error: null };
}

export async function selectWardrobeItemById(
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

export async function selectWardrobeItems(
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

export async function selectCategoryCountRows(
  filters: CategoryCountFilters = {},
): Promise<{
  data: { category_id: string | null }[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  let query = supabase.from("wardrobe_items").select("category_id");
  query = applyInventoryFilters(query, filters, { includeCategory: false });

  const { data, error } = await query;

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data ?? [], error: null };
}

export async function selectAllCategoriesOrdered(): Promise<{
  data: LookupOption[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as LookupOption[], error: null };
}

export async function selectLookups(): Promise<{
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

export async function insertWardrobeItem(
  payload: WardrobeItemInsertPayload,
): Promise<{ data: WardrobeItemRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .insert(payload)
    .select(WARDROBE_ITEM_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as WardrobeItemRow, error: null };
}

export async function updateWardrobeItemById(
  id: string,
  payload: WardrobeItemInsertPayload,
): Promise<{ data: WardrobeItemRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .update(payload)
    .eq("id", id)
    .select(WARDROBE_ITEM_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as WardrobeItemRow, error: null };
}

export async function updateWardrobeItemFavoriteById(
  id: string,
  favorite: boolean,
): Promise<{ data: WardrobeItemRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .update({ favorite })
    .eq("id", id)
    .select(WARDROBE_ITEM_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as WardrobeItemRow, error: null };
}

export async function retireWardrobeItemById(
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

export async function selectWardrobeItemCodes(): Promise<{
  data: string[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.from("wardrobe_items").select("code");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return {
    data: (data ?? []).map((row) => row.code),
    error: null,
  };
}

export async function bulkInsertWardrobeItems(
  payloads: WardrobeItemInsertPayload[],
): Promise<{ data: WardrobeItemRow[] | null; error: Error | null }> {
  if (payloads.length === 0) {
    return { data: [], error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .insert(payloads)
    .select(WARDROBE_ITEM_SELECT);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as WardrobeItemRow[], error: null };
}
