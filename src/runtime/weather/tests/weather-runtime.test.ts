import { describe, expect, it, vi } from "vitest";

import type { WeatherForecast } from "@/domain/weather";
import { WeatherRuntime } from "@/runtime/weather/WeatherRuntime";
import { createInMemoryWeatherCache, weatherCacheKey } from "@/runtime/weather/WeatherCache";
import { createWeatherMetrics } from "@/runtime/weather/WeatherMetrics";
import { manualForecast, normalizeOpenMeteo, seasonFor } from "@/runtime/weather/WeatherNormalizer";
import type { WeatherProvider } from "@/runtime/weather/WeatherProvider";

const FORECAST: WeatherForecast = {
  source: "forecast",
  days: [
    { date: "2026-07-01", season: "monsoon", condition: "rainy", highC: 33, lowC: 27, rainRisk: 0.7 },
  ],
};

function fakeProvider(id: string, impl: () => Promise<WeatherForecast>): WeatherProvider {
  return { id, forecast: impl };
}

const query = { location: "Delhi", startDate: "2026-07-01", endDate: "2026-07-01", at: "2026-07-01" };

describe("WeatherNormalizer", () => {
  it("normalizes an Open-Meteo daily response", () => {
    const forecast = normalizeOpenMeteo(
      {
        daily: {
          time: ["2026-07-01"],
          temperature_2m_max: [34],
          temperature_2m_min: [26],
          precipitation_probability_max: [70],
        },
      },
      28.6,
    );
    expect(forecast.source).toBe("forecast");
    expect(forecast.days[0].condition).toBe("rainy");
    expect(forecast.days[0].rainRisk).toBeCloseTo(0.7);
  });

  it("seasonFor flips hemisphere below the equator", () => {
    expect(seasonFor("2026-07-01", 28.6)).toBe("summer"); // northern July
    expect(seasonFor("2026-07-01", -33.9)).toBe("winter"); // southern July
  });

  it("manualForecast tags source=manual", () => {
    expect(manualForecast(FORECAST.days).source).toBe("manual");
  });
});

describe("WeatherRuntime", () => {
  it("fetches, then serves from cache (hit/miss metrics)", async () => {
    const metrics = createWeatherMetrics();
    const provider = fakeProvider("open-meteo", vi.fn(async () => FORECAST));
    const cache = createInMemoryWeatherCache({ now: () => 1000, metrics });
    const rt = new WeatherRuntime({ provider, cache, metrics, now: () => 1000 });

    const first = await rt.getForecast(query);
    expect(first.data).toEqual(FORECAST);
    expect(first.meta.cached).toBe(false);

    const second = await rt.getForecast(query);
    expect(second.meta.cached).toBe(true);
    expect(provider.forecast).toHaveBeenCalledTimes(1);

    const snap = metrics.snapshot();
    expect(snap.cacheMisses).toBe(1);
    expect(snap.cacheHits).toBe(1);
  });

  it("re-fetches after the TTL expires", () => {
    // Cache-level TTL check (deterministic clock).
    let t = 0;
    const cache = createInMemoryWeatherCache({ ttlMs: 1000, now: () => t });
    const key = weatherCacheKey("open-meteo", "Delhi", "2026-07-01", "2026-07-01");
    cache.set(key, FORECAST);
    expect(cache.get(key)).toEqual(FORECAST);
    t = 1001;
    expect(cache.get(key)).toBeNull();
  });

  it("never throws — provider failure returns { data: null, error }", async () => {
    const provider = fakeProvider("open-meteo", async () => {
      throw new Error("network down");
    });
    const rt = new WeatherRuntime({ provider, now: () => 1000 });
    const result = await rt.getForecast(query);
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });

  it("getSnapshot falls back to a seasonal snapshot on failure (never blocks)", async () => {
    const provider = fakeProvider("open-meteo", async () => {
      throw new Error("network down");
    });
    const rt = new WeatherRuntime({ provider, now: () => Date.parse("2026-07-01T00:00:00Z") });
    const { snapshot, error } = await rt.getSnapshot(query);
    expect(error).toBeInstanceOf(Error);
    expect(snapshot.source).toBe("seasonal_fallback");
    expect(snapshot.season).toBe("monsoon");
  });

  it("getSnapshot projects a live snapshot on success", async () => {
    const provider = fakeProvider("open-meteo", async () => FORECAST);
    const rt = new WeatherRuntime({ provider, now: () => 1000 });
    const { snapshot } = await rt.getSnapshot(query);
    expect(snapshot.source).toBe("live");
    expect(snapshot.condition).toBe("rainy");
  });

  it("is deterministic for the same query + provider", async () => {
    const provider = fakeProvider("open-meteo", async () => FORECAST);
    const rt = new WeatherRuntime({ provider, now: () => 1000 });
    const a = await rt.getSnapshot(query);
    const b = await rt.getSnapshot(query);
    expect(a.snapshot).toEqual(b.snapshot);
  });

  it("uses the injected provider's id", () => {
    const rt = new WeatherRuntime({ provider: fakeProvider("manual", async () => FORECAST) });
    expect(rt.providerId).toBe("manual");
  });
});
