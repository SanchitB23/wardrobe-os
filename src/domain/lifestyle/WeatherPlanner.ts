/**
 * WeatherPlanner (RFC-006) — maps a normalized WeatherForecast onto the
 * per-day weather the recommendation engine understands. Pure; the forecast is
 * an input (fetched by a provider), never predicted here.
 */

import type { WeatherSnapshot } from "@/domain/recommendation";
import { toWeatherSnapshot as projectSnapshot } from "@/domain/weather";
import type { WeatherForecast, WeatherForecastDay } from "@/domain/lifestyle/types";

/**
 * Seasonal estimate when the forecast has no entry for a date — e.g. a trip
 * beyond the ~16-day live-forecast horizon. Derived from the month (India-
 * centred calendar: Jun–Sep is monsoon), which is honest enough to plan
 * against; the old constant "summer, mild" claimed sunshine for August in Goa.
 */
export function fallbackDay(date: string): WeatherForecastDay {
  const month = Number(date.slice(5, 7));
  const base = { date, highC: null, lowC: null, rainRisk: null };
  if (month === 12 || month <= 2) return { ...base, season: "winter", condition: "cool" };
  if (month <= 5) return { ...base, season: "summer", condition: "hot" };
  if (month <= 9) return { ...base, season: "monsoon", condition: "rainy", rainRisk: 0.6 };
  return { ...base, season: "autumn", condition: "mild" };
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
