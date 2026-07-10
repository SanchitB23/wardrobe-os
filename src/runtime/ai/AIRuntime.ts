/**
 * AI Runtime v2 (RFC-014) — the entry point.
 *
 * Capability → policy → provider router (primary/fallback + retry) → structured
 * output → cache → metrics. Wraps the existing `src/ai` providers/parsers/cache;
 * adds no business logic and makes no wardrobe decision (ADR-005). The runtime
 * ROUTES and MEASURES; engines decide; AI explains.
 */

import { buildAICacheKey } from "@/ai/cache";
import {
  AIError,
  ParseError,
  type AICache,
  type AICacheEntry,
  type AICacheRequest,
  type AIProvider,
  type AIProviderId,
  type AIRequest,
  type AIResponse,
} from "@/ai/types";
import { mechanicalFor, resolveProvider } from "@/runtime/ai/CapabilityRouter";
import { estimateCost } from "@/runtime/ai/CostTracker";
import { benchmarkCapability } from "@/runtime/ai/ProviderBenchmark";
import { ProviderRouter } from "@/runtime/ai/ProviderRouter";
import { PromptRegistry } from "@/runtime/ai/PromptRegistry";
import { RuntimeMetrics } from "@/runtime/ai/RuntimeMetrics";
import type {
  AICapability,
  AIRuntimeMetricsSnapshot,
  AIRuntimePolicies,
  AIRuntimeRequest,
  AIRuntimeResult,
  BenchmarkResult,
} from "@/runtime/ai/types";

const ADHOC_VERSION = "adhoc";

export interface AIRuntimeConfig {
  providers: AIProvider[];
  policies: AIRuntimePolicies;
  registry?: PromptRegistry;
  metrics?: RuntimeMetrics;
  cache?: AICache;
  retries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

export class AIRuntime {
  private readonly policies: AIRuntimePolicies;
  private readonly registry: PromptRegistry;
  private readonly metrics: RuntimeMetrics;
  private readonly router: ProviderRouter;
  private readonly providerIds: AIProviderId[];
  private readonly cache?: AICache;
  private readonly now: () => number;

  constructor(config: AIRuntimeConfig) {
    this.policies = config.policies;
    this.registry = config.registry ?? new PromptRegistry();
    this.metrics = config.metrics ?? new RuntimeMetrics();
    this.cache = config.cache;
    this.now = config.now ?? (() => Date.now());
    this.providerIds = config.providers.map((p) => p.id);
    this.router = new ProviderRouter({
      providers: config.providers,
      retries: config.retries,
      initialDelayMs: config.initialDelayMs,
      backoffFactor: config.backoffFactor,
      sleep: config.sleep,
    });
  }

  /** Resolve the request + prompt version for a capability call. */
  private resolveRequest<T>(req: AIRuntimeRequest<T>): { request: AIRequest; promptVersion: string } {
    const policy = this.policies[req.capability];
    if (req.builderId && req.promptContext) {
      const selected = this.registry.select(req.builderId, req.bucketKey);
      const built = selected.build(req.promptContext);
      return {
        request: {
          prompt: built.prompt,
          system: built.system,
          model: policy?.model,
        },
        promptVersion: selected.versionId,
      };
    }
    if (!req.request) {
      throw new AIError("no_provider", "AIRuntimeRequest needs `request` or `builderId`+`promptContext`.");
    }
    return {
      request: { ...req.request, model: req.request.model ?? policy?.model },
      promptVersion: ADHOC_VERSION,
    };
  }

