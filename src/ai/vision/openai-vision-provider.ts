/**
 * OpenAI implementation of the domain VisionProvider (RFC-029). Server-side
 * only; lazy `openai` SDK; key from OPENAI_API_KEY. Mirrors GeminiVisionProvider:
 * asks the model for structured JSON garment detections and returns a
 * RawVisionResult. GPT-5 models require `max_completion_tokens` (never
 * `max_tokens`). Empty/garbage output → empty items (a poor read, not an error).
 */

import {
  VisionError,
  type VisionCapabilities,
  type VisionProvider,
  type VisionProviderId,
} from "@/domain/vision";
import type { RawVisionResult, VisionImageInput } from "@/domain/vision";
import { parseVisionItems } from "@/ai/vision/parse-vision-items";

const DEFAULT_VISION_MODEL = "gpt-5.4-mini";
const MAX_COMPLETION_TOKENS = 1024;

const EXTRACTION_PROMPT = [
  "You are a garment detector. Look at the image and list each clothing item, footwear, or accessory you can see.",
  "Return ONLY JSON of the form:",
  '{"items":[{"label":string,"category":string,"colors":[{"name":string,"coveragePct":number}],"material":string|null,"texture":string|null,"pattern":string|null,"brand":string|null,"formality":string|null,"confidence":number}]}',
  "confidence is 0..1. Describe only what is visible; do not invent brands — set brand to null if unsure. No prose, no code fences.",
].join(" ");

type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface OpenAIVisionChatParams {
  model: string;
  messages: { role: string; content: VisionContentPart[] }[];
  max_completion_tokens?: number;
  response_format?: { type: "json_object" | "text" };
}

export interface OpenAIVisionClient {
  chat: {
    completions: {
      create(params: OpenAIVisionChatParams): Promise<{
        choices?: { message?: { content?: string | null } }[];
        model?: string;
        usage?: { total_tokens?: number };
      }>;
    };
  };
}

export interface OpenAIVisionProviderConfig {
  apiKey?: string;
  model?: string;
  client?: OpenAIVisionClient;
}

export class OpenAIVisionProvider implements VisionProvider {
  readonly id: VisionProviderId = "openai";
  readonly capabilities: VisionCapabilities = {
    multiItem: true,
    segmentation: false,
    brandHints: true,
  };

  private readonly config: OpenAIVisionProviderConfig;
  private cachedClient?: OpenAIVisionClient;

  constructor(config: OpenAIVisionProviderConfig = {}) {
    this.config = config;
  }

  async analyze(input: VisionImageInput): Promise<RawVisionResult> {
    if (typeof window !== "undefined") {
      throw new VisionError("provider_error", "OpenAIVisionProvider must run server-side only.");
    }
    const client = await this.getClient();
    const model = this.config.model ?? process.env.OPENAI_MODEL_VISION ?? DEFAULT_VISION_MODEL;

    const url =
      input.kind === "base64" ? `data:${input.mimeType};base64,${input.data}` : input.data;

    let response;
    try {
      response = await client.chat.completions.create({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              { type: "image_url", image_url: { url } },
            ],
          },
        ],
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new VisionError("provider_error", `OpenAI vision request failed: ${message}`, {
        cause: error,
      });
    }

    return {
      provider: this.id,
      model: response.model ?? model,
      items: parseVisionItems(response.choices?.[0]?.message?.content),
      raw: response,
      usage: { totalTokens: response.usage?.total_tokens },
    };
  }

  private async getClient(): Promise<OpenAIVisionClient> {
    if (this.config.client) return this.config.client;
    if (this.cachedClient) return this.cachedClient;
    const apiKey = this.config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new VisionError("provider_error", "OPENAI_API_KEY is not set (server-side only).");
    }
    const { default: OpenAI } = await import("openai");
    this.cachedClient = new OpenAI({ apiKey }) as unknown as OpenAIVisionClient;
    return this.cachedClient;
  }
}
