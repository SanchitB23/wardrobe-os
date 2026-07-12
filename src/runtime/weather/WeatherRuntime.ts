/**
 * WeatherRuntime (RFC-011) — the single deterministic weather source. Selects a
 * provider, checks the cache, fetches + normalizes, caches, records metrics, and
 * returns `{ data, error }`. NEVER throws. It performs no recommendation and no
 * AI; it only produces weather data.
 *
 * Emits lightweight `weather_request` JSON lines via console (same shape as
 * RFC-022) without importing `src/runtime/logging` — this module is shared with
 * client bundles that cannot pull `async_hooks` / ALS.
 *
 *   getForecast → full WeatherForecast (for Lifestyle)
 *   getSnapshot → narrow WeatherSnapshot for Recommendation; ALWAYS present
 *                 (seasonal fallback on failure, source: "seasonal_fallback"),
 *                 so recommendation never blocks and AI can explain the fallback.
 */

import { seasonalFallbackSnapshot, toWeatherSnapshot } from "@/domain/weather";
import { OpenMeteoProvider } from "@/runtime/weather/OpenMeteoProvider";
import { ManualWeatherProvider } from "@/runtime/weather/ManualWeatherProvider";
import { TomorrowProvider, WeatherApiProvider } from "@/runtime/weather/StubProviders";
import type { WeatherProvider } from "@/runtime/weather/WeatherProvider";
import {
  createInMemoryWeatherCache,
  weatherCacheKey,
  type WeatherCache,
} from "@/runtime/weather/WeatherCache";
import {
  createWeatherMetrics,
  weatherMetrics as sharedMetrics,
  type WeatherMetrics,
} from "@/runtime/weather/WeatherMetrics";
import type {
  WeatherForecastResult,
  WeatherProviderId,
  WeatherQuery,
  WeatherSnapshotResult,
} from "@/runtime/weather/types";

export const DEFAULT_WEATHER_PROVIDER: WeatherProviderId = "open-meteo";

export type WeatherRequestObserveEvent = {
  provider: string;
  cached: boolean;
  latencyMs: number;
  status: "ok" | "error" | "cache_hit";
  errorCode?: string | null;
  locationHint?: string | null;
};

function locationHint(query: WeatherQuery): string {
  return (query.location || "unknown").slice(0, 48);
}

function requestsLoggingEnabled(): boolean {
  const raw = (typeof process !== "undefined" ? process.env.LOG_REQUESTS : undefined) ?? "true";
  const v = raw.toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

/**
 * Structured weather_request emit without importing the Logging Runtime
 * (keeps this module client-bundle-safe).
 */
function emitWeatherRequest(event: WeatherRequestObserveEvent): void {
  if (!requestsLoggingEnabled()) return;
  let requestId: string | null = null;
  try {
    requestId = globalThis.__wardrobeGetRequestId?.() ?? null;
  } catch {
    requestId = null;
  }
  const line = JSON.stringify({
    kind: "weather_request",
    level: event.status === "error" ? "warn" : "info",
    message: `weather_request ${event.provider} ${event.status}${event.cached ? " cached" : ""}`,
    source: "weather_runtime",
    requestId,
    timestamp: new Date().toISOString(),
    provider: event.provider,
    cached: event.cached,
    latencyMs: event.latencyMs,
    status: event.status,
    errorCode: event.errorCode ?? null,
    locationHint: event.locationHint ?? null,
  });
  if (event.status === "error") console.warn(line);
  else console.log(line);
}

function buildProvider(id: string): WeatherProvider {
  switch (id) {
    case "manual":
      return new ManualWeatherProvider();
    case "weatherapi":
      return new WeatherApiProvider();
    case "tomorrow":
      return new TomorrowProvider();
    case "open-meteo":
    default:
      return new OpenMeteoProvider();
  }
}

export interface WeatherRuntimeOptions {
  provider?: WeatherProvider;
  cache?: WeatherCache;
  metrics?: WeatherMetrics;
  now?: () => number;
  /** Optional observer (tests / custom sinks). Default emits console JSON. */
  onRequest?: (event: WeatherRequestObserveEvent) => void;
}

export class WeatherRuntime {
  private readonly provider: WeatherProvider;
  private readonly cache: WeatherCache;
  private readonly metrics: WeatherMetrics;
  private readonly now: () => number;
  private readonly onRequest: (event: WeatherRequestObserveEvent) => void;

  constructor(options: WeatherRuntimeOptions = {}) {
    const providerId = process.env.WEATHER_PROVIDER ?? DEFAULT_WEATHER_PROVIDER;
    this.provider = options.provider ?? buildProvider(providerId);
    this.metrics = options.metrics ?? sharedMetrics;
    this.now = options.now ?? (() => Date.now());
    this.onRequest = options.onRequest ?? emitWeatherRequest;
    this.cache =
      options.cache ?? createInMemoryWeatherCache({ now: this.now, metrics: this.metrics });
  }

  get providerId(): string {
    return this.provider.id;
  }

  /** Fetch a full forecast. Never throws — errors are returned. */
  async getForecast(query: WeatherQuery): Promise<WeatherForecastResult> {
    const started = this.now();
    const key = weatherCacheKey(this.provider.id, query.location, query.startDate, query.endDate);
    const hint = locationHint(query);

    const cached = this.cache.get(key);
    if (cached) {
      this.onRequest({
        provider: this.provider.id,
        cached: true,
        latencyMs: 0,
        status: "cache_hit",
        locationHint: hint,
      });
      return { data: cached, error: null, meta: { provider: this.provider.id, cached: true, latencyMs: 0 } };
    }

    try {
      const forecast = await this.provider.forecast(query);
      const latencyMs = this.now() - started;
      this.metrics.recordFetch(this.provider.id, latencyMs, true);
      this.cache.set(key, forecast);
      this.onRequest({
        provider: this.provider.id,
        cached: false,
        latencyMs,
        status: "ok",
        locationHint: hint,
      });
      return { data: forecast, error: null, meta: { provider: this.provider.id, cached: false, latencyMs } };
    } catch (error) {
      const latencyMs = this.now() - started;
      this.metrics.recordFetch(this.provider.id, latencyMs, false);
      const err = error instanceof Error ? error : new Error(String(error));
      this.onRequest({
        provider: this.provider.id,
        cached: false,
        latencyMs,
        status: "error",
        errorCode: err.name || "weather_error",
        locationHint: hint,
      });
      return {
        data: null,
        error: err,
        meta: { provider: this.provider.id, cached: false, latencyMs },
      };
    }
  }

  /**
   * Project a `WeatherSnapshot` for recommendation. Always returns a snapshot:
   * on any failure it uses `seasonalFallbackSnapshot` (source: "seasonal_fallback")
   * so recommendation never blocks and the AI can explain the estimate.
   */
  async getSnapshot(query: WeatherQuery): Promise<WeatherSnapshotResult> {
    const result = await this.getForecast(query);
    if (result.data && result.data.days.length > 0) {
      return {
        snapshot: toWeatherSnapshot(result.data, { at: query.at ?? query.startDate }),
        error: null,
        meta: result.meta,
      };
    }
    const asOf = new Date(query.at ?? query.startDate ?? this.now());
    return {
      snapshot: seasonalFallbackSnapshot(Number.isNaN(asOf.getTime()) ? new Date(this.now()) : asOf),
      error: result.error,
      meta: result.meta,
    };
  }

  metricsSnapshot() {
    return this.metrics.snapshot();
  }
}

/** Shared runtime instance (single-user app). Tests construct their own. */
export const weatherRuntime = new WeatherRuntime();

export { createWeatherMetrics };
