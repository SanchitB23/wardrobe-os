/**
 * OpenAI provider (RFC-014A) — real `generate()` on top of the official `openai`
 * SDK (chat completions). Vendor-neutral: implements {@link AIProvider}; callers
 * depend on that interface, never on this class.
 *
 * Design notes:
 * - Server-side only: the key is read from `OPENAI_API_KEY` (no `NEXT_PUBLIC_`
 *   prefix → never bundled to the browser); a runtime guard also refuses to run
 *   in a browser context.
 * - Availability: if `OPENAI_API_KEY` is absent the provider is UNAVAILABLE —
 *   `generate()` throws a non-retryable {@link ProviderError} so the AI Runtime's
 *   router falls straight through to the Gemini fallback (no crash, no wasted
 *   retries). RFC-014A req 7.
 * - Models: the runtime's model policy (RFC-014A) supplies the model per
 *   capability; the provider's own fallbacks are `OPENAI_MODEL_TEXT` and
 *   `OPENAI_MODEL_STRUCTURED` (both default gpt-5.4-mini). Never gpt-5.5 by default.
 * - Capabilities: generate (explanation / summarization / conversation) +
 *   structuredOutput. Vision and image generation stay with Gemini (req 5).
 * - The SDK client is created lazily and injectable, so unit tests run with a
 *   fake client and never touch the network or need a key.
 *
 * `stream()` and `vision()` remain the StubAIProvider `NotImplementedError`
 * stubs — out of scope for RFC-014A.
 */

import { StubAIProvider } from "@/ai/providers/base-provider";
import {
  ProviderError,
  type AICapabilities,
  type AIMessage,
  type AIProviderId,
  type AIRequest,
  type AIResponse,
  type AIUsage,
  type FinishReason,
} from "@/ai/types";

// Cost-first defaults (RFC-014A). The runtime's model policy normally supplies the
// model per capability; these are the provider's own fallbacks for direct use.
// The premium model (gpt-5.5) is never a default.
const DEFAULT_TEXT_MODEL = "gpt-5.4-mini";
const DEFAULT_STRUCTURED_MODEL = "gpt-5.4-mini";
const PROVIDER_ID: AIProviderId = "openai";

