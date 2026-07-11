/**
 * Inventory Image Intelligence (RFC-020) — domain types.
 * Vision-derived attributes stored separately from manual wardrobe fields.
 * Pure TypeScript; no I/O.
 */

import type { ColorObservation } from "@/domain/vision";

export type VisualAttributeStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "stale";

export interface VisualStyleAttributes {
  itemId: string;
  imageId: string;
  visionSummary: unknown | null;
  dominantColors: ColorObservation[];
  secondaryColors: ColorObservation[];
  pattern: string | null;
  texture: string | null;
  materialGuess: string | null;
  silhouette: string | null;
  formalityGuess: string | null;
  styleTags: string[];
  /** 0–1 overall visual confidence. */
  confidence: number;
  status: VisualAttributeStatus;
}

/** Floor below which accepted attrs contribute nothing to StyleDNA merge. */
export const VISUAL_CONFIDENCE_THRESHOLD = 0.5;

export const VISUAL_ATTRIBUTE_STATUSES: VisualAttributeStatus[] = [
  "pending",
  "accepted",
  "rejected",
  "stale",
];
