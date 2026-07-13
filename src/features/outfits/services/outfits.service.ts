import {
  fetchActiveWardrobeItems,
  fetchCategories,
  fetchOccasionById,
  fetchOccasions,
  fetchOutfitItemLinks,
  fetchOutfitItemRoles,
  fetchOutfitRowById,
  fetchOutfitRows,
  fetchSeasons,
  fetchWardrobeItemsByIds,
  insertOutfitRow,
  replaceOutfitItems,
  resolveSeasonName,
  updateOutfitFavorite,
  updateOutfitRow,
  deleteOutfitItemsByOutfitId,
  deleteOutfitRow,
  type PickerItemRow,
} from "@/features/outfits/repositories/outfits.repository";
import { fetchPrimaryImageUrlsForItems } from "@/features/inventory/services/images.service";
import { categoryMatchesOutfitSlot } from "@/domain/outfit/slot-matching";
import {
  OUTFIT_SLOT_DEFINITIONS,
  type LookupOption,
  type OutfitDetail,
  type OutfitItemDetail,
  type OutfitListRow,
  type OutfitLookups,
  type OutfitPickerItem,
  type OutfitRow,
  type OutfitSlot,
  type SaveOutfitInput,
  type UpdateOutfitInput,
} from "@/features/outfits/types";
import { toError } from "@/shared/utils/data-result";

function isOutfitSlot(value: string): value is OutfitSlot {
  return OUTFIT_SLOT_DEFINITIONS.some((definition) => definition.slot === value);
}

