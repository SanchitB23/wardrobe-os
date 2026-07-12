/**
 * Logging & Observability Runtime (RFC-022) — shared log types and env config.
 *
 * Observability observes; it does not decide. These types describe emit contracts
 * only — no business branching.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogKind = "api_request" | "ai_usage" | "engine_trace" | "app";

export type AIUsageStatus = "ok" | "error" | "cache_hit";

export type TokenSource = "provider" | "unavailable";
export type CostSource = "estimated" | "unavailable";

export type EngineTraceStatus = "ok" | "partial" | "failed";

/** Base envelope fields present on every structured log line. */
export interface LogEnvelope {
  kind: LogKind;
  level: LogLevel;
  message: string;
  source: string;
  requestId: string | null;
  timestamp: string;
}

export interface ApiRequestLogFields {
  method: string;
  route: string;
  statusCode: number;
  latencyMs: number;
  userAgent: string | null;
  ip: string | null;
  errorCode: string | null;
}

export interface AIUsageLogFields {
  route: string | null;
  capability: string;
  provider: string;
  model: string;
  fallbackProvider: string | null;
  usedFallback: boolean;
  promptVersion: string;
  cacheHit: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  tokenSource: TokenSource;
  estimatedCostUsd: number | null;
  costSource: CostSource;
  latencyMs: number | null;
  status: AIUsageStatus;
  errorCode: string | null;
}

export interface EngineTraceLogFields {
  capability: string;
  executionGraph: { nodes: number; edges: number };
  executedCapabilities: string[];
  skippedCapabilities: string[];
  failedCapabilities: string[];
  totalLatencyMs: number | null;
  confidence: number | null;
  status: EngineTraceStatus;
}

export type StructuredLogRecord =
  | (LogEnvelope & { kind: "api_request" } & ApiRequestLogFields)
  | (LogEnvelope & { kind: "ai_usage" } & AIUsageLogFields)
  | (LogEnvelope & { kind: "engine_trace" } & EngineTraceLogFields)
  | (LogEnvelope & { kind: "app"; data?: Record<string, unknown> });

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function parseLogLevel(value: string | undefined, fallback: LogLevel = "info"): LogLevel {
  const v = (value ?? fallback).toLowerCase();
  if (v === "debug" || v === "info" || v === "warn" || v === "error") return v;
  return fallback;
}

export function levelMeetsThreshold(level: LogLevel, threshold: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[threshold];
}

function envBool(
  env: Record<string, string | undefined>,
  name: string,
  defaultValue: boolean,
): boolean {
  const raw = env[name];
  if (raw == null || raw === "") return defaultValue;
  const v = raw.toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return defaultValue;
}

export interface LoggingConfig {
  level: LogLevel;
  aiUsage: boolean;
  requests: boolean;
  engineTraces: boolean;
  redacted: boolean;
}

/** Read logging flags from env (defaults match RFC-022). */
export function getLoggingConfig(
  env: Record<string, string | undefined> = process.env,
): LoggingConfig {
  return {
    level: parseLogLevel(env.LOG_LEVEL, "info"),
    aiUsage: envBool(env, "LOG_AI_USAGE", true),
    requests: envBool(env, "LOG_REQUESTS", true),
    engineTraces: envBool(env, "LOG_ENGINE_TRACES", false),
    redacted: envBool(env, "LOG_REDACTED", true),
  };
}
