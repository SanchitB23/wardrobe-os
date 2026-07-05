import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type { ItemImageRow } from "@/features/inventory/types";
import {
  DEFAULT_PRIMARY_IMAGE_TYPE,
  WARDROBE_IMAGES_BUCKET,
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
  const { data, error } = await supabase
    .from("item_images")
    .select("item_id, image_url")
    .in("item_id", itemIds)
    .eq("is_primary", true);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return {
    data: (data ?? []) as { item_id: string; image_url: string }[],
    error: null,
  };
}

export async function selectPrimaryImageUrlRow(
  itemId: string,
): Promise<{ data: { image_url: string } | null; error: Error | null }> {
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

  return { data: data ?? null, error: null };
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

export function getWardrobeImagePublicUrl(path: string) {
  const supabase = createClient();
  const { data } = supabase.storage
    .from(WARDROBE_IMAGES_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}
