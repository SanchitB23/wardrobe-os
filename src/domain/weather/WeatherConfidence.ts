/**
 * Weather confidence (RFC-011) — a pure 0..1 coverage/quality score for a
 * forecast. NOT a probability of correctness; it reflects how much real data
 * backs the forecast. The AI must never present it as certainty.
 */

import type { WeatherForecast } from "@/domain/weather/WeatherForecast";

/** Fraction of forecast days that carry real temperature data, lightly weighted
 *  down for manual entry. Deterministic. */
export function forecastConfidence(forecast: WeatherForecast): number {
  const days = forecast.days;
  if (days.length === 0) return 0;
  const withData = days.filter((d) => d.highC != null || d.lowC != null).length;
  const coverage = withData / days.length;
  const providerFactor = forecast.source === "forecast" ? 1 : forecast.source === "manual" ? 0.7 : 0.4;
  return Math.round(coverage * providerFactor * 100) / 100;
}