  async run<T = unknown>(req: AIRuntimeRequest<T>): Promise<AIRuntimeResult<T>> {
    const policy = resolveProvider(req.capability, this.policies);
    const mechanical = mechanicalFor(req.capability);
    const { request, promptVersion } = this.resolveRequest(req);

    // Cache read (opt-in; keyed incl. capability + prompt version).
    const cacheKey =
      this.cache && req.cache
        ? buildAICacheKey({
            promptBuilder: `${req.capability}:${req.cache.promptBuilder}`,
            promptVersion: req.cache.promptVersion ?? promptVersion,
            model: req.cache.model ?? request.model ?? "default",
            input: req.cache.input,
          })
        : undefined;

    if (cacheKey && this.cache && !req.forceRefresh) {
      const entry = await this.cache.get(cacheKey.key);
      if (entry) {
        const response = entry.response as AIResponse<T>;
        const result = this.finalize(req, response, req.capability, promptVersion, response.provider, false, true);
        return result;
      }
    }

    let outcome;
    try {
      outcome = await this.router.route(policy, mechanical, request, req.signal);
    } catch (error) {
      this.metrics.record({
        capability: req.capability,
        provider: policy.primary,
        promptVersion,
        latencyMs: null,
        costUsd: 0,
        cacheHit: false,
        ok: false,
      });
      throw error;
    }

    const result = this.finalize(
      req,
      outcome.response as AIResponse<T>,
      req.capability,
      promptVersion,
      outcome.servedBy,
      outcome.usedFallback,
      false,
    );

    if (cacheKey && this.cache && req.cache) {
      await this.writeCache(cacheKey, req.cache, request, outcome.response, promptVersion);
    }
    return result;
  }

  /** Parse (if a parser is given), estimate cost, record metrics, shape the result. */
  private finalize<T>(
    req: AIRuntimeRequest<T>,
    response: AIResponse<T>,
    capability: AICapability,
    promptVersion: string,
    servedBy: AIProviderId,
    usedFallback: boolean,
    cached: boolean,
  ): AIRuntimeResult<T> {
    let parsed = response;
    if (req.parser) {
      const outcome = req.parser.parse(response.text);
      if (!outcome.ok) throw new ParseError(outcome.errors);
      parsed = { ...response, parsed: outcome.data };
    }

    const costUsd = estimateCost(response.usage, servedBy, response.model);
    this.metrics.record({
      capability,
      provider: servedBy,
      promptVersion,
      latencyMs: response.latencyMs ?? null,
      usage: response.usage,
      costUsd,
      cacheHit: cached,
      ok: true,
    });

    return {
      ...parsed,
      cached,
      capability,
      promptVersion,
      servedBy,
      usedFallback,
      costUsd,
    };
  }

  private async writeCache(
    cacheKey: { key: string; inputHash: string },
    cache: AICacheRequest,
    request: AIRequest,
    response: AIResponse,
    promptVersion: string,
  ): Promise<void> {
    if (!this.cache) return;
    const nowMs = this.now();
    const ttl = cache.ttlSeconds;
    const entry: AICacheEntry = {
      key: cacheKey.key,
      provider: response.provider,
      model: cache.model ?? request.model ?? response.model,
      promptBuilder: cache.promptBuilder,
      promptVersion: cache.promptVersion ?? promptVersion,
      inputHash: cacheKey.inputHash,
      response: { ...response, raw: undefined },
      metadata: response.raw,
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: ttl && ttl > 0 ? new Date(nowMs + ttl * 1000).toISOString() : null,
    };
    await this.cache.set(entry);
  }

  /** Developer tool: run a capability across providers and compare. */
  async benchmark<T = unknown>(
    req: AIRuntimeRequest<T>,
    providerIds: AIProviderId[] = this.providerIds,
  ): Promise<BenchmarkResult> {
    const mechanical = mechanicalFor(req.capability);
    const { request, promptVersion } = this.resolveRequest(req);
    return benchmarkCapability({
      router: this.router,
      capability: req.capability,
      mechanical,
      request,
      providerIds,
      promptVersion,
    });
  }

  metricsSnapshot(): AIRuntimeMetricsSnapshot {
    return this.metrics.snapshot();
  }

  getPolicies(): AIRuntimePolicies {
    return this.policies;
  }
}
