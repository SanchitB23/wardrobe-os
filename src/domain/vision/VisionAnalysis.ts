/**
 * Vision Engine output types (RFC-002). The Vision Engine turns any image into
 * ONE standardized {@link VisionAnalysis}; everything downstream consumes it.
 *
 * Pure type definitions. "Vision observes, domain interprets, AI explains" —
 * these shapes describe observations + confidence, never decisions.
 */

import type { StyleDNACandidate } from "@/domain/vision/StyleDNACandidate";

/** Where the image came from. Open union — new sources need no type edit. */
export type VisionSource =
  | "camera"
  | "gallery"
  | "shopping_screenshot"
  | "myntra"
  | "amazon"
  | "pinterest"
  | "closet_photo"
  | "outfit_selfie"
  | (string & {});

export interface VisionImageInput {
  kind: "url" | "base64";
  data: string;
  mimeType: string;
  source: VisionSource;
}

export interface ColorObservation {
  name: string | null;
  family: string | null;
  hex: string | null;
  /** 0–100 approximate coverage of the garment. */
  coveragePct: number | null;
  confidence: number;
}

export interface Segmentation {
  boundingBox?: { x: number; y: number; width: number; height: number };
  /** Optional polygon/mask when the provider supports it. */
  polygon?: { x: number; y: number }[] | null;
}

export interface DetectedItem {
  label: string;
  category: string | null;
  slot: string | null;
  colors: ColorObservation[];
  material: string | null;
  texture: string | null;
  pattern: string | null;
  brandGuess: string | null;
  segmentation: Segmentation | null;
  styleDNACandidate: StyleDNACandidate;
  confidence: number;
}

/** Raw, provider-shaped result (pre-normalization). Opaque to consumers. */
export interface RawVisionResult {
  provider: string;
  model: string;
  /** Provider-specific detected entries; the normalizer interprets these. */
  items: RawDetectedItem[];
  raw?: unknown;
  usage?: { totalTokens?: number };
}

/** The loosely-typed shape a provider is expected to emit per detection. */
export interface RawDetectedItem {
  label?: string;
  category?: string | null;
  colors?: { name?: string | null; hex?: string | null; coveragePct?: number | null }[];
  material?: string | null;
  texture?: string | null;
  pattern?: string | null;
  brand?: string | null;
  formality?: string | null;
  styleTags?: string[];
  boundingBox?: { x: number; y: number; width: number; height: number } | null;
  confidence?: number | null;
}

/** Human-friendly band derived deterministically from numeric confidence. */
export type VisionQuality = "poor" | "fair" | "good" | "excellent";

export interface VisionMetadata {
  engineVersion: string;
  provider: string;
  model: string;
  generatedAt: string;
  latencyMs: number | null;
  sourceType: VisionSource;
  /** Stable content hash of the preprocessed image (caching / idempotency). */
  imageHash: string;
  /**
   * RESERVED — FUTURE USE ONLY. A vector embedding for similarity search.
   * Not populated in RFC-002; declared for forward-compatibility.
   */
  embeddings?: number[] | null;
}

/** THE standardized output. Everything downstream consumes this. */
export interface VisionAnalysis {
  sourceType: VisionSource;
  detectedItems: DetectedItem[];
  dominantColors: ColorObservation[];
  /** Aggregate cues (most useful for single-item images). */
  material: string | null;
  texture: string | null;
  pattern: string | null;
  brand: string | null;
  styleDNACandidates: StyleDNACandidate[];
  /** 0–1 overall confidence. */
  confidence: number;
  /** Band derived from `confidence`. */
  quality: VisionQuality;
  segmentation: Segmentation[] | null;
  metadata: VisionMetadata;
}
