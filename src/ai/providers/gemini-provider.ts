/**
 * Google Gemini provider — real `generate()` on top of `@google/genai`.
 *
 * Design notes:
 * - Vendor-neutral: implements {@link AIProvider}; the orchestrator and the rest
 *   of the app depend on that interface, never on this class → swappable (req 11).
 * - Server-side only (reqs 6, 7): the API key is read from `GEMINI_API_KEY`,
 *   which has no `NEXT_PUBLIC_` prefix, so Next never bundles it to the browser.
 *   A runtime guard also refuses to run in a browser context.
 * - Low cost (hobby project): defaults to `gemini-2.5-flash`, does at most ONE
 *   retry on transient failures, and never fans out.
 * - The SDK client is created lazily and injectable, so unit tests run with a
 *   fake client and no network / no key.
 *
 * `stream()` and `vision()` remain the StubAIProvider `NotImplementedError`
 * stubs — this task is generate() plumbing only.
 */

import { StubAIProvider } from "@/ai/providers/base-provider";
import {
  ProviderError,
  type AICapabilities,
  type AIProviderId,
  type AIRequest,
  type AIResponse,
  type AIUsage,
} from "@/ai/types";

const DEFAULT_MODEL = "gemini-2.5-flash";
const PROVIDER_ID: AIProviderId = "gemini";

/** Minimal shape of a Gemini `generateContent` result that we consume. */
export interface GeminiGenerateResult {
  text?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

/** Minimal client contract — satisfied by `@google/genai`'s GoogleGenAI. */
export interface GeminiClient {
  models: {
    generateContent(params: {
      model: string;
      contents: string;
      config?: {
        systemInstruction?: string;
        temperature?: number;
        maxOutputTokens?: number;
        responseMimeType?: string;
        abortSignal?: AbortSignal;
      };
    }): Promise<GeminiGenerateResult>;
  };
}

export interface GeminiProviderConfig {
  /** Overrides `GEMINI_API_KEY`. Read from env at call time if omitted. */
  apiKey?: string;
  /** Overrides `GEMINI_MODEL`. Falls back to `gemini-2.5-flash`. */
  model?: string;
  /** Inject a client (tests / alternate transports). Built lazily otherwise. */
  client?: GeminiClient;
  /** Retry once on a transient failure (default true). */
  retryOnceOnTransient?: boolean;
  /** Injectable backoff delay (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
  /** Delay before the single retry. */
  retryDelayMs?: number;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class GeminiProvider extends StubAIProvider {
  readonly id: AIProviderId = PROVIDER_ID;
  readonly capabilities: AICapabilities = {
    generate: true,
    // Not wired yet — the base stub throws NotImplementedError for these.
    stream: false,
    vision: false,
    structuredOutput: true,
  };

  private readonly config: GeminiProviderConfig;
  private cachedClient?: GeminiClient;

  constructor(config: GeminiProviderConfig = {}) {
    super();
    this.config = config;
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    this.assertServerSide();
    const client = await this.getClient();
    const model = this.resolveModel(request);

    const started = performance.now();
    const result = await this.callWithRetry(client, model, request);
    const latencyMs = Math.round(performance.now() - started);

    const text = result.text;
    if (typeof text !== "string" || text.trim() === "") {
      // req 4: invalid response
      throw new ProviderError(
        PROVIDER_ID,
        "Gemini returned an empty response",
        { retryable: false },
      );
    }

    return {
      text,
      provider: PROVIDER_ID,
      model,
      finishReason: "stop",
      usage: mapUsage(result.usageMetadata),
      latencyMs,
      raw: result,
    };
  }

  // --- internals ----------------------------------------------------------

  private async callWithRetry(
    client: GeminiClient,
    model: string,
    request: AIRequest,
  ): Promise<GeminiGenerateResult> {
    const retry = this.config.retryOnceOnTransient ?? true;
    const sleep = this.config.sleep ?? realSleep;

    const attempt = () =>
      client.models.generateContent({
        model,
        contents: request.prompt,
        config: {
          systemInstruction: request.system,
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
          responseMimeType:
            request.responseFormat === "json" ? "application/json" : undefined,
        },
      });

    try {
      return await attempt();
    } catch (error) {
      if (retry && isTransient(error)) {
        await sleep(this.config.retryDelayMs ?? 250);
        try {
          return await attempt();
        } catch (retryError) {
          throw toProviderError(retryError, true);
        }
      }
      throw toProviderError(error, isTransient(error));
    }
  }

  private async getClient(): Promise<GeminiClient> {
    if (this.config.client) return this.config.client;
    if (this.cachedClient) return this.cachedClient;

    const apiKey = this.config.apiKey ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // req 4: missing API key
      throw new ProviderError(
        PROVIDER_ID,
        "GEMINI_API_KEY is not set. Add it to your environment (server-side only) — see src/ai/README.md.",
        { retryable: false },
      );
    }

    // Import lazily so the SDK is never pulled into a client bundle and the
    // module can be loaded in tests without a key.
    const { GoogleGenAI } = await import("@google/genai");
    this.cachedClient = new GoogleGenAI({ apiKey }) as unknown as GeminiClient;
    return this.cachedClient;
  }

  private resolveModel(request: AIRequest): string {
    return (
      request.model ??
      this.config.model ??
      process.env.GEMINI_MODEL ??
      DEFAULT_MODEL
    );
  }

  private assertServerSide(): void {
    if (typeof window !== "undefined") {
      throw new ProviderError(
        PROVIDER_ID,
        "GeminiProvider must only run on the server — never call it from the browser.",
        { retryable: false },
      );
    }
  }
}

function mapUsage(
  usage: GeminiGenerateResult["usageMetadata"],
): AIUsage | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.promptTokenCount ?? 0,
    completionTokens: usage.candidatesTokenCount ?? 0,
    totalTokens: usage.totalTokenCount ?? 0,
  };
}

/** Transient = worth one retry: network blips, rate limits, 5xx. */
function isTransient(error: unknown): boolean {
  const status = extractStatus(error);
  if (status !== undefined) {
    return status === 408 || status === 429 || (status >= 500 && status < 600);
  }
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("fetch failed") ||
    message.includes("unavailable")
  );
}

function extractStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    for (const key of ["status", "statusCode", "code"]) {
      const value = record[key];
      if (typeof value === "number") return value;
    }
  }
  return undefined;
}

function toProviderError(error: unknown, retryable: boolean): ProviderError {
  if (error instanceof ProviderError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new ProviderError(PROVIDER_ID, `Gemini request failed: ${message}`, {
    retryable,
    cause: error,
  });
}
