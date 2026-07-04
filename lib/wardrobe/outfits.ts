import { createClient } from "@/lib/supabase/client";
import { fetchPrimaryImageUrlsForItems } from "@/lib/wardrobe/images";
import type {
  LookupOption,
  OutfitDetail,
  OutfitItemDetail,
  OutfitListRow,
  OutfitLookups,
  OutfitPickerItem,
  OutfitRow,
  OutfitSlot,
  SaveOutfitInput,
  UpdateOutfitInput,
} from "@/types/wardrobe";
import {
  categoryMatchesOutfitSlot,
  OUTFIT_SLOT_DEFINITIONS,
} from "@/types/wardrobe";

const OUTFIT_SELECT = "id, name, occasion_id, season, rating, notes, created_at";
const OUTFIT_ITEM_SELECT = "outfit_id, item_id, role";

const PICKER_ITEM_SELECT = `
  id,
  code,
  name,
  category_id,
  brand_id,
  category:categories(id, name),
  brand:brands(id, name)
`;

type PickerItemRow = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  brand_id: string | null;
  category: LookupOption | null;
  brand: LookupOption | null;
};

function toError(message: string) {
  return new Error(message);
}

function isOutfitSlot(value: string): value is OutfitSlot {
  return OUTFIT_SLOT_DEFINITIONS.some((definition) => definition.slot === value);
}

function seasonTextToLookup(
  seasonText: string | null | undefined,
  seasons: LookupOption[],
): LookupOption | null {
  if (!seasonText) {
    return null;
  }

  const matched = seasons.find(
    (season) => season.name.toLowerCase() === seasonText.toLowerCase(),
  );

  return matched ?? { id: seasonText, name: seasonText };
}

async function resolveSeasonName(
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

export async function fetchOutfitLookups(): Promise<{
  data: OutfitLookups | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const [occasionsResult, seasonsResult, categoriesResult] = await Promise.all([
    supabase.from("occasions").select("id, name").order("name"),
    supabase.from("seasons").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("name"),
  ]);

  const firstError =
    occasionsResult.error ?? seasonsResult.error ?? categoriesResult.error;

  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

  return {
    data: {
      occasions: (occasionsResult.data ?? []) as LookupOption[],
      seasons: (seasonsResult.data ?? []) as LookupOption[],
      categories: (categoriesResult.data ?? []) as LookupOption[],
    },
    error: null,
  };
}

async function enrichPickerItems(
  rows: PickerItemRow[],
): Promise<OutfitPickerItem[]> {
  if (rows.length === 0) {
    return [];
  }

  const imageMap = await fetchPrimaryImageUrlsForItems(rows.map((row) => row.id));
  if (imageMap.error) {
    throw imageMap.error;
  }

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    brand: row.brand,
    primary_image_url: imageMap.data?.[row.id] ?? null,
  }));
}

export async function fetchOutfitPickerItems(
  slot: OutfitSlot,
  search = "",
): Promise<{ data: OutfitPickerItem[] | null; error: Error | null }> {
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

  const filtered = ((data ?? []) as PickerItemRow[]).filter((row) =>
    categoryMatchesOutfitSlot(row.category?.name, slot),
  );

  try {
    const enriched = await enrichPickerItems(filtered);
    return { data: enriched, error: null };
  } catch (caught) {
    return {
      data: null,
      error: caught instanceof Error ? caught : toError("Failed to load items"),
    };
  }
}

