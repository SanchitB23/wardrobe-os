/**
 * OpenMeteoProvider (RFC-006) — the concrete WeatherProvider backed by the
 * key-free Open-Meteo APIs (geocoding + daily forecast). Server-side I/O only;
 * all mapping is delegated to the pure WeatherNormalizer. If geocoding fails, it
 * throws — callers fall back to manual weather entry.
 */

import type { WeatherForecast } from "@/domain/lifestyle";
import type { WeatherProvider } from "@/features/weather/provider/WeatherProvider";
import { normalizeOpenMeteo } from "@/features/weather/provider/WeatherNormalizer";

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

  async forecast(
    destination: string,
    startDate: string,
    endDate: string,
  ): Promise<WeatherForecast> {
    const { latitude, longitude } = await geocode(destination);
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      timezone: "UTC",
      start_date: startDate,
      end_date: endDate,
    });
    const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(`Forecast fetch failed (${res.status}).`);
    return normalizeOpenMeteo(await res.json(), latitude);
  }
}

export const openMeteoProvider = new OpenMeteoProvider();
