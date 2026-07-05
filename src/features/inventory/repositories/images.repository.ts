import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { ItemImageRow } from "@/features/inventory/types";
import {
  DEFAULT_PRIMARY_IMAGE_TYPE,
  WARDROBE_IMAGES_BUCKET,
  type ImageType,
} from "@/types/wardrobe";

export const ITEM_IMAGE_SELECT =
  "id, item_id, image_url, image_type, is_primary, created_at";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

export function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function buildStoragePath(itemId: string, filename: string) {
  return `wardrobe-items/${itemId}/${Date.now()}-${sanitizeFilename(filename)}`;
}

export async function createSignedImageUrl(
  imageUrlOrPath: string,
): Promise<string | null> {
  const supabase = createClient();
  const path = extractWardrobeImageStoragePath(imageUrlOrPath);

  const { data, error } = await supabase.storage
    .from(WARDROBE_IMAGES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

export function extractWardrobeImageStoragePath(imageUrlOrPath: string): string {
  if (!imageUrlOrPath.startsWith("http")) {
    return imageUrlOrPath.replace(/^\/+/, "");
  }

  const bucketSegment = `/${WARDROBE_IMAGES_BUCKET}/`;
  const bucketIndex = imageUrlOrPath.indexOf(bucketSegment);

  if (bucketIndex === -1) {
    return imageUrlOrPath;
  }

  return imageUrlOrPath.slice(bucketIndex + bucketSegment.length).split("?")[0];
}

export async function createSignedImageUrls(
  imageUrlOrPaths: string[],
): Promise<Record<string, string>> {
  if (imageUrlOrPaths.length === 0) {
    return {};
  }

  const supabase = createClient();
  const paths = imageUrlOrPaths.map(extractWardrobeImageStoragePath);

  const { data, error } = await supabase.storage
    .from(WARDROBE_IMAGES_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (error || !data) {
    return {};
  }

  const resolved: Record<string, string> = {};

  for (const [index, item] of data.entries()) {
    const original = imageUrlOrPaths[index];
    if (original && item?.signedUrl) {
      resolved[original] = item.signedUrl;
    }
  }

  return resolved;
}

export async function selectItemImages(
  itemId: string,
): Promise<{ data: ItemImageRow[] | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("item_images")
    .select(ITEM_IMAGE_SELECT)
    .eq("item_id", itemId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as ItemImageRow[], error: null };
}

export async function selectPrimaryImageUrls(
  itemIds: string[],
): Promise<{
  data: { item_id: string; image_url: string }[] | null;
  error: Error | null;
}> {
  if (itemIds.length === 0) {
    return { data: [], error: null };
  }

  const supabase = createClient();
  // Fetch primary + fallback candidates ordered so the primary (or, when none
  // exists, the latest) image wins per item.
  const { data, error } = await supabase
    .from("item_images")
    .select("item_id, image_url, is_primary, created_at")
    .in("item_id", itemIds)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  const byItem = new Map<string, string>();
  for (const row of (data ?? []) as {
    item_id: string;
    image_url: string;
  }[]) {
    if (row.item_id && row.image_url && !byItem.has(row.item_id)) {
      byItem.set(row.item_id, row.image_url);
    }
  }

  return {
    data: [...byItem.entries()].map(([item_id, image_url]) => ({
      item_id,
      image_url,
    })),
    error: null,
  };
}

export async function selectPrimaryImageUrlRow(
  itemId: string,
): Promise<{ data: { image_url: string } | null; error: Error | null }> {
  const supabase = createClient();
  // Primary first, else fall back to the most recent image.
  const { data, error } = await supabase
    .from("item_images")
    .select("image_url, is_primary, created_at")
    .eq("item_id", itemId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data ? { image_url: data.image_url } : null, error: null };
}

export async function selectItemImageById(
  imageId: string,
): Promise<{ data: ItemImageRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("item_images")
    .select(ITEM_IMAGE_SELECT)
    .eq("id", imageId)
    .maybeSingle();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data as ItemImageRow | null) ?? null, error: null };
}

export async function clearPrimaryImages(itemId: string): Promise<Error | null> {
  const supabase = createClient();
  const { error } = await supabase
    .from("item_images")
    .update({ is_primary: false })
    .eq("item_id", itemId)
    .eq("is_primary", true);

  if (error) {
    return toError(error.message);
  }

  return null;
}

export async function uploadImageToStorage(
  storagePath: string,
  file: File,
): Promise<Error | null> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(WARDROBE_IMAGES_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

  if (error) {
    return toError(error.message);
  }

  return null;
}

export async function insertPrimaryItemImage(
  itemId: string,
  storagePath: string,
): Promise<{ data: ItemImageRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("item_images")
    .insert({
      item_id: itemId,
      image_url: storagePath,
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

export async function insertItemImage(input: {
  itemId: string;
  storagePath: string;
  imageType: ImageType;
  isPrimary: boolean;
}): Promise<{ data: ItemImageRow | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("item_images")
    .insert({
      item_id: input.itemId,
      image_url: input.storagePath,
      image_type: input.imageType,
      is_primary: input.isPrimary,
    })
    .select(ITEM_IMAGE_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as ItemImageRow, error: null };
}

/** Sets one image primary and clears the flag on all other images for the item. */
export async function setImagePrimaryById(
  itemId: string,
  imageId: string,
): Promise<Error | null> {
  const clearError = await clearPrimaryImages(itemId);
  if (clearError) {
    return clearError;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("item_images")
    .update({ is_primary: true })
    .eq("id", imageId);

  if (error) {
    return toError(error.message);
  }

  return null;
}

export async function deleteItemImageRow(imageId: string): Promise<Error | null> {
  const supabase = createClient();
  const { error } = await supabase
    .from("item_images")
    .delete()
    .eq("id", imageId);

  if (error) {
    return toError(error.message);
  }

  return null;
}

export async function removeImageFromStorage(
  imageUrlOrPath: string,
): Promise<Error | null> {
  const supabase = createClient();
  const path = extractWardrobeImageStoragePath(imageUrlOrPath);
  const { error } = await supabase.storage
    .from(WARDROBE_IMAGES_BUCKET)
    .remove([path]);

  if (error) {
    return toError(error.message);
  }

  return null;
}

/** True when the item has at least one image (used to seed the first primary). */
export async function countItemImages(
  itemId: string,
): Promise<{ data: number; error: Error | null }> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("item_images")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId);

  if (error) {
    return { data: 0, error: toError(error.message) };
  }

  return { data: count ?? 0, error: null };
}

export function getWardrobeImagePublicUrl(path: string) {
  const supabase = createClient();
  const { data } = supabase.storage
    .from(WARDROBE_IMAGES_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}
