import {
  buildStoragePath,
  clearPrimaryImages,
  countItemImages,
  createSignedImageUrl,
  createSignedImageUrls,
  deleteItemImageRow,
  extractWardrobeImageStoragePath,
  getWardrobeImagePublicUrl,
  insertItemImage,
  insertPrimaryItemImage,
  removeImageFromStorage,
  selectItemImageById,
  selectItemImages,
  selectPrimaryImageUrlRow,
  selectPrimaryImageUrls,
  setImagePrimaryById,
  uploadImageToStorage,
} from "@/features/inventory/repositories/images.repository";
import type { ItemImageRow } from "@/features/inventory/types";
import { formatEnumLabel, type ImageType } from "@/types/wardrobe";
import { toError } from "@/shared/utils/data-result";

export const IMAGE_TYPE_OPTIONS: { value: ImageType; label: string }[] = [
  { value: "product", label: "Product" },
  { value: "flatlay", label: "Flat lay" },
  { value: "hanger", label: "Hanger" },
  { value: "worn", label: "Worn" },
  { value: "closeup", label: "Close-up" },
  { value: "label", label: "Label" },
];

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

export { extractWardrobeImageStoragePath, getWardrobeImagePublicUrl };

async function resolveItemImageRow(
  row: ItemImageRow,
): Promise<ItemImageRow | null> {
  const signedUrl = await createSignedImageUrl(row.image_url);
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
  const result = await selectItemImages(itemId);

  if (result.error) {
    return { data: null, error: result.error };
  }

  const rows = await Promise.all(
    (result.data ?? []).map((row) => resolveItemImageRow(row)),
  );
  const resolvedRows = rows.filter((row): row is ItemImageRow => row !== null);

  return { data: resolvedRows, error: null };
}

export async function fetchPrimaryImageUrlsForItems(
  itemIds: string[],
): Promise<{ data: Record<string, string> | null; error: Error | null }> {
  const result = await selectPrimaryImageUrls(itemIds);

  if (result.error) {
    return { data: null, error: result.error };
  }

  const map: Record<string, string> = {};
  const rawUrls: string[] = [];

  for (const row of result.data ?? []) {
    if (row.item_id && row.image_url) {
      rawUrls.push(row.image_url);
    }
  }

  const signedByOriginal = await createSignedImageUrls(rawUrls);

  for (const row of result.data ?? []) {
    if (row.item_id && row.image_url) {
      map[row.item_id] = signedByOriginal[row.image_url] ?? row.image_url;
    }
  }

  return { data: map, error: null };
}

export async function fetchPrimaryImageUrl(
  itemId: string,
): Promise<{ data: string | null; error: Error | null }> {
  const result = await selectPrimaryImageUrlRow(itemId);

  if (result.error) {
    return { data: null, error: result.error };
  }

  if (!result.data?.image_url) {
    return { data: null, error: null };
  }

  const signedUrl = await createSignedImageUrl(result.data.image_url);

  return { data: signedUrl, error: null };
}

export async function uploadPrimaryItemImage(
  itemId: string,
  file: File,
): Promise<{ data: ItemImageRow | null; error: Error | null }> {
  const validation = validateItemImageFile(file);
  if (!validation.valid) {
    return { data: null, error: toError(validation.message) };
  }

  const storagePath = buildStoragePath(itemId, file.name);
  const uploadError = await uploadImageToStorage(storagePath, file);

  if (uploadError) {
    return { data: null, error: uploadError };
  }

  const clearError = await clearPrimaryImages(itemId);
  if (clearError) {
    return { data: null, error: clearError };
  }

  const insertResult = await insertPrimaryItemImage(itemId, storagePath);
  if (insertResult.error) {
    return { data: null, error: insertResult.error };
  }

  if (!insertResult.data) {
    return { data: null, error: null };
  }

  const resolved = await resolveItemImageRow(insertResult.data);

  return { data: resolved, error: null };
}

/**
 * Uploads one gallery image with a chosen type. Becomes primary when
 * requested or when it is the item's first image.
 */
export async function uploadItemImage(input: {
  itemId: string;
  file: File;
  imageType: ImageType;
  makePrimary?: boolean;
}): Promise<{ data: ItemImageRow | null; error: Error | null }> {
  const validation = validateItemImageFile(input.file);
  if (!validation.valid) {
    return { data: null, error: toError(validation.message) };
  }

  const countResult = await countItemImages(input.itemId);
  if (countResult.error) {
    return { data: null, error: countResult.error };
  }
  const isFirstImage = countResult.data === 0;
  const shouldBePrimary = Boolean(input.makePrimary) || isFirstImage;

  const storagePath = buildStoragePath(input.itemId, input.file.name);
  const uploadError = await uploadImageToStorage(storagePath, input.file);
  if (uploadError) {
    return { data: null, error: uploadError };
  }

  if (shouldBePrimary) {
    const clearError = await clearPrimaryImages(input.itemId);
    if (clearError) {
      return { data: null, error: clearError };
    }
  }

  const insertResult = await insertItemImage({
    itemId: input.itemId,
    storagePath,
    imageType: input.imageType,
    isPrimary: shouldBePrimary,
  });
  if (insertResult.error || !insertResult.data) {
    return { data: null, error: insertResult.error };
  }

  const resolved = await resolveItemImageRow(insertResult.data);
  return { data: resolved, error: null };
}

/** Makes one image primary and clears the flag on the rest. */
export async function setPrimaryItemImage(
  itemId: string,
  imageId: string,
): Promise<{ error: Error | null }> {
  const error = await setImagePrimaryById(itemId, imageId);
  return { error };
}

/** Deletes an image row and removes the underlying storage object. */
export async function deleteItemImage(
  imageId: string,
): Promise<{ error: Error | null }> {
  const imageResult = await selectItemImageById(imageId);
  if (imageResult.error) {
    return { error: imageResult.error };
  }
  if (!imageResult.data) {
    return { error: toError("Image not found.") };
  }

  const deleteError = await deleteItemImageRow(imageId);
  if (deleteError) {
    return { error: deleteError };
  }

  // Best-effort storage cleanup — the row is already gone.
  await removeImageFromStorage(imageResult.data.image_url);

  return { error: null };
}
