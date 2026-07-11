/**
 * InventoryImageAnalyzer (RFC-020) — pure.
 * Maps VisionAnalysis → VisualStyleAttributes for a single inventory primary image.
 * Does not call Vision, Supabase, or AI. Deterministic given fixed analysis.
 */

import type { VisionAnalysis } from "@/domain/vision";
import type { VisualStyleAttributes } from "@/domain/inventory-image-intelligence/types";

export interface AnalyzeInventoryImageOptions {
  itemId: string;
  imageId: string;
  /** Prefer a detected-item index (default: 0 = highest confidence). */
  preferItemIndex?: number;
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.max(0, Math.min(length - 1, Math.floor(index)));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Interpret a VisionAnalysis into durable visual style attributes (status=pending).
 */
export function analyzeInventoryImage(
  analysis: VisionAnalysis,
  opts: AnalyzeInventoryImageOptions,
): VisualStyleAttributes {
  const items = analysis.detectedItems;
  const index = clampIndex(opts.preferItemIndex ?? 0, items.length);
  const primary = items[index] ?? null;
  const dna = primary?.styleDNACandidate ?? analysis.styleDNACandidates[0] ?? null;

  const colors = primary?.colors?.length
    ? primary.colors
    : analysis.dominantColors;
  const dominantColors = colors.slice(0, 2);
  const secondaryColors = colors.slice(2, 5);

  const pattern =
    primary?.pattern ?? dna?.pattern ?? analysis.pattern ?? null;
  const texture =
    primary?.texture ?? dna?.texture ?? analysis.texture ?? null;
  const materialGuess =
    primary?.material ?? dna?.material ?? analysis.material ?? null;
  const formalityGuess = dna?.formality ?? null;
  const styleTags = [
    ...new Set([
      ...(dna?.styleTags ?? []),
      ...(pattern ? [`pattern:${pattern}`] : []),
      ...(texture ? [`texture:${texture}`] : []),
    ]),
  ];

  // Silhouette: prefer subcategory / slot as a soft cue when present.
  const silhouette =
    dna?.subcategory ?? dna?.slot ?? primary?.slot ?? null;

  const confidence = clamp01(
    primary?.confidence ?? dna?.confidence ?? analysis.confidence,
  );

  return {
    itemId: opts.itemId,
    imageId: opts.imageId,
    visionSummary: {
      imageHash: analysis.metadata.imageHash,
      provider: analysis.metadata.provider,
      model: analysis.metadata.model,
      quality: analysis.quality,
      sourceType: analysis.sourceType,
      detectedLabel: primary?.label ?? null,
      detectedCount: items.length,
    },
    dominantColors,
    secondaryColors,
    pattern,
    texture,
    materialGuess,
    silhouette,
    formalityGuess,
    styleTags,
    confidence,
    status: "pending",
  };
}
