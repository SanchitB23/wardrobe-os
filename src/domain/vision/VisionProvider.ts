/**
 * Vision provider abstraction (RFC-002), mirroring the AI provider abstraction
 * (ADR-004). A provider does AI-assisted extraction ONLY — it returns raw
 * perception ({@link RawVisionResult}); it makes no product decision. Concrete
 * providers (Gemini, later OpenAI/Claude/Local) implement this interface behind
 * the same contract, so the engine is provider-agnostic.
 *
 * The interface + error types are pure (no SDK). Concrete SDK-backed providers
 * live outside the domain (e.g. src/ai/vision) and are injected into the engine.
 */

import type { RawVisionResult, VisionImageInput } from "@/domain/vision/VisionAnalysis";

export type VisionProviderId = "gemini" | "openai" | "claude" | "local" | (string & {});

export interface VisionCapabilities {
  /** Can detect multiple garments in one image. */
  multiItem: boolean;
  /** Returns bounding boxes / masks. */
  segmentation: boolean;
  /** Attempts brand identification (always low-confidence). */
  brandHints: boolean;
}

export interface VisionProvider {
  readonly id: VisionProviderId;
  readonly capabilities: VisionCapabilities;
  analyze(input: VisionImageInput): Promise<RawVisionResult>;
}

export type VisionErrorCode =
  | "not_implemented"
  | "provider_error"
  | "invalid_input"
  | "no_provider";

export class VisionError extends Error {
  readonly code: VisionErrorCode;
  readonly cause?: unknown;
  constructor(code: VisionErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "VisionError";
    this.code = code;
    this.cause = options.cause;
  }
}

/** Thrown by provider stubs until a real SDK implementation is wired in. */
export class VisionNotImplementedError extends VisionError {
  constructor(provider: string) {
    super(
      "not_implemented",
      `${provider} vision provider is not implemented yet — see docs/rfc/RFC-002-Vision-Engine.md.`,
    );
    this.name = "VisionNotImplementedError";
  }
}

/**
 * Base for provider stubs. `analyze` throws until a real SDK is wired in. No
 * SDK imports, no network — keeps future providers (OpenAI/Claude/Local) as
 * cheap, honest placeholders.
 */
export abstract class StubVisionProvider implements VisionProvider {
  abstract readonly id: VisionProviderId;
  abstract readonly capabilities: VisionCapabilities;
  async analyze(input: VisionImageInput): Promise<RawVisionResult> {
    void input;
    throw new VisionNotImplementedError(this.id);
  }
}
