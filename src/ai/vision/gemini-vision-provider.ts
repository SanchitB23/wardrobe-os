/**
 * Gemini implementation of the domain {@link VisionProvider} (RFC-002).
 * Server-side only; lazy `@google/genai`; key from `GEMINI_API_KEY` (never
 * bundled to the browser). It performs AI-assisted extraction ONLY — it asks
 * the model to describe garments as structured JSON and returns a
 * `RawVisionResult`. All normalization/decisions happen in the pure domain
 * layer. SDK lives here (AI layer), not in `src/domain`.
 */

import {
  VisionError,
  type VisionCapabilities,
  type VisionProvider,
  type VisionProviderId,
} from "@/domain/vision";
import type { RawVisionResult, VisionImageInput } from "@/domain/vision";

import { parseVisionItems } from "@/ai/vision/parse-vision-items";

const DEFAULT_VISION_MODEL = "gemini-2.5-flash";

const EXTRACTION_PROMPT = [
  "You are a garment detector. Look at the image and list each clothing item, footwear, or accessory you can see.",
  "Return ONLY JSON of the form:",
  '{"items":[{"label":string,"category":string,"colors":[{"name":string,"coveragePct":number}],"material":string|null,"texture":string|null,"pattern":string|null,"brand":string|null,"formality":string|null,"confidence":number}]}',
  "confidence is 0..1. Describe only what is visible; do not invent brands — set brand to null if unsure. No prose, no code fences.",
].join(" ");

interface GeminiVisionResponse {
  text?: string;
}
interface GeminiVisionClient {
  models: {
    generateContent(params: {
      model: string;
      contents: unknown;
      config?: { responseMimeType?: string; temperature?: number };
    }): Promise<GeminiVisionResponse>;
  };
}

export interface GeminiVisionProviderConfig {
  apiKey?: string;
  model?: string;
  client?: GeminiVisionClient;
}

/** Heuristic: is this a transient provider error worth one retry? (RFC-009/N17a) */
function isTransientVisionError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("500") ||
    message.includes("503") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("unavailable") ||
    message.includes("overloaded")
  );
}

export class GeminiVisionProvider implements VisionProvider {
  readonly id: VisionProviderId = "gemini";
  readonly capabilities: VisionCapabilities = {
    multiItem: true,
    segmentation: false, // Gemini returns labels/colours, not reliable boxes here
    brandHints: true,
  };

  private readonly config: GeminiVisionProviderConfig;
  private cachedClient?: GeminiVisionClient;

  constructor(config: GeminiVisionProviderConfig = {}) {
    this.config = config;
  }

  async analyze(input: VisionImageInput): Promise<RawVisionResult> {
    if (typeof window !== "undefined") {
      throw new VisionError("provider_error", "GeminiVisionProvider must run server-side only.");
    }
    const client = await this.getClient();
    const model = this.config.model ?? process.env.GEMINI_MODEL ?? DEFAULT_VISION_MODEL;

    const imagePart =
      input.kind === "base64"
        ? { inlineData: { mimeType: input.mimeType, data: input.data } }
        : { fileData: { mimeType: input.mimeType, fileUri: input.data } };

    // Resilience (RFC-009/N17a): retry once on a transient provider error,
    // mirroring GeminiProvider.generate().
    const call = () =>
      client.models.generateContent({
        model,
        contents: [{ role: "user", parts: [{ text: EXTRACTION_PROMPT }, imagePart] }],
        config: { responseMimeType: "application/json", temperature: 0 },
      });
    let response;
    try {
      response = await call();
    } catch (error) {
      if (!isTransientVisionError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400));
      response = await call();
    }

    return {
      provider: this.id,
      model,
      items: parseVisionItems(response.text),
      raw: response,
    };
  }

  private async getClient(): Promise<GeminiVisionClient> {
    if (this.config.client) return this.config.client;
    if (this.cachedClient) return this.cachedClient;
    const apiKey = this.config.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new VisionError("provider_error", "GEMINI_API_KEY is not set (server-side only).");
    }
    const { GoogleGenAI } = await import("@google/genai");
    this.cachedClient = new GoogleGenAI({ apiKey }) as unknown as GeminiVisionClient;
    return this.cachedClient;
  }
}
