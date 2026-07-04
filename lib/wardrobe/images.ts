import { createClient } from "@/lib/supabase/client";
import type { ItemImageRow } from "@/types/wardrobe";
import {
  DEFAULT_PRIMARY_IMAGE_TYPE,
  formatEnumLabel,
  WARDROBE_IMAGES_BUCKET,
} from "@/types/wardrobe";

const ITEM_IMAGE_SELECT =
  "id, item_id, image_url, image_type, is_primary, created_at";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;

export const MAX_ITEM_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_ITEM_IMAGE_SIZE_LABEL = "5 MB";

export type ItemImageAltContext = "thumbnail" | "preview" | "hero" | "gallery";

export type ItemImageValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export function validateItemImageFile(file: File): ItemImageValidationResult {
  if (!file.type.startsWith("image/")) {
    return {
      valid: false,
      message: "Only image files are allowed (JPEG, PNG, WebP, or GIF).",
    };
  }

  if (file.size > MAX_ITEM_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      message: `Image must be ${MAX_ITEM_IMAGE_SIZE_LABEL} or smaller.`,
    };
  }

  return { valid: true };
}

export function buildItemImageAltText(
  itemName: string,
  context: ItemImageAltContext,
  imageType?: string | null,
): string {
  switch (context) {
    case "thumbnail":
      return `Photo of ${itemName}`;
    case "preview":
      return `Preview photo for ${itemName}`;
    case "hero":
      return `Primary photo of ${itemName}`;
    case "gallery":
      return imageType
        ? `${itemName}, ${formatEnumLabel(imageType)} view`
        : `Photo of ${itemName}`;
    default: {
      const _exhaustive: never = context;
      return _exhaustive;
    }
  }
}

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

async function resolveSignedImageUrl(
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

async function resolveSignedImageUrls(
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

async function resolveItemImageRow(
  row: ItemImageRow,
): Promise<ItemImageRow | null> {
  const signedUrl = await resolveSignedImageUrl(row.image_url);
  if (!signedUrl) {
    return null;
  }

  return {
    ...row,
    image_url: signedUrl,
  };
}

export async function fetchItemImagesForItem(
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

  const rows = await Promise.all((data ?? []).map((row) => resolveItemImageRow(row as ItemImageRow)));
  const resolvedRows = rows.filter((row): row is ItemImageRow => row !== null);

  return { data: resolvedRows, error: null };
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
  const rawUrls: string[] = [];

  for (const row of data ?? []) {
    if (row.item_id && row.image_url) {
      rawUrls.push(row.image_url);
    }
  }

  const signedByOriginal = await resolveSignedImageUrls(rawUrls);

  for (const row of data ?? []) {
    if (row.item_id && row.image_url) {
      map[row.item_id] = signedByOriginal[row.image_url] ?? row.image_url;
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

  if (!data?.image_url) {
    return { data: null, error: null };
  }

  const signedUrl = await resolveSignedImageUrl(data.image_url);

  return { data: signedUrl, error: null };
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
  const validation = validateItemImageFile(file);
  if (!validation.valid) {
    return { data: null, error: toError(validation.message) };
  }

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
      image_url: storagePath,
      image_type: DEFAULT_PRIMARY_IMAGE_TYPE,
      is_primary: true,
    })
    .select(ITEM_IMAGE_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  const resolved = await resolveItemImageRow(data as ItemImageRow);

  return { data: resolved, error: null };
}
