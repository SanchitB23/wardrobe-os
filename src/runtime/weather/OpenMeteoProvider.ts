/**
 * OpenMeteoProvider (RFC-011; relocated from src/features/weather) — the concrete
 * WeatherProvider backed by the key-free Open-Meteo APIs (geocoding + daily
 * forecast). Server-side I/O only; mapping is delegated to the pure normalizer.
 */

import type { WeatherForecast } from "@/domain/weather";
import type { WeatherProvider } from "@/runtime/weather/WeatherProvider";
import type { WeatherQuery } from "@/runtime/weather/types";
import { normalizeOpenMeteo } from "@/runtime/weather/WeatherNormalizer";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

async function geocode(destination: string): Promise<{ latitude: number; longitude: number }> {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(destination)}&count=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status}).`);
  const json = (await res.json()) as { results?: { latitude: number; longitude: number }[] };
  const hit = json.results?.[0];
  if (!hit) throw new Error(`Could not locate "${destination}".`);
  return { latitude: hit.latitude, longitude: hit.longitude };
}

export class OpenMeteoProvider implements WeatherProvider {
  readonly id = "open-meteo";

  async forecast(query: WeatherQuery): Promise<WeatherForecast> {
    const { latitude, longitude } = await geocode(query.location);
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "UTC",
      start_date: query.startDate,
      end_date: query.endDate,
    });
    const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`Forecast fetch failed (${res.status}).`);
    return normalizeOpenMeteo(await res.json(), latitude);
  }
}

export const openMeteoProvider = new OpenMeteoProvider();
