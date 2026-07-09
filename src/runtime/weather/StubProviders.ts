/**
 * Future provider stubs (RFC-011) — declared behind the same interface so a
 * swap is config-only. Not implemented; they throw so the runtime falls back.
 */

import type { WeatherForecast } from "@/domain/weather";
import type { WeatherProvider } from "@/runtime/weather/WeatherProvider";

class NotImplementedProvider implements WeatherProvider {
  constructor(readonly id: string) {}
  async forecast(): Promise<WeatherForecast> {
    throw new Error(`${this.id} provider is not implemented yet (RFC-011 future).`);
  }
}

export class WeatherApiProvider extends NotImplementedProvider {
  constructor() {
    super("weatherapi");
  }
}

export class TomorrowProvider extends NotImplementedProvider {
  constructor() {
    super("tomorrow");
  }
}
