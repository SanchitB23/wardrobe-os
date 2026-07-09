/**
 * WeatherPlanner (RFC-006) — maps a normalized WeatherForecast onto the
 * per-day weather the recommendation engine understands. Pure; the forecast is
 * an input (fetched by a provider), never predicted here.
 */

import type { WeatherSnapshot } from "@/domain/recommendation";
import { toWeatherSnapshot as projectSnapshot } from "@/domain/weather";
import type { WeatherForecast, WeatherForecastDay } from "@/domain/lifestyle/types";

/** Neutral fallback when the forecast has no entry for a date. */
export function fallbackDay(date: string): WeatherForecastDay {
  return { date, season: "summer", condition: "mild", highC: null, lowC: null, rainRisk: null };
}

export function weatherForDate(
  forecast: WeatherForecast,
  date: string,
): WeatherForecastDay | null {
  return forecast.days.find((d) => d.date === date) ?? null;
}

/** Project a forecast day onto the RecommendationContext weather snapshot.
 *  Delegates to the weather domain so the snapshot carries the full, enriched
 *  fields (feelsLike / rainRisk / labels / confidence / source) — RFC-011. */
export function toWeatherSnapshot(day: WeatherForecastDay): WeatherSnapshot {
  return projectSnapshot({ days: [day], source: "forecast" }, { at: day.date });
}