export async function fetchOutfits(): Promise<{
  data: OutfitListRow[] | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const [outfitsResult, outfitItemsResult, occasionsResult, seasonsResult] =
    await Promise.all([
      supabase
        .from("outfits")
        .select(OUTFIT_SELECT)
        .order("created_at", { ascending: false }),
      supabase.from("outfit_items").select("outfit_id"),
      supabase.from("occasions").select("id, name"),
      supabase.from("seasons").select("id, name"),
    ]);

  const firstError =
    outfitsResult.error ??
    outfitItemsResult.error ??
    occasionsResult.error ??
    seasonsResult.error;

  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

  const itemCountByOutfit = new Map<string, number>();
  for (const row of outfitItemsResult.data ?? []) {
    itemCountByOutfit.set(
      row.outfit_id,
      (itemCountByOutfit.get(row.outfit_id) ?? 0) + 1,
    );
  }

  const occasionMap = new Map(
    ((occasionsResult.data ?? []) as LookupOption[]).map((occasion) => [
      occasion.id,
      occasion,
    ]),
  );
  const seasons = (seasonsResult.data ?? []) as LookupOption[];

  return {
    data: ((outfitsResult.data ?? []) as OutfitRow[]).map((outfit) => ({
      ...outfit,
      occasion: outfit.occasion_id
        ? (occasionMap.get(outfit.occasion_id) ?? null)
        : null,
      season: seasonTextToLookup(outfit.season, seasons),
      itemCount: itemCountByOutfit.get(outfit.id) ?? 0,
    })),
    error: null,
  };
}

async function fetchOutfitItemsForOutfit(
  outfitId: string,
): Promise<{ data: OutfitItemDetail[] | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("outfit_items")
    .select(OUTFIT_ITEM_SELECT)
    .eq("outfit_id", outfitId);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  const rows = (data ?? []).filter((row) => isOutfitSlot(row.role));
  if (rows.length === 0) {
    return { data: [], error: null };
  }

  const itemIds = [...new Set(rows.map((row) => row.item_id))];
  const { data: itemsData, error: itemsError } = await supabase
    .from("wardrobe_items")
    .select(PICKER_ITEM_SELECT)
    .in("id", itemIds);

  if (itemsError) {
    return { data: null, error: toError(itemsError.message) };
  }

  try {
    const pickerItems = await enrichPickerItems((itemsData ?? []) as PickerItemRow[]);
    const pickerMap = new Map(pickerItems.map((item) => [item.id, item]));

    return {
      data: rows.map((row) => ({
        outfit_id: row.outfit_id,
        item_id: row.item_id,
        slot: row.role as OutfitSlot,
        item: pickerMap.get(row.item_id) ?? null,
      })),
      error: null,
    };
  } catch (caught) {
    return {
      data: null,
      error: caught instanceof Error ? caught : toError("Failed to load outfit items"),
    };
  }
}

