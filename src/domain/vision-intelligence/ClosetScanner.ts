/**
 * ClosetScanner (RFC-019) — classify Vision detections against inventory into
 * new / possible_match / duplicate and seed a review queue. Never writes.
 */

import {
  DUPLICATE_SIMILARITY_THRESHOLD,
  MIN_DETECTION_CONFIDENCE,
  POSSIBLE_MATCH_SIMILARITY_THRESHOLD,
} from "@/domain/vision-intelligence/constants";
import { analyzeVisualDuplicates } from "@/domain/vision-intelligence/DuplicateVision";
import { makeReviewId } from "@/domain/vision-intelligence/ReviewQueue";
import type {
  ClosetDetection,
  ClosetScanResult,
  ReviewQueueItem,
  VisionInventoryItem,
} from "@/domain/vision-intelligence/types";
import { rankInventoryMatches } from "@/domain/vision-intelligence/visualSimilarity";
import type { VisionAnalysis } from "@/domain/vision";

function classifyKind(
  similarity: number,
): ClosetDetection["kind"] {
  if (similarity >= DUPLICATE_SIMILARITY_THRESHOLD) return "duplicate";
  if (similarity >= POSSIBLE_MATCH_SIMILARITY_THRESHOLD) return "possible_match";
  return "new";
}

export function runClosetScan(
  analysis: VisionAnalysis,
  inventory: VisionInventoryItem[],
): ClosetScanResult {
  const detections: ClosetDetection[] = [];
  const reviewItems: ReviewQueueItem[] = [];

  analysis.detectedItems.forEach((detection, detectionIndex) => {
    if (detection.confidence < MIN_DETECTION_CONFIDENCE) return;

    const ranked = rankInventoryMatches(detection, inventory).slice(0, 5);
    const best = ranked[0] ?? null;
    const kind = classifyKind(best?.similarity ?? 0);
    const color =
      detection.styleDNACandidate.color ?? detection.colors[0]?.name ?? null;

    detections.push({
      detectionIndex,
      label: detection.label,
      category: detection.category,
      color,
      confidence: detection.confidence,
      kind,
      bestMatch: best
        ? {
            itemId: best.item.id,
            name: best.item.name,
            similarity: best.similarity,
          }
        : null,
      matches: ranked.map((m) => ({
        itemId: m.item.id,
        name: m.item.name,
        similarity: m.similarity,
      })),
    });

    if (kind === "new") {
      reviewItems.push({
        id: makeReviewId("add", detectionIndex),
        kind: "add_item",
        label: `Add “${detection.label}”`,
        detail: detection.category
          ? `Detected as ${detection.category}`
          : "New closet detection",
        confidence: detection.confidence,
        status: "pending",
        detectionIndex,
        matchedItemId: null,
        suggestedName: detection.styleDNACandidate.name ?? detection.label,
        suggestedCategory: detection.category,
      });
    } else if (kind === "possible_match" && best) {
      reviewItems.push({
        id: makeReviewId("match", detectionIndex, best.item.id),
        kind: "skip",
        label: `Review match: ${detection.label}`,
        detail: `May already be “${best.item.name}” (${Math.round(best.similarity * 100)}%)`,
        confidence: detection.confidence,
        status: "pending",
        detectionIndex,
        matchedItemId: best.item.id,
        suggestedName: detection.label,
        suggestedCategory: detection.category,
      });
    }
  });

  const dup = analyzeVisualDuplicates(analysis, inventory);
  // Prefer closet-specific add/match items; append duplicate flags not already covered.
  const existing = new Set(reviewItems.map((r) => r.id));
  for (const item of dup.reviewItems) {
    if (!existing.has(item.id)) reviewItems.push(item);
  }

  return {
    detections,
    newCount: detections.filter((d) => d.kind === "new").length,
    possibleMatchCount: detections.filter((d) => d.kind === "possible_match").length,
    duplicateCount: detections.filter((d) => d.kind === "duplicate").length,
    analysisConfidence: analysis.confidence,
    analysisQuality: analysis.quality,
    reviewItems,
  };
}
