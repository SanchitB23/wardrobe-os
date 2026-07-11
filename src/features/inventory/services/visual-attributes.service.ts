/**
 * Inventory Image Intelligence service (RFC-020).
 * Orchestrates Vision → analyzer → persist → Accept/Reject. Never overwrites
 * manual wardrobe fields. Returns { data, error }.
 */

import {
  analyzeInventoryImage,
  mergeVisualIntoStyleDNAItem,
  visualManualDiff,
  type VisualStyleAttributes,
} from "@/domain/inventory-image-intelligence";
import type { StyleDNAItem } from "@/domain/style-dna";
import {
  createSignedImageUrl,
  selectItemImages,
} from "@/features/inventory/repositories/images.repository";
import {
  rowToVisualStyleAttributes,
  selectBackfillCandidates,
  selectVisualAttributesByItemId,
  updateVisualAttributesStatus,
  upsertVisualAttributesPending,
} from "@/features/inventory/repositories/visual-attributes.repository";
import { analyzeImageRequest } from "@/features/vision/vision.client";
import { toError } from "@/shared/utils/data-result";

type Result<T> = { data: T | null; error: Error | null };

async function urlToBase64(
  url: string,
): Promise<{ base64: string; mimeType: string } | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  const blob = await res.blob();
  const mimeType = blob.type || "image/jpeg";
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { base64: btoa(binary), mimeType };
}

async function resolvePrimaryImage(
  itemId: string,
): Promise<{ imageId: string; signedUrl: string } | null> {
  const images = await selectItemImages(itemId);
  if (images.error || !images.data?.length) return null;
  const primary =
    images.data.find((r) => r.is_primary) ?? images.data[0] ?? null;
  if (!primary) return null;
  const signedUrl = await createSignedImageUrl(primary.image_url);
  if (!signedUrl) return null;
  return { imageId: primary.id, signedUrl };
}

export async function getItemVisualAttributes(
  itemId: string,
): Promise<Result<VisualStyleAttributes>> {
  const result = await selectVisualAttributesByItemId(itemId);
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: null };
  return { data: rowToVisualStyleAttributes(result.data), error: null };
}

export async function analyzeItemPrimaryImage(
  itemId: string,
): Promise<Result<VisualStyleAttributes>> {
  const primary = await resolvePrimaryImage(itemId);
  if (!primary) {
    return {
      data: null,
      error: toError("No primary image to analyze. Upload a photo first."),
    };
  }

  const encoded = await urlToBase64(primary.signedUrl);
  if (!encoded) {
    return { data: null, error: toError("Could not download primary image.") };
  }

  let analysis;
  try {
    analysis = await analyzeImageRequest({
      imageBase64: encoded.base64,
      mimeType: encoded.mimeType,
      source: "gallery",
    });
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : toError("Vision analysis failed."),
    };
  }

  const attrs = analyzeInventoryImage(analysis, {
    itemId,
    imageId: primary.imageId,
  });

  const upserted = await upsertVisualAttributesPending(attrs);
  if (upserted.error || !upserted.data) {
    return {
      data: null,
      error: upserted.error ?? toError("Failed to save visual attributes."),
    };
  }

  return { data: rowToVisualStyleAttributes(upserted.data), error: null };
}

export async function acceptItemVisualAttributes(
  itemId: string,
): Promise<Result<VisualStyleAttributes>> {
  const result = await updateVisualAttributesStatus(itemId, "accepted");
  if (result.error) return { data: null, error: result.error };
  if (!result.data) {
    return { data: null, error: toError("No visual attributes to accept.") };
  }
  return { data: rowToVisualStyleAttributes(result.data), error: null };
}

export async function rejectItemVisualAttributes(
  itemId: string,
): Promise<Result<VisualStyleAttributes>> {
  const result = await updateVisualAttributesStatus(itemId, "rejected");
  if (result.error) return { data: null, error: result.error };
  if (!result.data) {
    return { data: null, error: toError("No visual attributes to reject.") };
  }
  return { data: rowToVisualStyleAttributes(result.data), error: null };
}

/** Mark existing visual row stale when the primary image changes. */
export async function markVisualAttributesStaleOnPrimaryChange(
  itemId: string,
  newImageId: string,
): Promise<Result<VisualStyleAttributes>> {
  const existing = await selectVisualAttributesByItemId(itemId);
  if (existing.error) return { data: null, error: existing.error };
  if (!existing.data) return { data: null, error: null };
  if (existing.data.image_id === newImageId) {
    return { data: rowToVisualStyleAttributes(existing.data), error: null };
  }
  const result = await updateVisualAttributesStatus(itemId, "stale");
  if (result.error) return { data: null, error: result.error };
  if (!result.data) return { data: null, error: null };
  return { data: rowToVisualStyleAttributes(result.data), error: null };
}

export async function listVisualBackfillCandidates(limit = 40): Promise<
  Result<{ itemId: string; name: string; imageId: string }[]>
> {
  const result = await selectBackfillCandidates(limit);
  if (result.error) return { data: null, error: result.error };
  return {
    data: (result.data ?? []).map((r) => ({
      itemId: r.item_id,
      name: r.name,
      imageId: r.image_id,
    })),
    error: null,
  };
}

/** Run Analyze for many items; never auto-accepts. */
export async function backfillVisualAnalysis(
  itemIds: string[],
): Promise<
  Result<{ ok: string[]; failed: { itemId: string; message: string }[] }>
> {
  const ok: string[] = [];
  const failed: { itemId: string; message: string }[] = [];
  for (const itemId of itemIds) {
    const result = await analyzeItemPrimaryImage(itemId);
    if (result.error || !result.data) {
      failed.push({
        itemId,
        message: result.error?.message ?? "Analyze failed",
      });
    } else {
      ok.push(itemId);
    }
  }
  return { data: { ok, failed }, error: null };
}

export function buildVisualDiffForItem(
  manual: StyleDNAItem,
  visual: VisualStyleAttributes | null,
) {
  return visualManualDiff(manual, visual);
}

export function enrichStyleDNAItemWithAcceptedVisual(
  manual: StyleDNAItem,
  visual: VisualStyleAttributes | null,
): StyleDNAItem {
  return mergeVisualIntoStyleDNAItem({ manual, visual });
}
