/**
 * WeatherSnapshot (RFC-011) — the NARROW, engine-facing projection of weather.
 * The Recommendation Engine consumes this (via `RecommendationContext.weather`),
 * NEVER the full `WeatherForecast`. Flat, minimal, provenance-tagged, pure.
 *
 * This is the canonical definition; `RecommendationContext` re-exports it so
 * `@/domain/recommendation` consumers keep working.
 */

import type { SeasonLabel, WeatherCondition } from "@/domain/recommendation";
import type { WeatherLabel } from "@/domain/weather/WeatherLabels";
import { deriveWeatherLabels } from "@/domain/weather/WeatherLabels";
import type { WeatherForecast } from "@/domain/weather/WeatherForecast";
import { forecastConfidence } from "@/domain/weather/WeatherConfidence";
import { SEASON_WEATHER, conditionFor, feelsLike, seasonForDate } from "@/domain/weather/WeatherUtils";

/** Where the snapshot's data came from. `seasonal_fallback` ⇒ the runtime was
 *  unavailable and the AI must say it used a seasonal estimate. */
export type WeatherSnapshotSource = "live" | "manual" | "seasonal_fallback";

export interface WeatherSnapshot {
  season: SeasonLabel;
  condition: WeatherCondition;
  temperatureC: number | null;
  feelsLikeC: number | null;
  /** 0–1 chance of rain. */
  rainRisk: number | null;
  /** Percentage 0–100. */
  humidity: number | null;
  windKph: number | null;
  uvIndex: number | null;
  labels: WeatherLabel[];
  /** 0–1 coverage/quality (not probability of correctness). */
  confidence: number;
  source: WeatherSnapshotSource;
}

/** Project the full forecast down to the snapshot for the requested day (or the
 *  first day). Pure and deterministic. */
export function toWeatherSnapshot(
  forecast: WeatherForecast,
  opts: { at?: string } = {},
): WeatherSnapshot {
  const day =
    (opts.at ? forecast.days.find((d) => d.date === opts.at) : undefined) ??
    forecast.days[0] ??
    null;

  const temperatureC =
    day && day.highC != null && day.lowC != null
      ? Math.round(((day.highC + day.lowC) / 2) * 10) / 10
      : (day?.highC ?? day?.lowC ?? null);
  const humidity = null; // per-day forecast carries no humidity; snapshot leaves it null
  const windKph = null;
  const feelsLikeC = feelsLike(temperatureC, humidity, windKph);
  const condition = day?.condition ?? conditionFor(temperatureC, day?.rainRisk ?? null);
  const source: WeatherSnapshotSource = forecast.source === "manual" ? "manual" : "live";

  const conditions = {
    temperatureC,
    feelsLikeC,
    condition,
    rainRisk: day?.rainRisk ?? null,
    humidity,
    windKph,
    uvIndex: null,
  };

  return {
    season: day?.season ?? seasonForDate(new Date(opts.at ?? Date.now())),
    condition,
    temperatureC,
    feelsLikeC,
    rainRisk: day?.rainRisk ?? null,
    humidity,
    windKph,
    uvIndex: null,
    labels: deriveWeatherLabels(conditions),
    confidence: forecastConfidence(forecast),
    source,
  };
}

/**
 * Deterministic seasonal fallback used when the Weather Runtime is unavailable.
 * Marked `source: "seasonal_fallback"` so the AI explains it used a seasonal
 * estimate — never invented values. (Replaces the old `deriveWeather` internals.)
 */
export function seasonalFallbackSnapshot(asOf: Date): WeatherSnapshot {
  const season = seasonForDate(asOf);
  const profile = SEASON_WEATHER[season];
  const rainRisk = profile.condition === "rainy" ? 0.7 : 0;
  const feelsLikeC = feelsLike(profile.temperatureC, profile.humidity, null);
  const conditions = {
    temperatureC: profile.temperatureC,
    feelsLikeC,
    condition: profile.condition,
    rainRisk,
    humidity: profile.humidity,
    windKph: null,
    uvIndex: null,
  };
  return {
    season,
    condition: profile.condition,
    temperatureC: profile.temperatureC,
    feelsLikeC,
    rainRisk,
    humidity: profile.humidity,
    windKph: null,
    uvIndex: null,
    labels: deriveWeatherLabels(conditions),
    confidence: 0.3,
    source: "seasonal_fallback",
  };
}
