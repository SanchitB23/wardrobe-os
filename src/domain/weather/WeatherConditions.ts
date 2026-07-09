/**
 * Weather Conditions (RFC-011) — the normalized, point-in-time reading a forecast
 * is built from. Pure types. `SeasonLabel` / `WeatherCondition` remain owned by
 * the recommendation context (their vocabulary is shared app-wide); they are
 * re-exported here so `@/domain/weather` is the one place to import weather types.
 */

import type { SeasonLabel, WeatherCondition } from "@/domain/recommendation";

export type { SeasonLabel, WeatherCondition };

export interface WeatherConditions {
  temperatureC: number | null;
  feelsLikeC: number | null;
  condition: WeatherCondition;
  /** 0–1 chance of rain. */
  rainRisk: number | null;
  /** Percentage 0–100 (matches the existing WeatherSnapshot semantics). */
  humidity: number | null;
  windKph: number | null;
  uvIndex: number | null;
}
