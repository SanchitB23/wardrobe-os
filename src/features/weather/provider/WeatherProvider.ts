/**
 * Vendor-neutral weather provider (RFC-006) — mirrors the VisionProvider /
 * AIProvider pattern (ADR-004). A provider fetches an external forecast and
 * returns a normalized {@link WeatherForecast}; the Lifestyle Engine only ever
 * sees the normalized shape. Providers are the only place that does I/O.
 *
 * Current implementations: Open-Meteo (`forecast`) + manual entry. `historical`
 * / future sources are RESERVED (see WeatherSource).
 */

import type { WeatherForecast } from "@/domain/lifestyle";

export interface WeatherProvider {
  readonly id: string;
  /** Fetch + normalize a forecast for the destination over [startDate, endDate]. */
  forecast(destination: string, startDate: string, endDate: string): Promise<WeatherForecast>;
}
