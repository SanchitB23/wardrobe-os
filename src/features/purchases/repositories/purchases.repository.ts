import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { PurchaseRow } from "@/types/wardrobe";
import { UNCATEGORIZED_CATEGORY_ID } from "@/types/wardrobe";

export const PURCHASE_SELECT =
  "id, item_id, purchase_date, price, source, status, return_reason, created_at";

type ItemLookupRow = {
  id: string;
  code: string;
  name: string;
  brand_id: string | null;
  category_id: string | null;
};

export type PurchaseInsertPayload = {
  item_id: string;
  purchase_date: string;
  price: number;
  source: string | null;
  status: string;
  return_reason: string | null;
};

export type PurchaseUpdatePayload = {
  purchase_date: string;
  price: number;
  source: string | null;
  status: string;
  return_reason: string | null;
};

export type PurchaseQueryFilters = {
  itemIds?: string[] | null;
  status?: string;
  year?: string;
  priceMin?: number;
  priceMax?: number;
};

export async function selectWearLogItemIds(): Promise<{
  data: { item_id: string }[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.from("wear_logs").select("item_id");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data ?? [], error: null };
}

export async function selectItemIdsByBrandId(
  brandId: string,
): Promise<{ data: string[] | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("id")
    .eq("brand_id", brandId);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []).map((row) => row.id), error: null };
}

export async function selectItemIdsByCategoryId(
  categoryId: string,
): Promise<{ data: string[] | null; error: Error | null }> {
  const supabase = createClient();
  let query = supabase.from("wardrobe_items").select("id");

  if (categoryId === UNCATEGORIZED_CATEGORY_ID) {
    query = query.is("category_id", null);
  } else {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []).map((row) => row.id), error: null };
}

export async function selectPurchaseByItemId(
  itemId: string,
): Promise<{ data: PurchaseRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("purchases")
    .select(PURCHASE_SELECT)
    .eq("item_id", itemId)
    .maybeSingle();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data as PurchaseRow | null) ?? null, error: null };
}

export async function insertPurchase(
  payload: PurchaseInsertPayload,
): Promise<{ data: PurchaseRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("purchases")
    .insert(payload)
    .select(PURCHASE_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as PurchaseRow, error: null };
}

export async function updatePurchaseById(
  id: string,
  payload: PurchaseUpdatePayload,
): Promise<{ data: PurchaseRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("purchases")
    .update(payload)
    .eq("id", id)
    .select(PURCHASE_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as PurchaseRow, error: null };
}

export async function selectPurchases(
  filters: PurchaseQueryFilters = {},
): Promise<{ data: PurchaseRow[] | null; error: Error | null }> {
  const supabase = createClient();

  let query = supabase
    .from("purchases")
    .select(PURCHASE_SELECT)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.itemIds) {
    query = query.in("item_id", filters.itemIds);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.year) {
    query = query
      .gte("purchase_date", `${filters.year}-01-01`)
      .lte("purchase_date", `${filters.year}-12-31`);
  }

  if (filters.priceMin !== undefined) {
    query = query.gte("price", filters.priceMin);
  }

  if (filters.priceMax !== undefined) {
    query = query.lte("price", filters.priceMax);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as PurchaseRow[], error: null };
}

export async function selectAllPurchases(): Promise<{
  data: PurchaseRow[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.from("purchases").select(PURCHASE_SELECT);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as PurchaseRow[], error: null };
}

export async function selectItemsByIds(
  itemIds: string[],
): Promise<{ data: ItemLookupRow[] | null; error: Error | null }> {
  if (itemIds.length === 0) {
    return { data: [], error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("id, code, name, brand_id, category_id")
    .in("id", itemIds);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as ItemLookupRow[], error: null };
}

export async function selectAllItemsLookup(): Promise<{
  data: ItemLookupRow[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("id, code, name, brand_id, category_id");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as ItemLookupRow[], error: null };
}

export async function selectAllBrands(): Promise<{
  data: { id: string; name: string }[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.from("brands").select("id, name");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data ?? [], error: null };
}

export async function selectAllCategories(): Promise<{
  data: { id: string; name: string }[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.from("categories").select("id, name");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data ?? [], error: null };
}
