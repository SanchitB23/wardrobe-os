/**
 * OutfitRecognition (RFC-019) — propose inventory matches for a selfie /
 * outfit photo. Wear logs are created only after the user confirms in the UI.
 */

import {
  MIN_DETECTION_CONFIDENCE,
  OUTFIT_MATCH_SIMILARITY_THRESHOLD,
} from "@/domain/vision-intelligence/constants";
import { makeReviewId } from "@/domain/vision-intelligence/ReviewQueue";
import type {
  DetectedOutfit,
  OutfitPieceProposal,
  ReviewQueueItem,
  VisionInventoryItem,
} from "@/domain/vision-intelligence/types";
import { rankInventoryMatches } from "@/domain/vision-intelligence/visualSimilarity";
import type { VisionAnalysis } from "@/domain/vision";

export function recognizeOutfit(
  analysis: VisionAnalysis,
  inventory: VisionInventoryItem[],
): DetectedOutfit {
  const pieces: OutfitPieceProposal[] = [];
  const reviewItems: ReviewQueueItem[] = [];
  const usedItemIds = new Set<string>();

  analysis.detectedItems.forEach((detection, detectionIndex) => {
    if (detection.confidence < MIN_DETECTION_CONFIDENCE) return;

    const ranked = rankInventoryMatches(detection, inventory).filter(
      (m) => !usedItemIds.has(m.item.id),
    );
    const best =
      ranked.find((m) => m.similarity >= OUTFIT_MATCH_SIMILARITY_THRESHOLD) ?? null;

    if (best) usedItemIds.add(best.item.id);

    const piece: OutfitPieceProposal = {
      detectionIndex,
      label: detection.label,
      slot: detection.slot ?? detection.styleDNACandidate.slot,
      confidence: detection.confidence,
      proposedItemId: best?.item.id ?? null,
      proposedItemName: best?.item.name ?? null,
      similarity: best?.similarity ?? 0,
    };
    pieces.push(piece);

    if (best) {
      reviewItems.push({
        id: makeReviewId("wear", detectionIndex, best.item.id),
        kind: "log_wear",
        label: `Log wear: ${best.item.name}`,
        detail: `Matched from “${detection.label}” (${Math.round(best.similarity * 100)}%)`,
        confidence: detection.confidence,
        status: "pending",
        detectionIndex,
        matchedItemId: best.item.id,
        suggestedName: best.item.name,
        suggestedCategory: detection.category,
      });
    } else {
      reviewItems.push({
        id: makeReviewId("wear-unmatched", detectionIndex),
        kind: "skip",
        label: `Unmatched: ${detection.label}`,
        detail: "No strong inventory match — pick manually or dismiss",
        confidence: detection.confidence,
        status: "pending",
        detectionIndex,
        matchedItemId: null,
        suggestedName: detection.label,
        suggestedCategory: detection.category,
      });
    }
  });

  const matchedCount = pieces.filter((p) => p.proposedItemId).length;
  const confidences = pieces.map((p) => p.confidence);
  const overallConfidence =
    confidences.length === 0
      ? 0
      : confidences.reduce((a, b) => a + b, 0) / confidences.length;

  return {
    pieces,
    overallConfidence: Math.round(overallConfidence * 1000) / 1000,
    matchedCount,
    unmatchedCount: pieces.length - matchedCount,
    reviewItems,
  };
}
