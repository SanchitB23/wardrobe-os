/**
 * Deterministic confidence + quality scoring for the Vision Engine (RFC-002).
 * Pure — no I/O. Both the numeric confidence and the derived band are returned
 * so consumers can gate precisely or show a friendly label.
 */

import type { DetectedItem, VisionQuality } from "@/domain/vision/VisionAnalysis";

/** RFC-002 §3 quality bands. */
export const QUALITY_THRESHOLDS = {
  fair: 0.4,
  good: 0.65,
  excellent: 0.85,
} as const;

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function qualityFromConfidence(confidence: number): VisionQuality {
  const c = clamp01(confidence);
  if (c >= QUALITY_THRESHOLDS.excellent) return "excellent";
  if (c >= QUALITY_THRESHOLDS.good) return "good";
  if (c >= QUALITY_THRESHOLDS.fair) return "fair";
  return "poor";
}

/**
 * Overall confidence = mean of detected-item confidences, lightly penalised
 * when nothing was detected. Deterministic.
 */
export function aggregateConfidence(items: DetectedItem[]): number {
  if (items.length === 0) return 0.15;
  const sum = items.reduce((acc, item) => acc + clamp01(item.confidence), 0);
  return round2(sum / items.length);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
