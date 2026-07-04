import { createClient } from "@/lib/supabase/client";
import type {
  ItemCareProfile,
  ItemOccasionRelation,
  LookupOption,
  WardrobeItemRelations,
} from "@/types/wardrobe";

function toError(message: string) {
  return new Error(message);
}

function sortByName(items: LookupOption[]): LookupOption[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

async function fetchLookupsByIds(
  table: "materials" | "seasons" | "styles" | "features" | "tags" | "occasions" | "storage_types",
  ids: string[],
): Promise<{ data: LookupOption[]; error: Error | null }> {
  if (ids.length === 0) {
    return { data: [], error: null };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from(table)
    .select("id, name")
    .in("id", ids);

  if (error) {
    return { data: [], error: toError(error.message) };
  }

  return { data: sortByName(data ?? []), error: null };
}

function mapOccasions(
  rows: Array<{
    id: string;
    score: number | null;
    notes: string | null;
    occasion_id: string | null;
  }> | null,
  occasionMap: Map<string, LookupOption>,
): ItemOccasionRelation[] {
  return (rows ?? [])
    .map((row) => ({
      id: row.id,
      score: row.score,
      notes: row.notes,
      occasion: row.occasion_id ? (occasionMap.get(row.occasion_id) ?? null) : null,
    }))
    .sort((a, b) => {
      const scoreA = a.score ?? -1;
      const scoreB = b.score ?? -1;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return (a.occasion?.name ?? "").localeCompare(b.occasion?.name ?? "");
    });
}

function mapCareProfile(
  row: {
    wash: string | null;
    storage: string | null;
    notes: string | null;
    storage_type_id: string | null;
  } | null,
  storageTypeMap: Map<string, LookupOption>,
): ItemCareProfile | null {
  if (!row) {
    return null;
  }

  const storage_type = row.storage_type_id
    ? (storageTypeMap.get(row.storage_type_id) ?? null)
    : null;

  const hasContent =
    Boolean(row.wash?.trim()) ||
    Boolean(row.storage?.trim()) ||
    Boolean(row.notes?.trim()) ||
    Boolean(storage_type?.name);

  if (!hasContent) {
    return null;
  }

  return {
    wash: row.wash,
    storage: row.storage,
    notes: row.notes,
    storage_type,
  };
}

export async function fetchWardrobeItemRelations(
  itemId: string,
): Promise<{ data: WardrobeItemRelations | null; error: Error | null }> {
  const supabase = createClient();

  const [
    materialsResult,
    seasonsResult,
    stylesResult,
    featuresResult,
    tagsResult,
    occasionsResult,
    careResult,
  ] = await Promise.all([
    supabase
      .from("item_materials")
      .select("material_id")
      .eq("item_id", itemId),
    supabase.from("item_seasons").select("season_id").eq("item_id", itemId),
    supabase.from("item_styles").select("style_id").eq("item_id", itemId),
    supabase.from("item_features").select("feature_id").eq("item_id", itemId),
    supabase.from("item_tags").select("tag_id").eq("item_id", itemId),
    supabase
      .from("item_occasions")
      .select("id, score, notes, occasion_id")
      .eq("item_id", itemId),
    supabase
      .from("care_profiles")
      .select("wash, storage, notes, storage_type_id")
      .eq("item_id", itemId)
      .maybeSingle(),
  ]);

  const firstError =
    materialsResult.error ??
    seasonsResult.error ??
    stylesResult.error ??
    featuresResult.error ??
    tagsResult.error ??
    occasionsResult.error ??
    careResult.error;

  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

  const materialIds = (materialsResult.data ?? []).map((row) => row.material_id);
  const seasonIds = (seasonsResult.data ?? []).map((row) => row.season_id);
  const styleIds = (stylesResult.data ?? []).map((row) => row.style_id);
  const featureIds = (featuresResult.data ?? []).map((row) => row.feature_id);
  const tagIds = (tagsResult.data ?? []).map((row) => row.tag_id);
  const occasionIds = (occasionsResult.data ?? [])
    .map((row) => row.occasion_id)
    .filter((id): id is string => Boolean(id));
  const storageTypeId = careResult.data?.storage_type_id ?? null;

  const [
    materialsLookup,
    seasonsLookup,
    stylesLookup,
    featuresLookup,
    tagsLookup,
    occasionsLookup,
    storageTypesLookup,
  ] = await Promise.all([
    fetchLookupsByIds("materials", materialIds),
    fetchLookupsByIds("seasons", seasonIds),
    fetchLookupsByIds("styles", styleIds),
    fetchLookupsByIds("features", featureIds),
    fetchLookupsByIds("tags", tagIds),
    fetchLookupsByIds("occasions", occasionIds),
    fetchLookupsByIds("storage_types", storageTypeId ? [storageTypeId] : []),
  ]);

  const lookupError =
    materialsLookup.error ??
    seasonsLookup.error ??
    stylesLookup.error ??
    featuresLookup.error ??
    tagsLookup.error ??
    occasionsLookup.error ??
    storageTypesLookup.error;

  if (lookupError) {
    return { data: null, error: lookupError };
  }

  const occasionMap = new Map(
    occasionsLookup.data.map((occasion) => [occasion.id, occasion]),
  );
  const storageTypeMap = new Map(
    storageTypesLookup.data.map((storageType) => [storageType.id, storageType]),
  );

  return {
    data: {
      materials: materialsLookup.data,
      seasons: seasonsLookup.data,
      styles: stylesLookup.data,
      features: featuresLookup.data,
      tags: tagsLookup.data,
      occasions: mapOccasions(occasionsResult.data, occasionMap),
      care: mapCareProfile(careResult.data, storageTypeMap),
    },
    error: null,
  };
}
