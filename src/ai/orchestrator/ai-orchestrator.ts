/**
 * AIOrchestrator (requirement 3) — the reference {@link AIService}.
 *
 * Responsibilities:
 *   1. Provider selection — honour an explicit `provider`, else pick the first
 *      registered provider that has the capability the call needs.
 *   2. Retry — retry retryable failures with exponential backoff.
 *   3. Fallback — on exhausting retries for one provider, move to the next
 *      capable provider in order.
 *   4. Logging — emit structured records through an injected {@link AILogger}.
 *   5. Cache — read/write {@link AICache} on generate() when a cacheKey is given.
 *
 * Pure orchestration: it holds provider *instances* but knows nothing about any
 * SDK. Today every provider is a stub that throws NotImplementedError; the
 * orchestrator's control flow is fully exercised regardless (see the tests).
 *
 * EXTENSION POINT: register real providers via {@link createAIOrchestrator};
 * inject a durable cache/logger/retry policy without touching this class.
 */

import { noopCache } from "@/ai/cache";
import {
  AIError,
  ParseError,
  type AICache,
  type AICallOptions,
  type AILogger,
  type AIProvider,
  type AIProviderId,
  type AIRequest,
  type AIResponse,
  type AIService,
  type AIStreamChunk,
  type RetryPolicy,
} from "@/ai/types";

type Capability = "generate" | "stream" | "vision";

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 2,
  initialDelayMs: 200,
  backoffFactor: 2,
};

const silentLogger: AILogger = { log() {} };

export interface AIOrchestratorConfig {
  /** Providers in preference order (first capable one wins by default). */
  providers: AIProvider[];
  /** Optional explicit default order by id; falls back to registration order. */
  providerOrder?: AIProviderId[];
  logger?: AILogger;
  cache?: AICache;
  retryPolicy?: RetryPolicy;
  /** Injectable delay (defaults to setTimeout) — tests pass a no-op. */
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class AIOrchestrator implements AIService {
  private readonly registry: Map<AIProviderId, AIProvider>;
  private readonly order: AIProviderId[];
  private readonly logger: AILogger;
  private readonly cache: AICache;
  private readonly retryPolicy: RetryPolicy;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(config: AIOrchestratorConfig) {
    this.registry = new Map(config.providers.map((p) => [p.id, p]));
    this.order =
      config.providerOrder ?? config.providers.map((p) => p.id);
    this.logger = config.logger ?? silentLogger;
    this.cache = config.cache ?? noopCache;
    this.retryPolicy = config.retryPolicy ?? DEFAULT_RETRY_POLICY;
    this.sleep = config.sleep ?? realSleep;
  }

  async generate<T = unknown>(
    request: AIRequest,
    options: AICallOptions<T> = {},
  ): Promise<AIResponse<T>> {
    if (options.cacheKey) {
      const cached = await this.cache.get(options.cacheKey);
      if (cached) {
        this.logger.log({
          level: "debug",
          message: "cache hit",
          data: { cacheKey: options.cacheKey },
        });
        return this.applyParser(cached as AIResponse<T>, options);
      }
    }

    const response = await this.run<T>(
      "generate",
      (provider) => provider.generate(request),
      options,
    );

    const parsed = this.applyParser(response, options);
    if (options.cacheKey) {
      await this.cache.set(options.cacheKey, parsed);
    }
    return parsed;
  }

  async vision<T = unknown>(
    request: AIRequest,
    options: AICallOptions<T> = {},
  ): Promise<AIResponse<T>> {
    const response = await this.run<T>(
      "vision",
      (provider) => provider.vision(request),
      options,
    );
    return this.applyParser(response, options);
  }

  async *stream(
    request: AIRequest,
    options: AICallOptions = {},
  ): AsyncIterable<AIStreamChunk> {
    const provider = this.selectProviders("stream", options.provider)[0];
    if (!provider) {
      throw new AIError("no_provider", "No provider supports stream()");
    }
    this.logger.log({
      level: "info",
      message: "stream start",
      data: { provider: provider.id },
    });
    // Streaming is not retried/failed-over: a partial stream can't be replayed.
    yield* provider.stream(request);
  }

  // --- internals ----------------------------------------------------------

  /** Run a unary call across capable providers with retry + fallback. */
  private async run<T>(
    capability: Capability,
    call: (provider: AIProvider) => Promise<AIResponse>,
    options: AICallOptions<T>,
  ): Promise<AIResponse<T>> {
    const providers = this.selectProviders(capability, options.provider);
    if (providers.length === 0) {
      throw new AIError(
        "no_provider",
        `No provider supports ${capability}()`,
      );
    }

    const errors: string[] = [];
    for (const provider of providers) {
      try {
        return (await this.withRetry(provider, capability, call, options)) as AIResponse<T>;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${provider.id}: ${message}`);
        this.logger.log({
          level: "warn",
          message: "provider failed, trying fallback",
          data: { provider: provider.id, capability, error: message },
        });
        // Non-retryable, non-fallback-worthy errors abort immediately.
        if (error instanceof AIError && !error.retryable && error.code !== "not_implemented") {
          throw error;
        }
      }
    }

    throw new AIError(
      "all_providers_failed",
      `All providers failed for ${capability}(): ${errors.join(" | ")}`,
    );
  }

  /** Retry a single provider call with exponential backoff. */
  private async withRetry(
    provider: AIProvider,
    capability: Capability,
    call: (provider: AIProvider) => Promise<AIResponse>,
    options: AICallOptions,
  ): Promise<AIResponse> {
    const maxAttempts = options.retries ?? this.retryPolicy.maxAttempts;
    let delay = this.retryPolicy.initialDelayMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (options.signal?.aborted) {
        throw new AIError("aborted", "Request aborted", { retryable: false });
      }
      try {
        const started = performance.now();
        const response = await call(provider);
        response.latencyMs ??= Math.round(performance.now() - started);
        this.logger.log({
          level: "info",
          message: "provider call ok",
          data: { provider: provider.id, capability, attempt },
        });
        return response;
      } catch (error) {
        lastError = error;
        const retryable = !(error instanceof AIError) || error.retryable;
        if (!retryable || attempt === maxAttempts) {
          throw error;
        }
        this.logger.log({
          level: "warn",
          message: "retrying provider call",
          data: { provider: provider.id, capability, attempt, delayMs: delay },
        });
        await this.sleep(delay);
        delay *= this.retryPolicy.backoffFactor;
      }
    }
    throw lastError;
  }

  /** Providers that support `capability`, honouring a forced provider. */
  private selectProviders(
    capability: Capability,
    forced?: AIProviderId,
  ): AIProvider[] {
    if (forced) {
      const provider = this.registry.get(forced);
      if (!provider) {
        throw new AIError("no_provider", `Unknown provider: ${forced}`);
      }
      return provider.capabilities[capability] ? [provider] : [];
    }
    return this.order
      .map((id) => this.registry.get(id))
      .filter((p): p is AIProvider => Boolean(p) && p!.capabilities[capability]);
  }

  /** Attach + validate structured output when a parser is supplied. */
  private applyParser<T>(
    response: AIResponse<T>,
    options: AICallOptions<T>,
  ): AIResponse<T> {
    if (!options.parser) return response;
    const result = options.parser.parse(response.text);
    if (!result.ok) {
      throw new ParseError(result.errors);
    }
    return { ...response, parsed: result.data };
  }
}

/** Convenience factory mirroring the app's other `create*` helpers. */
export function createAIOrchestrator(config: AIOrchestratorConfig): AIService {
  return new AIOrchestrator(config);
}
