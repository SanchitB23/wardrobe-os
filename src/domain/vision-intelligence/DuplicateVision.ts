/**
 * DuplicateVision (RFC-019) — visual/attribute duplicate warnings from a
 * VisionAnalysis vs inventory. Distinct from Buy vs Skip metadata duplicates
 * and Shopping Intelligence wishlist duplicates.
 */

import {
  DUPLICATE_SIMILARITY_THRESHOLD,
  MIN_DETECTION_CONFIDENCE,
} from "@/domain/vision-intelligence/constants";
import { makeReviewId } from "@/domain/vision-intelligence/ReviewQueue";
import type {
  ReviewQueueItem,
  VisionInventoryItem,
  VisualDuplicateAnalysis,
  VisualDuplicateHit,
} from "@/domain/vision-intelligence/types";
import { rankInventoryMatches } from "@/domain/vision-intelligence/visualSimilarity";
import type { VisionAnalysis } from "@/domain/vision";

export function analyzeVisualDuplicates(
  analysis: VisionAnalysis,
  inventory: VisionInventoryItem[],
): VisualDuplicateAnalysis {
  const hits: VisualDuplicateHit[] = [];
  const reviewItems: ReviewQueueItem[] = [];

  analysis.detectedItems.forEach((detection, detectionIndex) => {
    if (detection.confidence < MIN_DETECTION_CONFIDENCE) return;
    const ranked = rankInventoryMatches(detection, inventory);
    for (const match of ranked) {
      if (match.similarity < DUPLICATE_SIMILARITY_THRESHOLD) break;
      hits.push({
        detectionIndex,
        label: detection.label,
        itemId: match.item.id,
        itemName: match.item.name,
        similarity: match.similarity,
      });
      reviewItems.push({
        id: makeReviewId("dup", detectionIndex, match.item.id),
        kind: "flag_duplicate",
        label: `Possible duplicate: ${detection.label}`,
        detail: `Similar to “${match.item.name}” (${Math.round(match.similarity * 100)}%)`,
        confidence: detection.confidence,
        status: "pending",
        detectionIndex,
        matchedItemId: match.item.id,
        suggestedName: detection.styleDNACandidate.name ?? detection.label,
        suggestedCategory: detection.category,
      });
    }
  });

  return { hits, warningCount: hits.length, reviewItems };
}
