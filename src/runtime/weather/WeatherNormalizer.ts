/**
 * WeatherNormalizer (RFC-011; relocated from src/features/weather) — PURE mapping
 * of a raw provider response into the canonical {@link WeatherForecast}. No I/O;
 * deterministic. `conditionFor` is reused from the weather domain.
 */

import type { SeasonLabel, WeatherForecast, WeatherForecastDay } from "@/domain/weather";
import { conditionFor } from "@/domain/weather";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Month → season (northern hemisphere; flipped when latitude < 0). */
export function seasonFor(dateIso: string, latitude: number): SeasonLabel {
  const month = Number(dateIso.slice(5, 7)); // 1–12
  const northern: SeasonLabel[] = [
    "winter", "winter", "spring", "spring", "spring", "summer",
    "summer", "summer", "autumn", "autumn", "autumn", "winter",
  ];
  const idx = Math.max(0, Math.min(11, month - 1));
  return latitude < 0 ? northern[(idx + 6) % 12] : northern[idx];
}

interface OpenMeteoRaw {
  daily?: {
    time?: string[];
    temperature_2m_max?: (number | null)[];
    temperature_2m_min?: (number | null)[];
    precipitation_probability_max?: (number | null)[];
  };
}

/** Normalize an Open-Meteo daily response into a `WeatherForecast`. Pure. */
export function normalizeOpenMeteo(raw: OpenMeteoRaw, latitude: number): WeatherForecast {
  const daily = raw?.daily;
  if (!daily?.time || daily.time.length === 0) return { days: [], source: "forecast" };

  const days: WeatherForecastDay[] = daily.time.map((date, i) => {
    const highC = num(daily.temperature_2m_max?.[i]);
    const lowC = num(daily.temperature_2m_min?.[i]);
    const rainPct = num(daily.precipitation_probability_max?.[i]);
    const rainRisk = rainPct == null ? null : clamp01(rainPct / 100);
    const avg = highC != null && lowC != null ? (highC + lowC) / 2 : (highC ?? lowC);
    return {
      date,
      season: seasonFor(date, latitude),
      condition: conditionFor(avg, rainRisk),
      highC,
      lowC,
      rainRisk,
    };
  });
  return { days, source: "forecast" };
}

/** Build a forecast from user-entered days (the manual fallback). */
export function manualForecast(days: WeatherForecastDay[]): WeatherForecast {
  return { days, source: "manual" };
}
