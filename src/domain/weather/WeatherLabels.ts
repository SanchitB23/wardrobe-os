/**
 * Weather Labels (RFC-011) — a deterministic, enum-style vocabulary. NEVER
 * free-form strings. Derived purely from normalized conditions so the same
 * inputs always yield the same labels. Pure; no I/O.
 */

import type { WeatherConditions } from "@/domain/weather/WeatherConditions";

export type WeatherLabel =
  | "HOT"
  | "WARM"
  | "MILD"
  | "COOL"
  | "COLD"
  | "RAINY"
  | "HUMID"
  | "WINDY"
  | "SUNNY"
  | "LAYER_REQUIRED"
  | "LIGHTWEIGHT"
  | "WATERPROOF"
  | "FORMAL_SAFE"
  | "SNEAKER_SAFE";

export const WEATHER_LABELS: readonly WeatherLabel[] = [
  "HOT", "WARM", "MILD", "COOL", "COLD",
  "RAINY", "HUMID", "WINDY", "SUNNY",
  "LAYER_REQUIRED", "LIGHTWEIGHT", "WATERPROOF",
  "FORMAL_SAFE", "SNEAKER_SAFE",
] as const;

/** Thresholds — documented so the mapping is auditable and stable. */
const HOT_C = 30;
const WARM_C = 24;
const MILD_C = 16;
const COOL_C = 8;
const HUMID_PCT = 70; // humidity is a percentage (existing WeatherSnapshot semantics)
const WINDY_KPH = 25;
const RAIN_RISK = 0.5;

/**
 * Deterministic label set for a set of conditions. Order is stable (temperature
 * band first, then modifiers). Returns a de-duplicated, canonically-ordered list.
 */
export function deriveWeatherLabels(conditions: WeatherConditions): WeatherLabel[] {
  const labels = new Set<WeatherLabel>();
  const temp = conditions.feelsLikeC ?? conditions.temperatureC;

  // Temperature band (feels-like preferred).
  if (temp != null) {
    if (temp >= HOT_C) labels.add("HOT");
    else if (temp >= WARM_C) labels.add("WARM");
    else if (temp >= MILD_C) labels.add("MILD");
    else if (temp >= COOL_C) labels.add("COOL");
    else labels.add("COLD");
  } else if (conditions.condition === "hot") labels.add("HOT");
  else if (conditions.condition === "warm") labels.add("WARM");
  else if (conditions.condition === "mild") labels.add("MILD");
  else if (conditions.condition === "cool") labels.add("COOL");
  else if (conditions.condition === "cold") labels.add("COLD");

  // Precipitation.
  const rainy = conditions.condition === "rainy" || (conditions.rainRisk ?? 0) >= RAIN_RISK;
  if (rainy) {
    labels.add("RAINY");
    labels.add("WATERPROOF");
  } else if (temp != null && temp >= MILD_C) {
    labels.add("SUNNY");
  }

  // Modifiers.
  if ((conditions.humidity ?? 0) >= HUMID_PCT) labels.add("HUMID");
  if ((conditions.windKph ?? 0) >= WINDY_KPH) labels.add("WINDY");

  // Outfit-planning hints (deterministic from the band).
  if (labels.has("COLD") || labels.has("COOL")) labels.add("LAYER_REQUIRED");
  if (labels.has("HOT") || labels.has("WARM")) labels.add("LIGHTWEIGHT");
  if (!rainy) labels.add("SNEAKER_SAFE");
  if (!rainy && !labels.has("HOT")) labels.add("FORMAL_SAFE");

  // Canonical order (matches WEATHER_LABELS) for determinism.
  return WEATHER_LABELS.filter((label) => labels.has(label));
}
