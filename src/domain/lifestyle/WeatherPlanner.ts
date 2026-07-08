/**
 * WeatherPlanner (RFC-006) — maps a normalized WeatherForecast onto the
 * per-day weather the recommendation engine understands. Pure; the forecast is
 * an input (fetched by a provider), never predicted here.
 */

import type { WeatherSnapshot } from "@/domain/recommendation";
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

/** Project a forecast day onto the RecommendationContext weather snapshot. */
export function toWeatherSnapshot(day: WeatherForecastDay): WeatherSnapshot {
  const temps = [day.highC, day.lowC].filter((n): n is number => typeof n === "number");
  const temperatureC = temps.length > 0 ? Math.round(temps.reduce((a, b) => a + b, 0) / temps.length) : null;
  return { season: day.season, condition: day.condition, temperatureC, humidity: null };
}
