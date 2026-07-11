/**
 * Vision Intelligence feature types (RFC-019).
 */

import type { VisionAnalysis } from "@/domain/vision";
import type {
  ClosetScanResult,
  DetectedOutfit,
  ReviewQueue,
  VisualDuplicateAnalysis,
} from "@/domain/vision-intelligence";

export type VisionScanMode = "closet" | "outfit";

export interface VisionScanSession {
  mode: VisionScanMode;
  analysis: VisionAnalysis;
  closetScan: ClosetScanResult | null;
  outfit: DetectedOutfit | null;
  duplicates: VisualDuplicateAnalysis | null;
  queue: ReviewQueue;
  createdAt: string;
}

export type {
  ClosetScanResult,
  DetectedOutfit,
  ReviewQueue,
  VisualDuplicateAnalysis,
};
