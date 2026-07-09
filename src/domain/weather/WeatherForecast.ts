/**
 * Weather Forecast (RFC-011) — the full, canonical forecast produced by the
 * Weather Runtime and consumed by the Lifestyle Engine (per-day). Pure types.
 *
 * These types were previously defined in `@/domain/lifestyle/types`; they now
 * live here (weather is a first-class domain) and lifestyle re-exports them for
 * backward compatibility. The per-day `days[]` shape is unchanged; `current` /
 * `hourly` are reserved additive fields for a future richer forecast.
 */

import type { SeasonLabel, WeatherCondition, WeatherConditions } from "@/domain/weather/WeatherConditions";

/** Where the forecast came from. `forecast` (live) + `manual` supported now. */
export type WeatherSource = "forecast" | "manual" | "historical";

export interface WeatherForecastDay {
  date: string; // ISO date
  season: SeasonLabel;
  condition: WeatherCondition;
  highC: number | null;
  lowC: number | null;
  /** 0–1 chance of rain. */
  rainRisk: number | null;
}

export interface WeatherForecast {
  days: WeatherForecastDay[];
  source: WeatherSource;
  /** Reserved (FUTURE): richer current/hourly readings. Additive; unused today. */
  current?: WeatherConditions | null;
  hourly?: (WeatherConditions & { time: string })[];
}
