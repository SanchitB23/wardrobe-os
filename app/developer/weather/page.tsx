import type { Metadata } from "next";

import { WeatherRuntimeView } from "@/features/developer/components/weather-runtime-view";
import { seasonalFallbackSnapshot } from "@/domain/weather";
import { weatherMetrics, weatherRuntime, WEATHER_CACHE_TTL_MS } from "@/runtime/weather";

export const metadata: Metadata = {
  title: "Weather Runtime",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WeatherRuntimePage() {
  // If a home location is configured, show a live (cached) snapshot; otherwise a
  // deterministic seasonal-fallback snapshot so the page always renders.
  const home = process.env.WEATHER_HOME_LOCATION;
  const today = new Date().toISOString().slice(0, 10);
  const snapshot = home
    ? (await weatherRuntime.getSnapshot({ location: home, startDate: today, endDate: today, at: today })).snapshot
    : seasonalFallbackSnapshot(new Date());

  return (
    <WeatherRuntimeView
      provider={weatherRuntime.providerId}
      ttlMinutes={Math.round(WEATHER_CACHE_TTL_MS / 60000)}
      metrics={weatherMetrics.snapshot()}
      snapshot={snapshot}
    />
  );
}
