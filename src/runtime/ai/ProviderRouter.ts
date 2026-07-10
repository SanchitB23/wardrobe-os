/**
 * AI Runtime v2 (RFC-014) — provider routing with primary → fallback + retry.
 *
 * Given a resolved {@link ProviderPolicy}, it calls the primary provider (with
 * bounded retry on retryable errors), and on exhaustion moves to the fallback.
 * Records which provider served the request and whether the fallback was used.
 * The only I/O is the provider call itself; retry/backoff is injectable for
 * deterministic tests.
 */

import {
  AIError,
  type AIProvider,
  type AIProviderId,
  type AIRequest,
  type AIResponse,
} from "@/ai/types";
import type { MechanicalCapability, ProviderPolicy } from "@/runtime/ai/types";

export interface RouteOutcome {
  response: AIResponse;
  servedBy: AIProviderId;
  usedFallback: boolean;
}

export interface ProviderRouterConfig {
  providers: AIProvider[];
  /** Attempts per provider (>=1). */
  retries?: number;
  initialDelayMs?: number;
  backoffFactor?: number;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class ProviderRouter {
  private readonly registry: Map<AIProviderId, AIProvider>;
  private readonly retries: number;
  private readonly initialDelayMs: number;
  private readonly backoffFactor: number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(config: ProviderRouterConfig) {
    this.registry = new Map(config.providers.map((p) => [p.id, p]));
    this.retries = Math.max(1, config.retries ?? 1);
    this.initialDelayMs = config.initialDelayMs ?? 0;
    this.backoffFactor = config.backoffFactor ?? 2;
    this.sleep = config.sleep ?? realSleep;
  }

  has(id: AIProviderId): boolean {
    return this.registry.has(id);
  }

  /** Route a request through the policy: primary (with retry) → fallback. */
  async route(
    policy: ProviderPolicy,
    mechanical: MechanicalCapability,
    request: AIRequest,
    signal?: AbortSignal,
  ): Promise<RouteOutcome> {
    const chain: { id: AIProviderId; isFallback: boolean }[] = [
      { id: policy.primary, isFallback: false },
    ];
    if (policy.fallback && policy.fallback !== policy.primary) {
      chain.push({ id: policy.fallback, isFallback: true });
    }

    const errors: string[] = [];
    for (const link of chain) {
      const provider = this.registry.get(link.id);
      if (!provider) {
        errors.push(`${link.id}: not registered`);
        continue;
      }
      if (!provider.capabilities[mechanical]) {
        errors.push(`${link.id}: cannot ${mechanical}`);
        continue;
      }
      try {
        const response = await this.withRetry(provider, mechanical, request, signal);
        return { response, servedBy: provider.id, usedFallback: link.isFallback };
      } catch (error) {
        errors.push(`${link.id}: ${error instanceof Error ? error.message : String(error)}`);
        // Fall through to the next link in the chain.
      }
    }

    throw new AIError(
      "all_providers_failed",
      `All providers failed (${mechanical}): ${errors.join(" | ")}`,
    );
  }

  private async withRetry(
    provider: AIProvider,
    mechanical: MechanicalCapability,
    request: AIRequest,
    signal?: AbortSignal,
  ): Promise<AIResponse> {
    let delay = this.initialDelayMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.retries; attempt += 1) {
      if (signal?.aborted) throw new AIError("aborted", "Request aborted", { retryable: false });
      try {
        const started = performance.now();
        const response = await (mechanical === "vision"
          ? provider.vision(request)
          : provider.generate(request));
        response.latencyMs ??= Math.round(performance.now() - started);
        return response;
      } catch (error) {
        lastError = error;
        const retryable = !(error instanceof AIError) || error.retryable;
        if (!retryable || attempt === this.retries) throw error;
        if (delay > 0) await this.sleep(delay);
        delay *= this.backoffFactor;
      }
    }
    throw lastError;
  }
}