/** Minimal shape of a chat-completion result we consume (matches the SDK). */
export interface OpenAIChatResult {
  choices?: {
    message?: { content?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
}

export interface OpenAIChatParams {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  /**
   * GPT-5-family models reject the legacy `max_tokens` on chat completions and
   * require `max_completion_tokens` ("Unsupported parameter: 'max_tokens' … Use
   * 'max_completion_tokens' instead"). This is the output-token cap.
   */
  max_completion_tokens?: number;
  response_format?: { type: "json_object" | "text" };
}

/** Minimal client contract — satisfied by the `openai` SDK's OpenAI instance. */
export interface OpenAIChatClient {
  chat: {
    completions: {
      create(params: OpenAIChatParams): Promise<OpenAIChatResult>;
    };
  };
}

export interface OpenAIProviderConfig {
  /** Overrides `OPENAI_API_KEY`. Read from env at call time if omitted. */
  apiKey?: string;
  /** Overrides `OPENAI_MODEL_TEXT`. Falls back to gpt-5.5. */
  textModel?: string;
  /** Overrides `OPENAI_MODEL_STRUCTURED`. Falls back to gpt-5.4-mini. */
  structuredModel?: string;
  /** Inject a client (tests / alternate transports). Built lazily otherwise. */
  client?: OpenAIChatClient;
  /** Retry once on a transient failure (default true). */
  retryOnceOnTransient?: boolean;
  /** Injectable backoff delay (tests pass a no-op). */
  sleep?: (ms: number) => Promise<void>;
  /** Delay before the single retry. */
  retryDelayMs?: number;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class OpenAIProvider extends StubAIProvider {
  readonly id: AIProviderId = PROVIDER_ID;
  readonly capabilities: AICapabilities = {
    generate: true,
    // Not wired — the base stub throws NotImplementedError for these.
    stream: false,
    vision: false,
    structuredOutput: true,
  };

  private readonly config: OpenAIProviderConfig;
  private cachedClient?: OpenAIChatClient;

  constructor(config: OpenAIProviderConfig = {}) {
    super();
    this.config = config;
  }

  /** True when credentials/a client are available (diagnostics; router uses generate). */
  isAvailable(): boolean {
    return Boolean(this.config.client ?? this.config.apiKey ?? process.env.OPENAI_API_KEY);
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    this.assertServerSide();
    const client = await this.getClient();
    const model = this.resolveModel(request);

    const started = performance.now();
    const result = await this.callWithRetry(client, model, request);
    const latencyMs = Math.round(performance.now() - started);

    const choice = result.choices?.[0];
    const text = choice?.message?.content;
    if (typeof text !== "string" || text.trim() === "") {
      throw new ProviderError(PROVIDER_ID, "OpenAI returned an empty response", {
        retryable: false,
      });
    }

    return {
      text,
      provider: PROVIDER_ID,
      model: result.model ?? model,
      finishReason: mapFinishReason(choice?.finish_reason),
      usage: mapUsage(result.usage),
      latencyMs,
      raw: result,
    };
  }

  // --- internals ----------------------------------------------------------

  private buildMessages(request: AIRequest): { role: string; content: string }[] {
    const messages: { role: string; content: string }[] = [];
    if (request.system) messages.push({ role: "system", content: request.system });
    if (request.messages && request.messages.length > 0) {
      for (const m of request.messages as AIMessage[]) {
        messages.push({ role: m.role, content: m.content });
      }
    } else {
      messages.push({ role: "user", content: request.prompt });
    }
    return messages;
  }

  private async callWithRetry(
    client: OpenAIChatClient,
    model: string,
    request: AIRequest,
  ): Promise<OpenAIChatResult> {
    const retry = this.config.retryOnceOnTransient ?? true;
    const sleep = this.config.sleep ?? realSleep;

    const attempt = () =>
      client.chat.completions.create({
        model,
        messages: this.buildMessages(request),
        temperature: request.temperature,
        max_completion_tokens: request.maxTokens,
        response_format:
          request.responseFormat === "json" ? { type: "json_object" } : undefined,
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

  private async getClient(): Promise<OpenAIChatClient> {
    if (this.config.client) return this.config.client;
    if (this.cachedClient) return this.cachedClient;

    const apiKey = this.config.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Unavailable → non-retryable so the router falls straight to the fallback.
      throw new ProviderError(
        PROVIDER_ID,
        "OPENAI_API_KEY is not set — OpenAI provider unavailable; routing falls back to Gemini.",
        { retryable: false },
      );
    }

    // Import lazily so the SDK is never pulled into a client bundle and tests can
    // load this module (with an injected client) without the package or a key.
    const { default: OpenAI } = await import("openai");
    this.cachedClient = new OpenAI({ apiKey }) as unknown as OpenAIChatClient;
    return this.cachedClient;
  }

  /** Structured/JSON requests use the structured model; text uses the text model. */
  private resolveModel(request: AIRequest): string {
    if (request.model) return request.model;
    if (request.responseFormat === "json") {
      return (
        this.config.structuredModel ??
        process.env.OPENAI_MODEL_STRUCTURED ??
        DEFAULT_STRUCTURED_MODEL
      );
    }
    return this.config.textModel ?? process.env.OPENAI_MODEL_TEXT ?? DEFAULT_TEXT_MODEL;
  }

  private assertServerSide(): void {
    if (typeof window !== "undefined") {
      throw new ProviderError(
        PROVIDER_ID,
        "OpenAIProvider must only run on the server — never call it from the browser.",
        { retryable: false },
      );
    }
  }
}

function mapUsage(usage: OpenAIChatResult["usage"]): AIUsage | undefined {
  if (!usage) return undefined;
  return {
    promptTokens: usage.prompt_tokens ?? 0,
    completionTokens: usage.completion_tokens ?? 0,
    totalTokens:
      usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
  };
}

function mapFinishReason(reason: string | null | undefined): FinishReason {
  switch (reason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "content_filter":
      return "content_filter";
    default:
      return reason ? "unknown" : "stop";
  }
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
    message.includes("rate limit") ||
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
  return new ProviderError(PROVIDER_ID, `OpenAI request failed: ${message}`, {
    retryable,
    cause: error,
  });
}
