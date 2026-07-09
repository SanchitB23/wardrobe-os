/**
 * WeatherCache (RFC-011) — in-memory, TTL-based cache. Weather is ephemeral, so
 * there is NO database. Default TTL 60 minutes. Records hit/miss to the injected
 * metrics sink. Clock is injectable for deterministic tests.
 */

import type { WeatherForecast } from "@/domain/weather";
import type { WeatherMetrics } from "@/runtime/weather/WeatherMetrics";

export const WEATHER_CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

export interface WeatherCache {
  get(key: string): WeatherForecast | null;
  set(key: string, forecast: WeatherForecast): void;
  clear(): void;
  size(): number;
}

/** Deterministic cache key: provider + location + date range. */
export function weatherCacheKey(
  provider: string,
  location: string,
  startDate: string,
  endDate: string,
): string {
  return `${provider}::${location.trim().toLowerCase()}::${startDate}::${endDate}`;
}

export function createInMemoryWeatherCache(options: {
  ttlMs?: number;
  now?: () => number;
  metrics?: WeatherMetrics;
} = {}): WeatherCache {
  const ttlMs = options.ttlMs ?? WEATHER_CACHE_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const metrics = options.metrics;
  const store = new Map<string, { forecast: WeatherForecast; expiresAt: number }>();

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry || entry.expiresAt <= now()) {
        if (entry) store.delete(key);
        metrics?.recordMiss();
        return null;
      }
      metrics?.recordHit();
      return entry.forecast;
    },
    set(key, forecast) {
      store.set(key, { forecast, expiresAt: now() + ttlMs });
    },
    clear() {
      store.clear();
    },
    size() {
      return store.size;
    },
  };
}
