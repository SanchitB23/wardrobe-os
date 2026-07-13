/**
 * Vision provider with primary → fallback (RFC-029). Runs the primary; on ANY
 * error, if the fallback is available (key present + budget), runs the fallback.
 * Keeps vision out of the AI Runtime router while giving the Buy-vs-Skip
 * screenshot flow resilience when Gemini is rate-limited. The served provider is
 * named in the returned RawVisionResult.provider, which the /api/ai/vision route
 * logs as ai_usage.
 */

import {
  VisionError,
  type VisionCapabilities,
  type VisionProvider,
  type VisionProviderId,
} from "@/domain/vision";
import type { RawVisionResult, VisionImageInput } from "@/domain/vision";

export interface FallbackVisionProviderConfig {
  primary: VisionProvider;
  fallback?: VisionProvider;
  /** Gate the fallback (e.g. OpenAI budget hard-stop). Defaults to always-available. */
  isFallbackAvailable?: () => boolean;
}

export class FallbackVisionProvider implements VisionProvider {
  readonly id: VisionProviderId;
  readonly capabilities: VisionCapabilities;
  private readonly config: FallbackVisionProviderConfig;

  constructor(config: FallbackVisionProviderConfig) {
    this.config = config;
    this.id = config.primary.id;
    this.capabilities = config.primary.capabilities;
  }

  async analyze(input: VisionImageInput): Promise<RawVisionResult> {
    const { primary, fallback, isFallbackAvailable } = this.config;
    try {
      return await primary.analyze(input);
    } catch (primaryError) {
      const available = isFallbackAvailable ? isFallbackAvailable() : true;
      if (!fallback || !available) throw primaryError;
      try {
        return await fallback.analyze(input);
      } catch (fallbackError) {
        const pMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
        const fMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new VisionError(
          "provider_error",
          `All vision providers failed — ${primary.id}: ${pMsg} | ${fallback.id}: ${fMsg}`,
          { cause: fallbackError },
        );
      }
    }
  }
}
