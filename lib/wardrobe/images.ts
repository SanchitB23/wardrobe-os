import { createClient } from "@/lib/supabase/client";
import type { ItemImageRow } from "@/types/wardrobe";
import {
  DEFAULT_PRIMARY_IMAGE_TYPE,
  WARDROBE_IMAGES_BUCKET,
} from "@/types/wardrobe";

const ITEM_IMAGE_SELECT =
  "id, item_id, image_url, image_type, is_primary, created_at";

function toError(message: string) {
  return new Error(message);
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildStoragePath(itemId: string, filename: string) {
  return `wardrobe-items/${itemId}/${Date.now()}-${sanitizeFilename(filename)}`;
}

export function getWardrobeImagePublicUrl(path: string) {
  const supabase = createClient();
  const { data } = supabase.storage
    .from(WARDROBE_IMAGES_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

export async function fetchPrimaryImageUrlsForItems(
  itemIds: string[],
): Promise<{ data: Record<string, string> | null; error: Error | null }> {
  if (itemIds.length === 0) {
    return { data: {}, error: null };
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("item_images")
    .select("item_id, image_url")
    .in("item_id", itemIds)
    .eq("is_primary", true);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  const map: Record<string, string> = {};

  for (const row of data ?? []) {
    if (row.item_id && row.image_url) {
      map[row.item_id] = row.image_url;
    }
  }

  return { data: map, error: null };
}

export async function fetchPrimaryImageUrl(
  itemId: string,
): Promise<{ data: string | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("item_images")
    .select("image_url")
    .eq("item_id", itemId)
    .eq("is_primary", true)
    .maybeSingle();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data?.image_url ?? null, error: null };
}

async function clearPrimaryImages(itemId: string) {
  const supabase = createClient();

  const { error } = await supabase
    .from("item_images")
    .update({ is_primary: false })
    .eq("item_id", itemId)
    .eq("is_primary", true);

  if (error) {
    throw toError(error.message);
  }
}

export async function uploadPrimaryItemImage(
  itemId: string,
  file: File,
): Promise<{ data: ItemImageRow | null; error: Error | null }> {
  const supabase = createClient();
  const storagePath = buildStoragePath(itemId, file.name);

  const { error: uploadError } = await supabase.storage
    .from(WARDROBE_IMAGES_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) {
    return { data: null, error: toError(uploadError.message) };
  }

  const publicUrl = getWardrobeImagePublicUrl(storagePath);

  try {
    await clearPrimaryImages(itemId);
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : toError("Failed to update images"),
    };
  }

  const { data, error } = await supabase
    .from("item_images")
    .insert({
      item_id: itemId,
      image_url: publicUrl,
      image_type: DEFAULT_PRIMARY_IMAGE_TYPE,
      is_primary: true,
    })
    .select(ITEM_IMAGE_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as ItemImageRow, error: null };
}
