/**
 * AI Runtime v2 (RFC-014) — in-memory metrics sink.
 *
 * Records latency, cost, tokens, cache-hit, fallback, and failure per
 * provider × capability × model × prompt version (mirroring WeatherMetrics from
 * RFC-011). Process-local; exposed for the Developer-Mode dashboard + tests.
 * Optionally persisted later (see RFC §8). No I/O here.
 */

import { CostTracker } from "@/runtime/ai/CostTracker";
import { LatencyTracker } from "@/runtime/ai/LatencyTracker";
import type {
  AIRuntimeMetricsSnapshot,
  MetricRow,
  MetricSample,
} from "@/runtime/ai/types";

interface Bucket {
  requests: number;
  cacheHits: number;
  failures: number;
  fallbacks: number;
  totalTokens: number;
  cacheSavingsUsd: number;
  latency: LatencyTracker;
  cost: CostTracker;
}

function newBucket(): Bucket {
  return {
    requests: 0,
    cacheHits: 0,
    failures: 0,
    fallbacks: 0,
    totalTokens: 0,
    cacheSavingsUsd: 0,
    latency: new LatencyTracker(),
    cost: new CostTracker(),
  };
}

export class RuntimeMetrics {
  private readonly buckets = new Map<string, { sample: MetricSample; model: string; bucket: Bucket }>();

  private keyOf(
    s: Pick<MetricSample, "capability" | "provider" | "promptVersion" | "model">,
  ): string {
    const model = s.model?.trim() || "unknown";
    return `${s.capability}|${s.provider}|${model}|${s.promptVersion}`;
  }

  record(sample: MetricSample): void {
    const model = sample.model?.trim() || "unknown";
    const key = this.keyOf({ ...sample, model });
    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { sample, model, bucket: newBucket() };
      this.buckets.set(key, entry);
    }
    const { bucket } = entry;
    bucket.requests += 1;
    if (sample.cacheHit) {
      bucket.cacheHits += 1;
      // Counterfactual: what the call would have cost if not cached.
      bucket.cacheSavingsUsd += sample.costUsd;
    } else {
      bucket.cost.add(sample.costUsd);
    }
    if (!sample.ok) bucket.failures += 1;
    if (sample.usedFallback) bucket.fallbacks += 1;
    bucket.totalTokens += sample.usage?.totalTokens ?? 0;
    if (sample.latencyMs != null) bucket.latency.record(sample.latencyMs);
  }

  snapshot(): AIRuntimeMetricsSnapshot {
    const rows: MetricRow[] = [];
    let totalRequests = 0;
    let totalCostUsd = 0;
    let totalFallbacks = 0;
    let totalCacheSavingsUsd = 0;

    for (const { sample, model, bucket } of this.buckets.values()) {
      totalRequests += bucket.requests;
      const est = bucket.cost.totalUsd();
      totalCostUsd += est;
      totalFallbacks += bucket.fallbacks;
      totalCacheSavingsUsd += bucket.cacheSavingsUsd;
      rows.push({
        capability: sample.capability,
        provider: sample.provider,
        model,
        promptVersion: sample.promptVersion,
        requests: bucket.requests,
        cacheHits: bucket.cacheHits,
        failures: bucket.failures,
        fallbacks: bucket.fallbacks,
        avgLatencyMs: bucket.latency.average(),
        lastLatencyMs: bucket.latency.lastMs(),
        totalTokens: bucket.totalTokens,
        estCostUsd: est,
        cacheSavingsUsd: Math.round(bucket.cacheSavingsUsd * 1e6) / 1e6,
      });
    }

    rows.sort(
      (a, b) =>
        a.capability.localeCompare(b.capability) ||
        a.provider.localeCompare(b.provider) ||
        a.model.localeCompare(b.model) ||
        a.promptVersion.localeCompare(b.promptVersion),
    );

    return {
      byCapabilityProvider: rows,
      totalRequests,
      totalCostUsd: Math.round(totalCostUsd * 1e6) / 1e6,
      totalFallbacks,
      totalCacheSavingsUsd: Math.round(totalCacheSavingsUsd * 1e6) / 1e6,
    };
  }

  reset(): void {
    this.buckets.clear();
  }
}

/** Shared process-local metrics sink (like `weatherMetrics`). */
export const aiRuntimeMetrics = new RuntimeMetrics();
