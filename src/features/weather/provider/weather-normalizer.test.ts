import { describe, expect, it } from "vitest";

import {
  conditionFor,
  manualForecast,
  normalizeOpenMeteo,
  seasonFor,
} from "@/features/weather/provider/WeatherNormalizer";

describe("WeatherNormalizer", () => {
  it("maps temperature + rain to a condition band", () => {
    expect(conditionFor(32, 0)).toBe("hot");
    expect(conditionFor(26, 0.1)).toBe("warm");
    expect(conditionFor(18, 0)).toBe("mild");
    expect(conditionFor(10, 0.2)).toBe("cool");
    expect(conditionFor(2, 0)).toBe("cold");
    expect(conditionFor(28, 0.7)).toBe("rainy"); // rain overrides temp
    expect(conditionFor(null, null)).toBe("mild");
  });

  it("derives season by month and hemisphere", () => {
    expect(seasonFor("2026-01-15", 12)).toBe("winter"); // northern January
    expect(seasonFor("2026-07-15", 12)).toBe("summer"); // northern July
    expect(seasonFor("2026-07-15", -33)).toBe("winter"); // southern July
  });

  it("normalizes an Open-Meteo daily response deterministically", () => {
    const forecast = normalizeOpenMeteo(
      {
        daily: {
          time: ["2026-08-01", "2026-08-02"],
          temperature_2m_max: [31, 20],
          temperature_2m_min: [25, 14],
          precipitation_probability_max: [10, 80],
        },
      },
      12.97,
    );
    expect(forecast.source).toBe("forecast");
    expect(forecast.days).toHaveLength(2);
    expect(forecast.days[0]).toMatchObject({ condition: "warm", season: "summer", rainRisk: 0.1 }); // avg 28°C
    expect(forecast.days[1].condition).toBe("rainy"); // 80% rain
  });

  it("returns an empty forecast for a malformed response", () => {
    expect(normalizeOpenMeteo({}, 0).days).toEqual([]);
  });

  it("builds a manual forecast", () => {
    const f = manualForecast([
      { date: "2026-08-01", season: "summer", condition: "warm", highC: 28, lowC: 20, rainRisk: 0 },
    ]);
    expect(f.source).toBe("manual");
    expect(f.days).toHaveLength(1);
  });
});
