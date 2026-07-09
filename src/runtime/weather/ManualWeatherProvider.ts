/**
 * ManualWeatherProvider (RFC-011) — always available. Builds a forecast from
 * user-entered days (the Lifestyle wizard's manual weather). No network.
 */

import type { WeatherForecast } from "@/domain/weather";
import type { WeatherProvider } from "@/runtime/weather/WeatherProvider";
import type { WeatherQuery } from "@/runtime/weather/types";
import { manualForecast } from "@/runtime/weather/WeatherNormalizer";

export class ManualWeatherProvider implements WeatherProvider {
  readonly id = "manual";

  async forecast(query: WeatherQuery): Promise<WeatherForecast> {
    return manualForecast(query.manualDays ?? []);
  }
}

export const manualWeatherProvider = new ManualWeatherProvider();
