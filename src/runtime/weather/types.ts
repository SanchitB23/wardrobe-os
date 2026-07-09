/**
 * Weather Runtime types (RFC-011). The runtime is the app's single deterministic
 * weather source: it selects a provider, fetches, normalizes, caches, and hands
 * back a `WeatherForecast` (+ a projected `WeatherSnapshot`). It never decides
 * (recommendation does) and never invents weather (AI does not).
 */

import type { WeatherForecast, WeatherForecastDay, WeatherSnapshot } from "@/domain/weather";

export type WeatherProviderId = "open-meteo" | "manual" | "weatherapi" | "tomorrow";

/** A request for weather over a location + date range. */
export interface WeatherQuery {
  location: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  /** The day the snapshot should represent (defaults to startDate). */
  at?: string;
  /** For the manual provider — user-entered days. */
  manualDays?: WeatherForecastDay[];
}

export interface WeatherRequestMeta {
  provider: WeatherProviderId | string;
  cached: boolean;
  latencyMs: number;
}

/** Runtime forecast result — never throws; errors are returned. */
export interface WeatherForecastResult {
  data: WeatherForecast | null;
  error: Error | null;
  meta: WeatherRequestMeta;
}

/** Runtime snapshot result — `snapshot` is ALWAYS present (seasonal fallback on
 *  error), so recommendation never blocks. `error` records what went wrong. */
export interface WeatherSnapshotResult {
  snapshot: WeatherSnapshot;
  error: Error | null;
  meta: WeatherRequestMeta;
}
