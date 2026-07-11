/**
 * Vision Intelligence v2 (RFC-019) — pure types.
 * Vision detects (RFC-002); these shapes describe workflows + review actions.
 */

import type { DetectedItem, VisionAnalysis, VisionQuality } from "@/domain/vision";

/** Minimal inventory row for matching — no I/O, no Supabase types. */
export interface VisionInventoryItem {
  id: string;
  name: string;
  category: string | null;
  color: string | null;
  formality?: string | null;
  material?: string | null;
}

export type ClosetDetectionKind = "new" | "possible_match" | "duplicate";

export interface ClosetDetectionMatch {
  itemId: string;
  name: string;
  similarity: number;
}

export interface ClosetDetection {
  detectionIndex: number;
  label: string;
  category: string | null;
  color: string | null;
  confidence: number;
  kind: ClosetDetectionKind;
  bestMatch: ClosetDetectionMatch | null;
  matches: ClosetDetectionMatch[];
}

export interface ClosetScanResult {
  detections: ClosetDetection[];
  newCount: number;
  possibleMatchCount: number;
  duplicateCount: number;
  analysisConfidence: number;
  analysisQuality: VisionQuality;
  /** Seeds for the review queue (still pending). */
  reviewItems: ReviewQueueItem[];
}

export interface OutfitPieceProposal {
  detectionIndex: number;
  label: string;
  slot: string | null;
  confidence: number;
  proposedItemId: string | null;
  proposedItemName: string | null;
  similarity: number;
}

export interface DetectedOutfit {
  pieces: OutfitPieceProposal[];
  overallConfidence: number;
  matchedCount: number;
  unmatchedCount: number;
  reviewItems: ReviewQueueItem[];
}

export interface VisualDuplicateHit {
  detectionIndex: number;
  label: string;
  itemId: string;
  itemName: string;
  similarity: number;
}

export interface VisualDuplicateAnalysis {
  hits: VisualDuplicateHit[];
  warningCount: number;
  reviewItems: ReviewQueueItem[];
}

export type ReviewActionKind = "add_item" | "log_wear" | "flag_duplicate" | "skip";

export type ReviewItemStatus = "pending" | "confirmed" | "dismissed";

export interface ReviewQueueItem {
  id: string;
  kind: ReviewActionKind;
  label: string;
  detail: string | null;
  confidence: number;
  status: ReviewItemStatus;
  detectionIndex: number;
  matchedItemId: string | null;
  /** Suggested display name / category for add flows. */
  suggestedName: string | null;
  suggestedCategory: string | null;
}

export interface ReviewQueue {
  items: ReviewQueueItem[];
  pendingCount: number;
  confirmedCount: number;
  dismissedCount: number;
}

export interface VisionIntelligenceInput {
  analysis: VisionAnalysis;
  inventory: VisionInventoryItem[];
}

/** Re-export DetectedItem for consumers that only import this package. */
export type { DetectedItem, VisionAnalysis };
