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
import type {
  RawDetectedItem,
  RawVisionResult,
  VisionImageInput,
} from "@/domain/vision";

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

function parseItems(text: string | undefined): RawDetectedItem[] {
  if (!text) return [];
  // Tolerate fenced/prose-wrapped JSON.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text, text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed = JSON.parse(candidate) as { items?: RawDetectedItem[] };
      if (Array.isArray(parsed.items)) return parsed.items;
    } catch {
      // try next
    }
  }
  return [];
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

    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: EXTRACTION_PROMPT }, imagePart] }],
      config: { responseMimeType: "application/json", temperature: 0 },
    });

    return {
      provider: this.id,
      model,
      items: parseItems(response.text),
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
