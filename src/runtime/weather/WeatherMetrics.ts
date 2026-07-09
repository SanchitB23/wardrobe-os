/**
 * WeatherMetrics (RFC-011) — in-memory operational metrics for the Weather
 * Runtime (no DB). Surfaced in Developer Mode. Tracks cache hit/miss, provider,
 * latency, and provider errors.
 */

export interface WeatherMetricsSnapshot {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  providerErrors: number;
  lastProvider: string | null;
  lastLatencyMs: number | null;
  avgLatencyMs: number | null;
}

export interface WeatherMetrics {
  recordHit(): void;
  recordMiss(): void;
  recordFetch(provider: string, latencyMs: number, ok: boolean): void;
  snapshot(): WeatherMetricsSnapshot;
  reset(): void;
}

export function createWeatherMetrics(): WeatherMetrics {
  let totalRequests = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let providerErrors = 0;
  let lastProvider: string | null = null;
  let lastLatencyMs: number | null = null;
  let latencySum = 0;
  let latencyCount = 0;

  return {
    recordHit() {
      totalRequests += 1;
      cacheHits += 1;
    },
    recordMiss() {
      totalRequests += 1;
      cacheMisses += 1;
    },
    recordFetch(provider, latencyMs, ok) {
      lastProvider = provider;
      lastLatencyMs = latencyMs;
      latencySum += latencyMs;
      latencyCount += 1;
      if (!ok) providerErrors += 1;
    },
    snapshot() {
      return {
        totalRequests,
        cacheHits,
        cacheMisses,
        providerErrors,
        lastProvider,
        lastLatencyMs,
        avgLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : null,
      };
    },
    reset() {
      totalRequests = cacheHits = cacheMisses = providerErrors = 0;
      lastProvider = lastLatencyMs = null;
      latencySum = latencyCount = 0;
    },
  };
}

/** Process-wide singleton (single-user app; no DB). */
export const weatherMetrics = createWeatherMetrics();
