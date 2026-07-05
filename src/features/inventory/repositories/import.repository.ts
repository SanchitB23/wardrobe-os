import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { WardrobeImportLookups } from "@/features/inventory/types";

export async function selectImportLookups(): Promise<{
  data: WardrobeImportLookups | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const [
    categoriesResult,
    subcategoriesResult,
    brandsResult,
    colorsResult,
    materialsResult,
    seasonsResult,
    stylesResult,
    featuresResult,
    tagsResult,
    occasionsResult,
    storageTypesResult,
  ] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("subcategories").select("id, name, category_id").order("name"),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("colors").select("id, name").order("name"),
    supabase.from("materials").select("id, name").order("name"),
    supabase.from("seasons").select("id, name").order("name"),
    supabase.from("styles").select("id, name").order("name"),
    supabase.from("features").select("id, name").order("name"),
    supabase.from("tags").select("id, name").order("name"),
    supabase.from("occasions").select("id, name").order("name"),
    supabase.from("storage_types").select("id, name").order("name"),
  ]);

  const firstError =
    categoriesResult.error ??
    subcategoriesResult.error ??
    brandsResult.error ??
    colorsResult.error ??
    materialsResult.error ??
    seasonsResult.error ??
    stylesResult.error ??
    featuresResult.error ??
    tagsResult.error ??
    occasionsResult.error ??
    storageTypesResult.error;

  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

  return {
    data: {
      categories: categoriesResult.data ?? [],
      subcategories: subcategoriesResult.data ?? [],
      brands: brandsResult.data ?? [],
      colors: colorsResult.data ?? [],
      materials: materialsResult.data ?? [],
      seasons: seasonsResult.data ?? [],
      styles: stylesResult.data ?? [],
      features: featuresResult.data ?? [],
      tags: tagsResult.data ?? [],
      occasions: occasionsResult.data ?? [],
      storage_types: storageTypesResult.data ?? [],
    },
    error: null,
  };
}

export async function selectImportExistingCodes(): Promise<{
  data: string[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.from("wardrobe_items").select("code");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []).map((row) => row.code), error: null };
}
