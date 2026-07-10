/**
 * AI Runtime v2 (RFC-014) — in-memory metrics sink.
 *
 * Records latency, cost, tokens, cache-hit, and failure per
 * provider × capability × prompt version (mirroring WeatherMetrics from
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
  totalTokens: number;
  latency: LatencyTracker;
  cost: CostTracker;
}

function newBucket(): Bucket {
  return {
    requests: 0,
    cacheHits: 0,
    failures: 0,
    totalTokens: 0,
    latency: new LatencyTracker(),
    cost: new CostTracker(),
  };
}

export class RuntimeMetrics {
  private readonly buckets = new Map<string, { sample: MetricSample; bucket: Bucket }>();

  private keyOf(s: Pick<MetricSample, "capability" | "provider" | "promptVersion">): string {
    return `${s.capability}|${s.provider}|${s.promptVersion}`;
  }

  record(sample: MetricSample): void {
    const key = this.keyOf(sample);
    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { sample, bucket: newBucket() };
      this.buckets.set(key, entry);
    }
    const { bucket } = entry;
    bucket.requests += 1;
    if (sample.cacheHit) bucket.cacheHits += 1;
    if (!sample.ok) bucket.failures += 1;
    bucket.totalTokens += sample.usage?.totalTokens ?? 0;
    bucket.latency.record(sample.latencyMs);
    bucket.cost.add(sample.costUsd);
  }

  snapshot(): AIRuntimeMetricsSnapshot {
    const rows: MetricRow[] = [];
    let totalRequests = 0;
    let totalCostUsd = 0;

    for (const { sample, bucket } of this.buckets.values()) {
      totalRequests += bucket.requests;
      totalCostUsd += bucket.cost.totalUsd();
      rows.push({
        capability: sample.capability,
        provider: sample.provider,
        promptVersion: sample.promptVersion,
        requests: bucket.requests,
        cacheHits: bucket.cacheHits,
        failures: bucket.failures,
        avgLatencyMs: bucket.latency.average(),
        lastLatencyMs: bucket.latency.lastMs(),
        totalTokens: bucket.totalTokens,
        estCostUsd: bucket.cost.totalUsd(),
      });
    }

    rows.sort(
      (a, b) =>
        a.capability.localeCompare(b.capability) ||
        a.provider.localeCompare(b.provider) ||
        a.promptVersion.localeCompare(b.promptVersion),
    );

    return {
      byCapabilityProvider: rows,
      totalRequests,
      totalCostUsd: Math.round(totalCostUsd * 1e6) / 1e6,
    };
  }

  reset(): void {
    this.buckets.clear();
  }
}

/** Shared process-local metrics sink (like `weatherMetrics`). */
export const aiRuntimeMetrics = new RuntimeMetrics();
