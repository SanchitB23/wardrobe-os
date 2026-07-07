/**
 * VisionEngine (RFC-002) — runs the fixed pipeline
 * Preprocess → Provider → Normalize → Validate → VisionAnalysis.
 *
 * The provider is INJECTED (a {@link VisionProvider}), so this stays free of any
 * SDK/network and is deterministic given a deterministic provider. Preprocess
 * (validation + imageHash) and Normalize/Validate are pure; only the provider
 * step calls a model.
 */

import { normalizeVision } from "@/domain/vision/VisionNormalizer";
import { VisionError, type VisionProvider } from "@/domain/vision/VisionProvider";
import type { VisionAnalysis, VisionImageInput } from "@/domain/vision/VisionAnalysis";

const ALLOWED_MIME = /^image\/(png|jpe?g|webp|gif|heic|heif)$/i;

export interface VisionEngineOptions {
  provider: VisionProvider;
  /** Injected timestamp for deterministic metadata. */
  generatedAt?: string;
  /** Injectable clock for latency measurement (tests pass a stub). */
  now?: () => number;
}

/** Preprocess: validate the input before spending a provider call. */
function preprocess(input: VisionImageInput): void {
  if (!input || !input.data || !input.data.trim()) {
    throw new VisionError("invalid_input", "No image data provided.");
  }
  if (input.kind === "base64" && !ALLOWED_MIME.test(input.mimeType)) {
    throw new VisionError("invalid_input", `Unsupported image type: ${input.mimeType}`);
  }
  if (input.kind === "url" && !/^https?:\/\//.test(input.data)) {
    throw new VisionError("invalid_input", "Image URL must be http(s).");
  }
}

export async function analyzeImage(
  input: VisionImageInput,
  options: VisionEngineOptions,
): Promise<VisionAnalysis> {
  const now = options.now ?? (() => Date.now());
  preprocess(input);

  const started = now();
  let raw;
  try {
    raw = await options.provider.analyze(input);
  } catch (error) {
    if (error instanceof VisionError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new VisionError("provider_error", `Vision provider failed: ${message}`, { cause: error });
  }
  const latencyMs = Math.round(now() - started);

  return normalizeVision(raw, input, { generatedAt: options.generatedAt, latencyMs });
}
