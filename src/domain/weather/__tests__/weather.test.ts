import { describe, expect, it } from "vitest";

import {
  deriveWeatherLabels,
  forecastConfidence,
  seasonalFallbackSnapshot,
  toWeatherSnapshot,
  type WeatherForecast,
} from "@/domain/weather";

describe("deriveWeatherLabels", () => {
  it("is deterministic and enum-only (hot + humid + windy)", () => {
    const labels = deriveWeatherLabels({
      temperatureC: 34, feelsLikeC: 36, condition: "hot",
      rainRisk: 0, humidity: 75, windKph: 30, uvIndex: 9,
    });
    expect(labels).toEqual(["HOT", "HUMID", "WINDY", "SUNNY", "LIGHTWEIGHT", "SNEAKER_SAFE"]);
  });

  it("rainy adds RAINY + WATERPROOF and drops sneaker/formal safety", () => {
    const labels = deriveWeatherLabels({
      temperatureC: 18, feelsLikeC: 18, condition: "rainy",
      rainRisk: 0.8, humidity: 60, windKph: 5, uvIndex: 2,
    });
    expect(labels).toContain("RAINY");
    expect(labels).toContain("WATERPROOF");
    expect(labels).not.toContain("SNEAKER_SAFE");
  });

  it("cold adds LAYER_REQUIRED", () => {
    const labels = deriveWeatherLabels({
      temperatureC: 4, feelsLikeC: 2, condition: "cold",
      rainRisk: 0, humidity: 40, windKph: 10, uvIndex: 1,
    });
    expect(labels).toContain("COLD");
    expect(labels).toContain("LAYER_REQUIRED");
  });
});

const forecast: WeatherForecast = {
  source: "forecast",
  days: [
    { date: "2026-07-01", season: "monsoon", condition: "rainy", highC: 34, lowC: 26, rainRisk: 0.7 },
    { date: "2026-07-02", season: "monsoon", condition: "warm", highC: 33, lowC: 27, rainRisk: 0.2 },
  ],
};

describe("toWeatherSnapshot", () => {
  it("projects the requested day, averages temp, tags source=live", () => {
    const snap = toWeatherSnapshot(forecast, { at: "2026-07-01" });
    expect(snap.season).toBe("monsoon");
    expect(snap.condition).toBe("rainy");
    expect(snap.temperatureC).toBe(30);
    expect(snap.source).toBe("live");
    expect(snap.labels).toContain("RAINY");
  });

  it("falls back to the first day when `at` is absent", () => {
    expect(toWeatherSnapshot(forecast).temperatureC).toBe(30);
  });

  it("marks manual forecasts as source=manual", () => {
    expect(toWeatherSnapshot({ ...forecast, source: "manual" }).source).toBe("manual");
  });
});

describe("seasonalFallbackSnapshot", () => {
  it("is deterministic, low-confidence, and flagged seasonal_fallback", () => {
    const july = seasonalFallbackSnapshot(new Date("2026-07-15T00:00:00Z"));
    expect(july.season).toBe("monsoon");
    expect(july.condition).toBe("rainy");
    expect(july.source).toBe("seasonal_fallback");
    expect(july.confidence).toBeLessThan(0.5);
    expect(seasonalFallbackSnapshot(new Date("2026-07-15T00:00:00Z"))).toEqual(july);
  });

  it("maps January to winter/cool", () => {
    const jan = seasonalFallbackSnapshot(new Date("2026-01-10T00:00:00Z"));
    expect(jan.season).toBe("winter");
    expect(jan.condition).toBe("cool");
  });
});

describe("forecastConfidence", () => {
  it("is 0 for an empty forecast and high for full live coverage", () => {
    expect(forecastConfidence({ source: "forecast", days: [] })).toBe(0);
    expect(forecastConfidence(forecast)).toBe(1);
  });
});
