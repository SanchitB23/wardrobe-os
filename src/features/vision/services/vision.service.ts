/**
 * Vision Intelligence service (RFC-019) — orchestrates Vision Engine + inventory
 * + pure domain workflows. Never auto-writes inventory or wear logs.
 */

import type { VisionAnalysis, VisionSource } from "@/domain/vision";
import {
  analyzeVisualDuplicates,
  buildReviewQueue,
  mergeReviewQueues,
  recognizeOutfit,
  runClosetScan,
  type VisionInventoryItem,
} from "@/domain/vision-intelligence";
import { loadAcquisitionContext } from "@/features/acquisition/services/acquisition.service";
import {
  analyzeImageRequest,
  fileToBase64,
} from "@/features/vision/vision.client";
import type { VisionScanMode, VisionScanSession } from "@/features/vision/types";
import { toError } from "@/shared/utils/data-result";

type Result<T> = { data: T | null; error: Error | null };

async function loadInventory(): Promise<Result<VisionInventoryItem[]>> {
  const ctx = await loadAcquisitionContext();
  if (ctx.error || !ctx.data) {
    return { data: null, error: ctx.error ?? toError("Wardrobe data unavailable.") };
  }
  const inventory: VisionInventoryItem[] = ctx.data.wardrobe.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category ?? null,
    color: item.color ?? null,
    formality: item.formality ?? null,
    material: null,
  }));
  return { data: inventory, error: null };
}

export async function analyzeVisionFile(input: {
  file: File;
  source: VisionSource;
}): Promise<Result<VisionAnalysis>> {
  try {
    const { base64, mimeType } = await fileToBase64(input.file);
    const analysis = await analyzeImageRequest({
      imageBase64: base64,
      mimeType,
      source: input.source,
    });
    return { data: analysis, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : toError("Vision analysis failed."),
    };
  }
}

export async function runVisionIntelligence(input: {
  file: File;
  mode: VisionScanMode;
}): Promise<Result<VisionScanSession>> {
  const source: VisionSource = input.mode === "outfit" ? "outfit_selfie" : "closet_photo";
  const analysisResult = await analyzeVisionFile({ file: input.file, source });
  if (analysisResult.error || !analysisResult.data) {
    return { data: null, error: analysisResult.error };
  }

  const inventoryResult = await loadInventory();
  if (inventoryResult.error || !inventoryResult.data) {
    return { data: null, error: inventoryResult.error };
  }

  const analysis = analysisResult.data;
  const inventory = inventoryResult.data;
  const duplicates = analyzeVisualDuplicates(analysis, inventory);

  if (input.mode === "closet") {
    const closetScan = runClosetScan(analysis, inventory);
    const queue = buildReviewQueue(closetScan.reviewItems);
    return {
      data: {
        mode: "closet",
        analysis,
        closetScan,
        outfit: null,
        duplicates,
        queue,
        createdAt: new Date().toISOString(),
      },
      error: null,
    };
  }

  const outfit = recognizeOutfit(analysis, inventory);
  const queue = mergeReviewQueues(
    buildReviewQueue(outfit.reviewItems),
    buildReviewQueue(duplicates.reviewItems),
  );
  return {
    data: {
      mode: "outfit",
      analysis,
      closetScan: null,
      outfit,
      duplicates,
      queue,
      createdAt: new Date().toISOString(),
    },
    error: null,
  };
}

/** Debug helper — analysis + duplicates without a file (injected analysis). */
export async function debugVisionIntelligence(
  analysis: VisionAnalysis,
): Promise<Result<VisionScanSession>> {
  const inventoryResult = await loadInventory();
  if (inventoryResult.error || !inventoryResult.data) {
    return { data: null, error: inventoryResult.error };
  }
  const inventory = inventoryResult.data;
  const closetScan = runClosetScan(analysis, inventory);
  const outfit = recognizeOutfit(analysis, inventory);
  const duplicates = analyzeVisualDuplicates(analysis, inventory);
  const queue = mergeReviewQueues(
    buildReviewQueue(closetScan.reviewItems),
    buildReviewQueue(outfit.reviewItems),
  );
  return {
    data: {
      mode: "closet",
      analysis,
      closetScan,
      outfit,
      duplicates,
      queue,
      createdAt: new Date().toISOString(),
    },
    error: null,
  };
}
