import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { LookupOption, WearLogRow } from "@/types/wardrobe";
import { UNCATEGORIZED_CATEGORY_ID } from "@/types/wardrobe";

const WEAR_LOG_SELECT =
  "id, item_id, worn_on, outfit_id, occasion_id, comfort_rating, notes, created_at";

export type WearLogInsertRow = {
  item_id: string;
  worn_on: string;
  outfit_id?: string | null;
  occasion_id?: string | null;
  comfort_rating?: number | null;
  notes?: string | null;
};

export type WearLogQueryFilters = {
  itemId?: string;
  itemIds?: string[];
  occasionId?: string;
  wornFrom?: string;
  wornTo?: string;
};

export type WearLogSummaryRow = {
  id: string;
  item_id: string;
  worn_on: string;
};

export type WardrobeItemEnrichmentRow = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
};

export async function fetchOccasions(): Promise<{
  data: LookupOption[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("occasions")
    .select("id, name")
    .order("name");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as LookupOption[], error: null };
}

export async function fetchCategoryItemIds(
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

export async function insertWearLog(
  row: WearLogInsertRow,
): Promise<{ data: WearLogRow | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wear_logs")
    .insert(row)
    .select(WEAR_LOG_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as WearLogRow, error: null };
}

export async function insertWearLogs(
  rows: WearLogInsertRow[],
): Promise<{ data: WearLogRow[] | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wear_logs")
    .insert(rows)
    .select(WEAR_LOG_SELECT);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as WearLogRow[], error: null };
}

export async function deleteWearLog(
  id: string,
): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("wear_logs").delete().eq("id", id);

  if (error) {
    return { error: toError(error.message) };
  }

  return { error: null };
}

export async function queryWearLogs(
  filters: WearLogQueryFilters = {},
): Promise<{ data: WearLogRow[] | null; error: Error | null }> {
  const supabase = createClient();

  let query = supabase
    .from("wear_logs")
    .select(WEAR_LOG_SELECT)
    .order("worn_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.itemId) {
    query = query.eq("item_id", filters.itemId);
  } else if (filters.itemIds) {
    query = query.in("item_id", filters.itemIds);
  }

  if (filters.occasionId) {
    query = query.eq("occasion_id", filters.occasionId);
  }

  if (filters.wornFrom) {
    query = query.gte("worn_on", filters.wornFrom);
  }

  if (filters.wornTo) {
    query = query.lte("worn_on", filters.wornTo);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as WearLogRow[], error: null };
}

export async function queryWearLogsByItemId(
  itemId: string,
): Promise<{ data: WearLogRow[] | null; error: Error | null }> {
  return queryWearLogs({ itemId });
}

export async function queryWearLogsByOutfitId(
  outfitId: string,
): Promise<{ data: WearLogRow[] | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wear_logs")
    .select(WEAR_LOG_SELECT)
    .eq("outfit_id", outfitId)
    .order("worn_on", { ascending: false });

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as WearLogRow[], error: null };
}

export async function fetchAllWearLogSummaries(): Promise<{
  data: WearLogSummaryRow[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wear_logs")
    .select("id, item_id, worn_on");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as WearLogSummaryRow[], error: null };
}

export async function fetchWardrobeItemsByIds(
  itemIds: string[],
): Promise<{
  data: WardrobeItemEnrichmentRow[] | null;
  error: Error | null;
}> {
  if (itemIds.length === 0) {
    return { data: [], error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("id, code, name, category_id")
    .in("id", itemIds);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as WardrobeItemEnrichmentRow[], error: null };
}

export async function fetchOccasionsByIds(
  occasionIds: string[],
): Promise<{ data: LookupOption[] | null; error: Error | null }> {
  if (occasionIds.length === 0) {
    return { data: [], error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("occasions")
    .select("id, name")
    .in("id", occasionIds);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as LookupOption[], error: null };
}

export async function fetchAllCategories(): Promise<{
  data: LookupOption[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.from("categories").select("id, name");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as LookupOption[], error: null };
}