export async function fetchOutfitById(
  id: string,
): Promise<{ data: OutfitDetail | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("outfits")
    .select(OUTFIT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  if (!data) {
    return { data: null, error: null };
  }

  const outfit = data as OutfitRow;
  const [itemsResult, occasionsResult, seasonsResult] = await Promise.all([
    fetchOutfitItemsForOutfit(id),
    outfit.occasion_id
      ? supabase
          .from("occasions")
          .select("id, name")
          .eq("id", outfit.occasion_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.from("seasons").select("id, name"),
  ]);

  if (itemsResult.error) {
    return { data: null, error: itemsResult.error };
  }

  if (occasionsResult.error) {
    return { data: null, error: toError(occasionsResult.error.message) };
  }

  if (seasonsResult.error) {
    return { data: null, error: toError(seasonsResult.error.message) };
  }

  const seasons = (seasonsResult.data ?? []) as LookupOption[];

  return {
    data: {
      ...outfit,
      occasion: (occasionsResult.data as LookupOption | null) ?? null,
      season: seasonTextToLookup(outfit.season, seasons),
      items: itemsResult.data ?? [],
    },
    error: null,
  };
}

async function replaceOutfitItems(
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

export async function createOutfit(
  input: SaveOutfitInput,
): Promise<{ data: OutfitRow | null; error: Error | null }> {
  const supabase = createClient();

  try {
    const seasonName = await resolveSeasonName(input.season_id);

    const { data, error } = await supabase
      .from("outfits")
      .insert({
        name: input.name.trim(),
        occasion_id: input.occasion_id ?? null,
        season: seasonName,
        rating: input.rating ?? null,
      })
      .select(OUTFIT_SELECT)
      .single();

    if (error) {
      return { data: null, error: toError(error.message) };
    }

    const replaceResult = await replaceOutfitItems(data.id, input.items);
    if (replaceResult.error) {
      return { data: null, error: replaceResult.error };
    }

    return { data: data as OutfitRow, error: null };
  } catch (caught) {
    return {
      data: null,
      error: caught instanceof Error ? caught : toError("Failed to create outfit"),
    };
  }
}

export async function updateOutfit(
  input: UpdateOutfitInput,
): Promise<{ data: OutfitRow | null; error: Error | null }> {
  const supabase = createClient();

  try {
    const seasonName = await resolveSeasonName(input.season_id);

    const { data, error } = await supabase
      .from("outfits")
      .update({
        name: input.name.trim(),
        occasion_id: input.occasion_id ?? null,
        season: seasonName,
        rating: input.rating ?? null,
      })
      .eq("id", input.id)
      .select(OUTFIT_SELECT)
      .single();

    if (error) {
      return { data: null, error: toError(error.message) };
    }

    const replaceResult = await replaceOutfitItems(input.id, input.items);
    if (replaceResult.error) {
      return { data: null, error: replaceResult.error };
    }

    return { data: data as OutfitRow, error: null };
  } catch (caught) {
    return {
      data: null,
      error: caught instanceof Error ? caught : toError("Failed to update outfit"),
    };
  }
}

export async function deleteOutfit(
  id: string,
): Promise<{ error: Error | null }> {
  const supabase = createClient();

  const { error: itemsError } = await supabase
    .from("outfit_items")
    .delete()
    .eq("outfit_id", id);

  if (itemsError) {
    return { error: toError(itemsError.message) };
  }

  const { error } = await supabase.from("outfits").delete().eq("id", id);

  if (error) {
    return { error: toError(error.message) };
  }

  return { error: null };
}

export async function duplicateOutfit(
  id: string,
): Promise<{ data: OutfitRow | null; error: Error | null }> {
  const outfitResult = await fetchOutfitById(id);

  if (outfitResult.error) {
    return { data: null, error: outfitResult.error };
  }

  if (!outfitResult.data) {
    return { data: null, error: toError("Outfit not found.") };
  }

  const source = outfitResult.data;

  const supabase = createClient();

  const { data, error } = await supabase
    .from("outfits")
    .insert({
      name: `${source.name.trim()} (Copy)`,
      occasion_id: source.occasion_id,
      season: source.season?.name ?? null,
      rating: source.rating,
    })
    .select(OUTFIT_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  const replaceResult = await replaceOutfitItems(
    data.id,
    source.items
      .filter((item) => item.item)
      .map((item) => ({
        item_id: item.item_id,
        slot: item.slot,
      })),
  );

  if (replaceResult.error) {
    return { data: null, error: replaceResult.error };
  }

  return { data: data as OutfitRow, error: null };
}

export function formatOutfitModifiedAt(
  outfit: Pick<OutfitRow, "created_at">,
): string {
  if (!outfit.created_at) {
    return "—";
  }

  return new Date(outfit.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function outfitDetailToSlotSelection(
  outfit: OutfitDetail,
): Partial<Record<OutfitSlot, OutfitPickerItem | null>> {
  const selection: Partial<Record<OutfitSlot, OutfitPickerItem | null>> = {};

  for (const item of outfit.items) {
    if (item.item) {
      selection[item.slot] = item.item;
    }
  }

  return selection;
}

export function outfitSeasonToSelectId(
  outfit: Pick<OutfitDetail, "season">,
): string | null {
  if (!outfit.season) {
    return null;
  }

  return outfit.season.id;
}
