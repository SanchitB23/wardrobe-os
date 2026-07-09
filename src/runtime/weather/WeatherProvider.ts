/**
 * WeatherProvider (RFC-011) — vendor-neutral provider interface (mirrors the
 * AIProvider / VisionProvider pattern, ADR-004). A provider does I/O and returns
 * a normalized {@link WeatherForecast}; it never sees an engine and never scores.
 */

import type { WeatherForecast } from "@/domain/weather";
import type { WeatherQuery } from "@/runtime/weather/types";

export interface WeatherProvider {
  readonly id: string;
  forecast(query: WeatherQuery): Promise<WeatherForecast>;
}
