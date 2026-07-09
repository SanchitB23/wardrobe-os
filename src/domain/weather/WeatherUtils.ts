/**
 * Weather utilities (RFC-011) — pure, deterministic helpers shared by the
 * normalizer, snapshot projection, and seasonal fallback. No I/O.
 *
 * `SEASON_BY_MONTH` / `SEASON_WEATHER` moved here from
 * `RecommendationContextBuilder` (they were the old `deriveWeather` internals).
 */

import type { SeasonLabel, WeatherCondition } from "@/domain/weather/WeatherConditions";

/** Delhi-NCR calendar → season (0 = Jan). */
export const SEASON_BY_MONTH: readonly SeasonLabel[] = [
  "winter", // Jan
  "winter", // Feb
  "spring", // Mar
  "spring", // Apr
  "summer", // May
  "summer", // Jun
  "monsoon", // Jul
  "monsoon", // Aug
  "monsoon", // Sep
  "autumn", // Oct
  "autumn", // Nov
  "winter", // Dec
];

/** Seasonal climate profile — the deterministic fallback when live weather is
 *  unavailable. Humidity is a percentage (0–100). */
export const SEASON_WEATHER: Record<
  SeasonLabel,
  { condition: WeatherCondition; temperatureC: number; humidity: number }
> = {
  summer: { condition: "hot", temperatureC: 38, humidity: 45 },
  monsoon: { condition: "rainy", temperatureC: 32, humidity: 80 },
  autumn: { condition: "mild", temperatureC: 28, humidity: 55 },
  winter: { condition: "cool", temperatureC: 15, humidity: 50 },
  spring: { condition: "warm", temperatureC: 30, humidity: 50 },
};

/** Season for a Date (UTC month). Deterministic. */
export function seasonForDate(asOf: Date): SeasonLabel {
  const month = Number.isNaN(asOf.getTime()) ? 0 : asOf.getUTCMonth();
  return SEASON_BY_MONTH[month] ?? "summer";
}

/** Deterministic condition band from average temperature + rain risk. */
export function conditionFor(avgC: number | null, rainRisk: number | null): WeatherCondition {
  if (rainRisk != null && rainRisk >= 0.5) return "rainy";
  if (avgC == null) return "mild";
  if (avgC >= 30) return "hot";
  if (avgC >= 24) return "warm";
  if (avgC >= 16) return "mild";
  if (avgC >= 8) return "cool";
  return "cold";
}

/**
 * Approximate "feels like" — a light, deterministic blend: heat index bump when
 * hot + humid, wind chill when cold + windy. Not a meteorological model; enough
 * to nudge labels/scoring consistently.
 */
export function feelsLike(
  temperatureC: number | null,
  humidityPct: number | null,
  windKph: number | null,
): number | null {
  if (temperatureC == null) return null;
  let t = temperatureC;
  if (temperatureC >= 27 && (humidityPct ?? 0) >= 60) {
    t += ((humidityPct as number) - 60) / 20; // up to ~+2°C in muggy heat
  }
  if (temperatureC <= 10 && (windKph ?? 0) >= 15) {
    t -= Math.min(5, ((windKph as number) - 15) / 6); // up to ~-5°C wind chill
  }
  return Math.round(t * 10) / 10;
}
