import {
  mapCareProfile,
  mapOccasions,
  selectItemRelationIds,
  selectLookupsByIds,
} from "@/features/inventory/repositories/relations.repository";
import type { WardrobeItemRelations } from "@/features/inventory/types";

export async function fetchWardrobeItemRelations(
  itemId: string,
): Promise<{ data: WardrobeItemRelations | null; error: Error | null }> {
  const relationIdsResult = await selectItemRelationIds(itemId);

  if (relationIdsResult.error) {
    return { data: null, error: relationIdsResult.error };
  }

  if (!relationIdsResult.data) {
    return { data: null, error: null };
  }

  const {
    materialIds,
    seasonIds,
    styleIds,
    featureIds,
    tagIds,
    occasions,
    care,
  } = relationIdsResult.data;

  const occasionIds = occasions
    .map((row) => row.occasion_id)
    .filter((id): id is string => Boolean(id));
  const storageTypeId = care?.storage_type_id ?? null;

  const [
    materialsLookup,
    seasonsLookup,
    stylesLookup,
    featuresLookup,
    tagsLookup,
    occasionsLookup,
    storageTypesLookup,
  ] = await Promise.all([
    selectLookupsByIds("materials", materialIds),
    selectLookupsByIds("seasons", seasonIds),
    selectLookupsByIds("styles", styleIds),
    selectLookupsByIds("features", featureIds),
    selectLookupsByIds("tags", tagIds),
    selectLookupsByIds("occasions", occasionIds),
    selectLookupsByIds("storage_types", storageTypeId ? [storageTypeId] : []),
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
      occasions: mapOccasions(occasions, occasionMap),
      care: mapCareProfile(care, storageTypeMap),
    },
    error: null,
  };
}
