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
import { mechanicalFor } from "@/runtime/ai/CapabilityRouter";
import { DEFAULT_BUDGET, type BudgetConfig, type BudgetStatus } from "@/runtime/ai/BudgetGuard";
import { RuntimeCostEstimator } from "@/runtime/ai/RuntimeCostEstimator";
import { RuntimeBudgetMonitor } from "@/runtime/ai/RuntimeBudgetMonitor";
import { RuntimePolicyResolver } from "@/runtime/ai/RuntimePolicyResolver";
import { benchmarkCapability } from "@/runtime/ai/ProviderBenchmark";
import { ProviderRouter } from "@/runtime/ai/ProviderRouter";
import { PromptRegistry } from "@/runtime/ai/PromptRegistry";
import { RuntimeMetrics } from "@/runtime/ai/RuntimeMetrics";
import { logAIUsage } from "@/runtime/logging/ai-usage-logger";
import type {
  AICapability,
  AIRuntimeMetricsSnapshot,
  AIRuntimePolicies,
  AIRuntimeRequest,
  AIRuntimeResult,
  BenchmarkResult,
} from "@/runtime/ai/types";

const ADHOC_VERSION = "adhoc";
type Env = Record<string, string | undefined>;

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
  /** OpenAI spend guard (RFC-014A). Defaults to the $5 config. */
  budget?: BudgetConfig;
  /** Env for model-policy resolution (tests inject; defaults to process.env). */
  env?: Env;
}

export class AIRuntime {
  private readonly policies: AIRuntimePolicies;
  private readonly registry: PromptRegistry;
  private readonly metrics: RuntimeMetrics;
  private readonly router: ProviderRouter;
  private readonly providerIds: AIProviderId[];
  private readonly cache?: AICache;
  private readonly now: () => number;
  private readonly costEstimator: RuntimeCostEstimator;
  private readonly budgetMonitor: RuntimeBudgetMonitor;
  private readonly policyResolver: RuntimePolicyResolver;

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

    // Decision layer (RFC-014B): cost estimator → budget monitor → policy resolver.
    const env = config.env ?? process.env;
    this.costEstimator = new RuntimeCostEstimator();
    this.budgetMonitor = new RuntimeBudgetMonitor(config.budget ?? DEFAULT_BUDGET, () =>
      this.costEstimator.monthToDate(this.metrics.snapshot(), "openai"),
    );
    this.policyResolver = new RuntimePolicyResolver(this.policies, this.budgetMonitor, env);
  }

  /** Current OpenAI budget status (drives the hard stop + the dashboard). */
  budgetStatus(): BudgetStatus {
    return this.budgetMonitor.status();
  }

  /** The model that would be selected for a (capability, provider) pair. */
  modelFor(capability: AICapability, provider: AIProviderId): string | undefined {
    return this.policyResolver.modelFor(capability, provider);
  }

  /** The runtime's policy resolver — used by the developer dashboard. */
  getPolicyResolver(): RuntimePolicyResolver {
    return this.policyResolver;
  }

  /** Resolve the request + prompt version for a capability call. */
  private resolveRequest<T>(req: AIRuntimeRequest<T>): { request: AIRequest; promptVersion: string } {
    const policy = this.policies[req.capability];
    // Model policy: the model for the PRIMARY provider (keys the cache; the router
    // re-resolves per provider on fallback). Explicit request.model wins.
    const primaryModel = policy
      ? this.policyResolver.modelFor(req.capability, policy.primary)
      : undefined;
    if (req.builderId && req.promptContext) {
      const selected = this.registry.select(req.builderId, req.bucketKey);
      const built = selected.build(req.promptContext);
      return {
        request: {
          prompt: built.prompt,
          system: built.system,
          model: primaryModel ?? policy?.model,
        },
        promptVersion: selected.versionId,
      };
    }
    if (!req.request) {
      throw new AIError("no_provider", "AIRuntimeRequest needs `request` or `builderId`+`promptContext`.");
    }
    return {
      request: { ...req.request, model: req.request.model ?? primaryModel ?? policy?.model },
      promptVersion: ADHOC_VERSION,
    };
  }

  async run<T = unknown>(req: AIRuntimeRequest<T>): Promise<AIRuntimeResult<T>> {
    // Decide once (RFC-014B): capability → provider policy + per-provider model +
    // availability. The resolver decides; the router executes.
    const route = this.policyResolver.resolve(req.capability);
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

    const fallbackProvider = route.policy.fallback ?? null;

    if (cacheKey && this.cache && !req.forceRefresh) {
      const entry = await this.cache.get(cacheKey.key);
      if (entry) {
        const response = entry.response as AIResponse<T>;
        const result = this.finalize(
          req,
          response,
          req.capability,
          promptVersion,
          response.provider,
          false,
          true,
          fallbackProvider,
        );
        return result;
      }
    }

    let outcome;
    try {
      // Budget guard (RFC-014A/B): the resolver already marked OpenAI unavailable
      // if the hard stop tripped, so the router falls back to Gemini. Gemini is
      // never disabled.
      outcome = await this.router.route(route.policy, route.mechanical, request, {
        signal: req.signal,
        resolveModel: route.resolveModel,
        isAvailable: route.isAvailable,
      });
    } catch (error) {
      this.metrics.record({
        capability: req.capability,
        provider: route.policy.primary,
        promptVersion,
        model: request.model ?? "unknown",
        latencyMs: null,
        costUsd: 0,
        cacheHit: false,
        ok: false,
        usedFallback: false,
      });
      const errorCode =
        error instanceof AIError
          ? error.code
          : error instanceof Error
            ? error.name
            : "unknown";
      logAIUsage({
        capability: req.capability,
        provider: route.policy.primary,
        model: request.model ?? "unknown",
        fallbackProvider,
        usedFallback: false,
        promptVersion,
        cacheHit: false,
        usage: null,
        estimatedCostUsd: null,
        latencyMs: null,
        status: "error",
        errorCode,
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
      fallbackProvider,
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
    fallbackProvider: AIProviderId | null = null,
  ): AIRuntimeResult<T> {
    let parsed = response;
    if (req.parser) {
      const outcome = req.parser.parse(response.text);
      if (!outcome.ok) {
        logAIUsage({
          capability,
          provider: servedBy,
          model: response.model,
          fallbackProvider,
          usedFallback,
          promptVersion,
          cacheHit: cached,
          usage: response.usage,
          estimatedCostUsd: null,
          latencyMs: response.latencyMs ?? null,
          status: "error",
          errorCode: "parse_error",
        });
        throw new ParseError(outcome.errors);
      }
      parsed = { ...response, parsed: outcome.data };
    }

    const costUsd = this.costEstimator.perCall(response.usage, servedBy, response.model);
    this.metrics.record({
      capability,
      provider: servedBy,
      promptVersion,
      model: response.model || "unknown",
      latencyMs: response.latencyMs ?? null,
      usage: response.usage,
      costUsd,
      cacheHit: cached,
      ok: true,
      usedFallback,
    });

    logAIUsage({
      capability,
      provider: servedBy,
      model: response.model,
      fallbackProvider,
      usedFallback,
      promptVersion,
      cacheHit: cached,
      usage: response.usage,
      estimatedCostUsd: cached ? 0 : costUsd,
      latencyMs: response.latencyMs ?? null,
      status: cached ? "cache_hit" : "ok",
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
