import { buildInventorySummary } from "@/domain/wardrobe/inventory-summary";
import type { CategoryCountFilters } from "@/shared/query/wardrobe-keys";
import {
  bulkInsertWardrobeItems,
  insertWardrobeItem,
  retireWardrobeItemById,
  selectAllCategoriesOrdered,
  selectCategoryCountRows,
  selectInventorySummaryRows,
  selectLookups,
  selectWardrobeItemById,
  selectWardrobeItemCodes,
  selectWardrobeItems,
  updateWardrobeItemById,
  updateWardrobeItemFavoriteById,
  type WardrobeItemInsertPayload,
} from "@/features/inventory/repositories/inventory.repository";
import type {
  CategoryCountsResult,
  CreateWardrobeItemInput,
  InventoryFilters,
  InventorySummary,
  LookupOption,
  UpdateWardrobeItemInput,
  WardrobeItemRow,
  WardrobeLookups,
} from "@/features/inventory/types";

export function buildItemPayload(input: CreateWardrobeItemInput): WardrobeItemInsertPayload {
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
  } as WardrobeItemInsertPayload;
}

export async function fetchInventorySummary(): Promise<{
  data: InventorySummary | null;
  error: Error | null;
}> {
  const result = await selectInventorySummaryRows();

  if (result.error) {
    return { data: null, error: result.error };
  }

  const rows = result.data ?? [];

  return {
    data: buildInventorySummary(rows),
    error: null,
  };
}

export async function fetchWardrobeItemById(
  id: string,
): Promise<{ data: WardrobeItemRow | null; error: Error | null }> {
  return selectWardrobeItemById(id);
}

export async function setWardrobeItemFavorite(
  id: string,
  favorite: boolean,
): Promise<{ data: WardrobeItemRow | null; error: Error | null }> {
  return updateWardrobeItemFavoriteById(id, favorite);
}

export async function fetchWardrobeItems(
  filters: InventoryFilters = {},
): Promise<{ data: WardrobeItemRow[] | null; error: Error | null }> {
  return selectWardrobeItems(filters);
}

export async function fetchCategoryCounts(
  filters: CategoryCountFilters = {},
): Promise<{ data: CategoryCountsResult | null; error: Error | null }> {
  const [countsResult, categoriesResult] = await Promise.all([
    selectCategoryCountRows(filters),
    selectAllCategoriesOrdered(),
  ]);

  if (countsResult.error) {
    return { data: null, error: countsResult.error };
  }

  if (categoriesResult.error) {
    return { data: null, error: categoriesResult.error };
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
  return selectLookups();
}

export async function createWardrobeItem(
  input: CreateWardrobeItemInput,
): Promise<{ data: WardrobeItemRow | null; error: Error | null }> {
  return insertWardrobeItem(buildItemPayload(input));
}

export async function updateWardrobeItem(
  input: UpdateWardrobeItemInput,
): Promise<{ data: WardrobeItemRow | null; error: Error | null }> {
  const { id, ...fields } = input;
  return updateWardrobeItemById(id, buildItemPayload(fields));
}

export async function retireWardrobeItem(
  id: string,
): Promise<{ data: WardrobeItemRow | null; error: Error | null }> {
  return retireWardrobeItemById(id);
}

export async function fetchWardrobeItemCodes(): Promise<{
  data: string[] | null;
  error: Error | null;
}> {
  return selectWardrobeItemCodes();
}

export async function bulkCreateWardrobeItems(
  inputs: CreateWardrobeItemInput[],
): Promise<{ data: WardrobeItemRow[] | null; error: Error | null }> {
  if (inputs.length === 0) {
    return { data: [], error: null };
  }

  return bulkInsertWardrobeItems(inputs.map((input) => buildItemPayload(input)));
}
