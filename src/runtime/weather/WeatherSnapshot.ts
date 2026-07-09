/**
 * Runtime convenience re-exports (RFC-011). The `WeatherSnapshot` type and its
 * pure projections are owned by the weather DOMAIN; re-exported here so runtime
 * consumers have a single import surface.
 */

export type { WeatherSnapshot, WeatherSnapshotSource } from "@/domain/weather";
export { toWeatherSnapshot, seasonalFallbackSnapshot } from "@/domain/weather";
