/**
 * Vision metadata helpers (RFC-002). Pure — a dependency-free content hash (no
 * node:crypto, so it is bundle-safe) plus the metadata builder + engine version.
 */

import type {
  VisionImageInput,
  VisionMetadata,
} from "@/domain/vision/VisionAnalysis";

export const VISION_ENGINE_VERSION = "1.0.0";

/**
 * FNV-1a (32-bit) rendered as 8 hex chars, combined with a second offset-basis
 * pass for a 64-bit key. Deterministic content hash of the (preprocessed) image
 * bytes — used for caching/idempotency. Same bytes ⇒ same hash.
 */
export function computeImageHash(input: VisionImageInput): string {
  const material = `${input.mimeType}:${input.data}`;
  const fnv = (seed: number): number => {
    let h = seed >>> 0;
    for (let i = 0; i < material.length; i++) {
      h ^= material.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  };
  const a = fnv(0x811c9dc5);
  const b = fnv(0x811c9dc5 ^ 0x9e3779b9);
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

export function buildVisionMetadata(params: {
  provider: string;
  model: string;
  generatedAt: string;
  latencyMs: number | null;
  input: VisionImageInput;
}): VisionMetadata {
  return {
    engineVersion: VISION_ENGINE_VERSION,
    provider: params.provider,
    model: params.model,
    generatedAt: params.generatedAt,
    latencyMs: params.latencyMs,
    sourceType: params.input.source,
    imageHash: computeImageHash(params.input),
    // embeddings: reserved for future use — intentionally omitted.
  };
}
