import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type {
  ItemCareProfile,
  ItemOccasionRelation,
  LookupOption,
  WardrobeItemRelations,
} from "@/features/inventory/types";

function sortByName(items: LookupOption[]): LookupOption[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}

export async function selectLookupsByIds(
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

export async function selectItemRelationIds(itemId: string): Promise<{
  data: {
    materialIds: string[];
    seasonIds: string[];
    styleIds: string[];
    featureIds: string[];
    tagIds: string[];
    occasions: Array<{
      id: string;
      score: number | null;
      notes: string | null;
      occasion_id: string | null;
    }>;
    care: {
      wash: string | null;
      storage: string | null;
      notes: string | null;
      storage_type_id: string | null;
    } | null;
  } | null;
  error: Error | null;
}> {
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

  return {
    data: {
      materialIds: (materialsResult.data ?? []).map((row) => row.material_id),
      seasonIds: (seasonsResult.data ?? []).map((row) => row.season_id),
      styleIds: (stylesResult.data ?? []).map((row) => row.style_id),
      featureIds: (featuresResult.data ?? []).map((row) => row.feature_id),
      tagIds: (tagsResult.data ?? []).map((row) => row.tag_id),
      occasions: occasionsResult.data ?? [],
      care: careResult.data ?? null,
    },
    error: null,
  };
}

export function mapOccasions(
  rows: Array<{
    id: string;
    score: number | null;
    notes: string | null;
    occasion_id: string | null;
  }>,
  occasionMap: Map<string, LookupOption>,
): ItemOccasionRelation[] {
  return rows
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

export function mapCareProfile(
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

export type ResolvedRelations = WardrobeItemRelations;
