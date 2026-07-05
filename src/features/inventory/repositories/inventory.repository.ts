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
  eq: (column: string, value: string | boolean) => FilterableQuery;
  is: (column: string, value: null) => FilterableQuery;
  gte: (column: string, value: number) => FilterableQuery;
  lte: (column: string, value: number) => FilterableQuery;
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

  if (filters.formality) {
    next = next.eq("formality", filters.formality) as T;
  }

  if (filters.fit) {
    next = next.eq("fit", filters.fit) as T;
  }

  if (filters.ratingMin !== undefined) {
    next = next.gte("rating", filters.ratingMin) as T;
  }

  if (filters.ratingMax !== undefined) {
    next = next.lte("rating", filters.ratingMax) as T;
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

type IdSourceTable =
  | "item_seasons"
  | "item_styles"
  | "item_materials"
  | "item_features"
  | "item_tags"
  | "item_occasions"
  | "purchases";

type PresenceTable = "item_images" | "wear_logs";

const RELATION_FACETS: {
  key: keyof Pick<
    InventoryFilters,
    "seasonIds" | "styleIds" | "materialIds" | "featureIds" | "tagIds" | "occasionIds"
  >;
  table: IdSourceTable;
  column: string;
}[] = [
  { key: "seasonIds", table: "item_seasons", column: "season_id" },
  { key: "styleIds", table: "item_styles", column: "style_id" },
  { key: "materialIds", table: "item_materials", column: "material_id" },
  { key: "featureIds", table: "item_features", column: "feature_id" },
  { key: "tagIds", table: "item_tags", column: "tag_id" },
  { key: "occasionIds", table: "item_occasions", column: "occasion_id" },
];

async function selectItemIdsIn(
  table: IdSourceTable,
  column: string,
  values: string[],
): Promise<{ ids: string[]; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(table)
    .select("item_id")
    .in(column, values);
  if (error) {
    return { ids: [], error: toError(error.message) };
  }
  return {
    ids: [...new Set((data ?? []).map((row) => row.item_id as string))],
    error: null,
  };
}

async function selectItemIdsPresent(
  table: PresenceTable,
): Promise<{ ids: string[]; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase.from(table).select("item_id");
  if (error) {
    return { ids: [], error: toError(error.message) };
  }
  return {
    ids: [...new Set((data ?? []).map((row) => row.item_id as string))],
    error: null,
  };
}

function intersect(a: string[], b: Set<string>): string[] {
  return a.filter((id) => b.has(id));
}

/**
 * Resolves relation/existence filters into item-id constraints without joining
 * (avoids row multiplication). `include` is the AND-intersection of positive
 * facet id-sets (null when unconstrained); `exclude` is the union of negatives.
 */
async function resolveItemIdConstraints(filters: InventoryFilters): Promise<{
  include: string[] | null;
  exclude: string[];
  error: Error | null;
}> {
  let include: string[] | null = null;
  const exclude: string[] = [];

  const addInclude = (ids: string[]) => {
    include = include === null ? ids : intersect(include, new Set(ids));
  };

  // Many-to-many facets: OR within a facet (in), AND across facets (intersect).
  for (const facet of RELATION_FACETS) {
    const values = filters[facet.key];
    if (values && values.length > 0) {
      const { ids, error } = await selectItemIdsIn(
        facet.table,
        facet.column,
        values,
      );
      if (error) return { include: null, exclude: [], error };
      addInclude(ids);
    }
  }

  if (filters.hasImage !== undefined) {
    const { ids, error } = await selectItemIdsPresent("item_images");
    if (error) return { include: null, exclude: [], error };
    if (filters.hasImage) addInclude(ids);
    else exclude.push(...ids);
  }

  if (filters.wornStatus) {
    const { ids, error } = await selectItemIdsPresent("wear_logs");
    if (error) return { include: null, exclude: [], error };
    if (filters.wornStatus === "worn") addInclude(ids);
    else exclude.push(...ids);
  }

  if (filters.purchaseStatus) {
    const { ids, error } = await selectItemIdsIn("purchases", "status", [
      filters.purchaseStatus,
    ]);
    if (error) return { include: null, exclude: [], error };
    addInclude(ids);
  }

  return { include, exclude, error: null };
}

export async function selectWardrobeItems(
  filters: InventoryFilters = {},
): Promise<{ data: WardrobeItemRow[] | null; error: Error | null }> {
  const supabase = createClient();

  const constraints = await resolveItemIdConstraints(filters);
  if (constraints.error) {
    return { data: null, error: constraints.error };
  }
  if (constraints.include !== null && constraints.include.length === 0) {
    return { data: [], error: null };
  }

  let query = supabase.from("wardrobe_items").select(WARDROBE_ITEM_SELECT);
  query = applyInventoryFilters(query, filters);

  if (constraints.include !== null) {
    query = query.in("id", constraints.include);
  }
  if (constraints.exclude.length > 0) {
    query = query.not("id", "in", `(${constraints.exclude.join(",")})`);
  }

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

  const [
    categoriesResult,
    subcategoriesResult,
    brandsResult,
    colorsResult,
    seasonsResult,
  ] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("subcategories").select("id, name, category_id").order("name"),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("colors").select("id, name").order("name"),
    supabase.from("seasons").select("id, name").order("name"),
  ]);

  const firstError =
    categoriesResult.error ??
    subcategoriesResult.error ??
    brandsResult.error ??
    colorsResult.error ??
    seasonsResult.error;

  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

  return {
    data: {
      categories: (categoriesResult.data ?? []) as LookupOption[],
      subcategories: (subcategoriesResult.data ?? []) as SubcategoryOption[],
      brands: (brandsResult.data ?? []) as LookupOption[],
      colors: (colorsResult.data ?? []) as LookupOption[],
      seasons: (seasonsResult.data ?? []) as LookupOption[],
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
