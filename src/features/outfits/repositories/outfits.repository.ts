import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { LookupOption, OutfitRow, SaveOutfitInput } from "@/features/outfits/types";

export const OUTFIT_SELECT = "id, name, occasion_id, season, rating, notes, created_at";
export const OUTFIT_ITEM_SELECT = "outfit_id, item_id, role";

export const PICKER_ITEM_SELECT = `
  id,
  code,
  name,
  category_id,
  brand_id,
  category:categories(id, name),
  brand:brands(id, name)
`;

export type PickerItemRow = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  brand_id: string | null;
  category: LookupOption | null;
  brand: LookupOption | null;
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

export async function fetchSeasons(): Promise<{
  data: LookupOption[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, name")
    .order("name");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as LookupOption[], error: null };
}

export async function fetchCategories(): Promise<{
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

export async function resolveSeasonName(
  seasonId: string | null | undefined,
): Promise<string | null> {
  if (!seasonId) {
    return null;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("name")
    .eq("id", seasonId)
    .maybeSingle();

  if (error) {
    throw toError(error.message);
  }

  return data?.name ?? null;
}

export async function fetchActiveWardrobeItems(
  search = "",
): Promise<{ data: PickerItemRow[] | null; error: Error | null }> {
  const supabase = createClient();
  const trimmedSearch = search.trim();

  let query = supabase
    .from("wardrobe_items")
    .select(PICKER_ITEM_SELECT)
    .eq("status", "active")
    .order("name");

  if (trimmedSearch) {
    query = query.or(`name.ilike.%${trimmedSearch}%,code.ilike.%${trimmedSearch}%`);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as PickerItemRow[], error: null };
}

export async function fetchWardrobeItemsByIds(
  itemIds: string[],
): Promise<{ data: PickerItemRow[] | null; error: Error | null }> {
  if (itemIds.length === 0) {
    return { data: [], error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select(PICKER_ITEM_SELECT)
    .in("id", itemIds);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as PickerItemRow[], error: null };
}

export async function fetchOutfitRows(): Promise<{
  data: OutfitRow[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("outfits")
    .select(OUTFIT_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as OutfitRow[], error: null };
}

export async function fetchOutfitItemLinks(): Promise<{
  data: { outfit_id: string }[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.from("outfit_items").select("outfit_id");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data ?? [], error: null };
}

export async function fetchOutfitItemRoles(
  outfitId: string,
): Promise<{
  data: { outfit_id: string; item_id: string; role: string }[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("outfit_items")
    .select(OUTFIT_ITEM_SELECT)
    .eq("outfit_id", outfitId);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data ?? [], error: null };
}

export async function fetchOutfitRowById(
  id: string,
): Promise<{ data: OutfitRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("outfits")
    .select(OUTFIT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data as OutfitRow | null) ?? null, error: null };
}

export async function fetchOccasionById(
  id: string,
): Promise<{ data: LookupOption | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("occasions")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data as LookupOption | null) ?? null, error: null };
}

export async function replaceOutfitItems(
  outfitId: string,
  items: SaveOutfitInput["items"],
): Promise<{ error: Error | null }> {
  const supabase = createClient();

  const { error: deleteError } = await supabase
    .from("outfit_items")
    .delete()
    .eq("outfit_id", outfitId);

  if (deleteError) {
    return { error: toError(deleteError.message) };
  }

  if (items.length === 0) {
    return { error: null };
  }

  const { error: insertError } = await supabase.from("outfit_items").insert(
    items.map((item) => ({
      outfit_id: outfitId,
      item_id: item.item_id,
      role: item.slot,
    })),
  );

  if (insertError) {
    return { error: toError(insertError.message) };
  }

  return { error: null };
}

export async function insertOutfitRow(input: {
  name: string;
  occasion_id: string | null;
  season: string | null;
  rating: number | null;
  notes: string | null;
}): Promise<{ data: OutfitRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("outfits")
    .insert(input)
    .select(OUTFIT_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as OutfitRow, error: null };
}

export async function updateOutfitRow(
  id: string,
  input: {
    name: string;
    occasion_id: string | null;
    season: string | null;
    rating: number | null;
    notes: string | null;
  },
): Promise<{ data: OutfitRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("outfits")
    .update(input)
    .eq("id", id)
    .select(OUTFIT_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as OutfitRow, error: null };
}

export async function deleteOutfitItemsByOutfitId(
  outfitId: string,
): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const { error } = await supabase
    .from("outfit_items")
    .delete()
    .eq("outfit_id", outfitId);

  if (error) {
    return { error: toError(error.message) };
  }

  return { error: null };
}

export type EvaluationItemBaseRow = {
  id: string;
  name: string;
  formality: string | null;
  rating: number | null;
  primary_color: { id: string; name: string; hex: string | null } | null;
};

export type EvaluationRelationRows = {
  items: EvaluationItemBaseRow[];
  seasons: { item_id: string; season: { name: string } | null }[];
  materials: { item_id: string; material: { name: string } | null }[];
  occasions: { item_id: string; occasion: { name: string } | null }[];
};

export async function fetchEvaluationRelationRows(
  itemIds: string[],
): Promise<{ data: EvaluationRelationRows | null; error: Error | null }> {
  if (itemIds.length === 0) {
    return {
      data: { items: [], seasons: [], materials: [], occasions: [] },
      error: null,
    };
  }

  const supabase = createClient();

  const [itemsResult, seasonsResult, materialsResult, occasionsResult] =
    await Promise.all([
      supabase
        .from("wardrobe_items")
        .select(
          "id, name, formality, rating, primary_color:colors!wardrobe_items_primary_color_id_fkey(id, name, hex)",
        )
        .in("id", itemIds),
      supabase
        .from("item_seasons")
        .select("item_id, season:seasons(name)")
        .in("item_id", itemIds),
      supabase
        .from("item_materials")
        .select("item_id, material:materials(name)")
        .in("item_id", itemIds),
      supabase
        .from("item_occasions")
        .select("item_id, occasion:occasions(name)")
        .in("item_id", itemIds),
    ]);

  const firstError =
    itemsResult.error ??
    seasonsResult.error ??
    materialsResult.error ??
    occasionsResult.error;

  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

  return {
    data: {
      items: (itemsResult.data ?? []) as unknown as EvaluationItemBaseRow[],
      seasons: (seasonsResult.data ?? []) as unknown as EvaluationRelationRows["seasons"],
      materials: (materialsResult.data ?? []) as unknown as EvaluationRelationRows["materials"],
      occasions: (occasionsResult.data ?? []) as unknown as EvaluationRelationRows["occasions"],
    },
    error: null,
  };
}

export async function deleteOutfitRow(id: string): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("outfits").delete().eq("id", id);

  if (error) {
    return { error: toError(error.message) };
  }

  return { error: null };
}