export function seasonTextToLookup(
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

export async function fetchOutfitLookups(): Promise<{
  data: OutfitLookups | null;
  error: Error | null;
}> {
  const [occasionsResult, seasonsResult, categoriesResult] = await Promise.all([
    fetchOccasions(),
    fetchSeasons(),
    fetchCategories(),
  ]);

  const firstError =
    occasionsResult.error ?? seasonsResult.error ?? categoriesResult.error;

  if (firstError) {
    return { data: null, error: firstError };
  }

  return {
    data: {
      occasions: occasionsResult.data ?? [],
      seasons: seasonsResult.data ?? [],
      categories: categoriesResult.data ?? [],
    },
    error: null,
  };
}

export async function fetchOutfitPickerItems(
  slot: OutfitSlot,
  search = "",
): Promise<{ data: OutfitPickerItem[] | null; error: Error | null }> {
  const itemsResult = await fetchActiveWardrobeItems(search);

  if (itemsResult.error) {
    return { data: null, error: itemsResult.error };
  }

  const filtered = (itemsResult.data ?? []).filter((row) =>
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
  const [outfitsResult, outfitItemsResult, occasionsResult, seasonsResult] =
    await Promise.all([
      fetchOutfitRows(),
      fetchOutfitItemLinks(),
      fetchOccasions(),
      fetchSeasons(),
    ]);

  const firstError =
    outfitsResult.error ??
    outfitItemsResult.error ??
    occasionsResult.error ??
    seasonsResult.error;

  if (firstError) {
    return { data: null, error: firstError };
  }

  const itemCountByOutfit = new Map<string, number>();
  for (const row of outfitItemsResult.data ?? []) {
    itemCountByOutfit.set(
      row.outfit_id,
      (itemCountByOutfit.get(row.outfit_id) ?? 0) + 1,
    );
  }

  const occasionMap = new Map(
    (occasionsResult.data ?? []).map((occasion) => [occasion.id, occasion]),
  );
  const seasons = seasonsResult.data ?? [];

  return {
    data: (outfitsResult.data ?? []).map((outfit) => ({
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

/** Saved outfits that feature the given wardrobe item (RFC-030). */
export async function listOutfitsContainingItem(
  itemId: string,
): Promise<{ data: OutfitListRow[] | null; error: Error | null }> {
  const [outfitsResult, linksResult] = await Promise.all([
    fetchOutfits(),
    fetchOutfitItemLinks(),
  ]);

  const firstError = outfitsResult.error ?? linksResult.error;
  if (firstError) return { data: null, error: firstError };

  const outfitIds = new Set(
    (linksResult.data ?? [])
      .filter((link) => link.item_id === itemId)
      .map((link) => link.outfit_id),
  );

  return {
    data: (outfitsResult.data ?? []).filter((outfit) => outfitIds.has(outfit.id)),
    error: null,
  };
}

async function fetchOutfitItemsForOutfit(
  outfitId: string,
): Promise<{ data: OutfitItemDetail[] | null; error: Error | null }> {
  const rolesResult = await fetchOutfitItemRoles(outfitId);

  if (rolesResult.error) {
    return { data: null, error: rolesResult.error };
  }

  const rows = (rolesResult.data ?? []).filter((row) => isOutfitSlot(row.role));
  if (rows.length === 0) {
    return { data: [], error: null };
  }

  const itemIds = [...new Set(rows.map((row) => row.item_id))];
  const itemsResult = await fetchWardrobeItemsByIds(itemIds);

  if (itemsResult.error) {
    return { data: null, error: itemsResult.error };
  }

  try {
    const pickerItems = await enrichPickerItems(itemsResult.data ?? []);
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
  const outfitResult = await fetchOutfitRowById(id);

  if (outfitResult.error) {
    return { data: null, error: outfitResult.error };
  }

  if (!outfitResult.data) {
    return { data: null, error: null };
  }

  const outfit = outfitResult.data;
  const [itemsResult, occasionResult, seasonsResult] = await Promise.all([
    fetchOutfitItemsForOutfit(id),
    outfit.occasion_id
      ? fetchOccasionById(outfit.occasion_id)
      : Promise.resolve({ data: null, error: null }),
    fetchSeasons(),
  ]);

  if (itemsResult.error) {
    return { data: null, error: itemsResult.error };
  }

  if (occasionResult.error) {
    return { data: null, error: occasionResult.error };
  }

  if (seasonsResult.error) {
    return { data: null, error: seasonsResult.error };
  }

  const seasons = seasonsResult.data ?? [];

  return {
    data: {
      ...outfit,
      occasion: occasionResult.data,
      season: seasonTextToLookup(outfit.season, seasons),
      items: itemsResult.data ?? [],
    },
    error: null,
  };
}

export async function createOutfit(
  input: SaveOutfitInput,
): Promise<{ data: OutfitRow | null; error: Error | null }> {
  try {
    const seasonName = await resolveSeasonName(input.season_id);

    const insertResult = await insertOutfitRow({
      name: input.name.trim(),
      occasion_id: input.occasion_id ?? null,
      season: seasonName,
      rating: input.rating ?? null,
      notes: input.notes?.trim() || null,
    });

    if (insertResult.error || !insertResult.data) {
      return { data: null, error: insertResult.error };
    }

    const replaceResult = await replaceOutfitItems(insertResult.data.id, input.items);
    if (replaceResult.error) {
      return { data: null, error: replaceResult.error };
    }

    return { data: insertResult.data, error: null };
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
  try {
    const seasonName = await resolveSeasonName(input.season_id);

    const updateResult = await updateOutfitRow(input.id, {
      name: input.name.trim(),
      occasion_id: input.occasion_id ?? null,
      season: seasonName,
      rating: input.rating ?? null,
      notes: input.notes?.trim() || null,
    });

    if (updateResult.error || !updateResult.data) {
      return { data: null, error: updateResult.error };
    }

    const replaceResult = await replaceOutfitItems(input.id, input.items);
    if (replaceResult.error) {
      return { data: null, error: replaceResult.error };
    }

    return { data: updateResult.data, error: null };
  } catch (caught) {
    return {
      data: null,
      error: caught instanceof Error ? caught : toError("Failed to update outfit"),
    };
  }
}

export async function setOutfitFavorite(
  id: string,
  favorite: boolean,
): Promise<{ data: OutfitRow | null; error: Error | null }> {
  return updateOutfitFavorite(id, favorite);
}

export async function deleteOutfit(
  id: string,
): Promise<{ error: Error | null }> {
  const itemsError = await deleteOutfitItemsByOutfitId(id);
  if (itemsError.error) {
    return itemsError;
  }

  return deleteOutfitRow(id);
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

  const insertResult = await insertOutfitRow({
    name: `${source.name.trim()} (Copy)`,
    occasion_id: source.occasion_id,
    season: source.season?.name ?? null,
    rating: source.rating,
    notes: source.notes,
  });

  if (insertResult.error || !insertResult.data) {
    return { data: null, error: insertResult.error };
  }

  const replaceResult = await replaceOutfitItems(
    insertResult.data.id,
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

  return { data: insertResult.data, error: null };
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
