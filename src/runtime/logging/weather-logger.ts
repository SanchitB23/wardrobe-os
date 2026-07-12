/**
 * Weather request logging (RFC-022 extension) — structured weather_request lines.
 *
 * Observes WeatherRuntime fetches; does not change provider selection or
 * recommendation decisions.
 */

import { logger } from "@/runtime/logging/logger";
import type { LogLevel } from "@/runtime/logging/log-types";

export interface WeatherRequestEventInput {
  requestId?: string | null;
  provider: string;
  cached: boolean;
  latencyMs: number;
  status: "ok" | "error" | "cache_hit";
  errorCode?: string | null;
  /** Coarse location label (city / coords truncated) — never secrets. */
  locationHint?: string | null;
  message?: string;
  level?: LogLevel;
  source?: string;
}

/** Emit a structured `weather_request` log line. */
export function logWeatherRequest(input: WeatherRequestEventInput): void {
  const status = input.status;
  const level: LogLevel =
    input.level ?? (status === "error" ? "warn" : "info");

  logger.log({
    kind: "weather_request",
    level,
    message:
      input.message ??
      `weather_request ${input.provider} ${status}${input.cached ? " cached" : ""}`,
    source: input.source ?? "weather_runtime",
    requestId: input.requestId,
    provider: input.provider,
    cached: input.cached,
    latencyMs: input.latencyMs,
    status,
    errorCode: input.errorCode ?? null,
    locationHint: input.locationHint ?? null,
  });
}
