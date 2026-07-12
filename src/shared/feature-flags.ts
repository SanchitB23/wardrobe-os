/**
 * Feature flags registry — read-only env flags for Developer Mode.
 *
 * Observability only: listing flags does not toggle runtime behavior beyond
 * what the env already configures. No DB persistence.
 */

export type FeatureFlagKind = "logging" | "ai" | "weather" | "access" | "developer";

export interface FeatureFlagDefinition {
  key: string;
  kind: FeatureFlagKind;
  description: string;
  /** Default when unset. */
  defaultValue: string;
}

export const FEATURE_FLAG_DEFINITIONS: readonly FeatureFlagDefinition[] = [
  {
    key: "LOG_LEVEL",
    kind: "logging",
    description: "Minimum structured log level",
    defaultValue: "info",
  },
  {
    key: "LOG_AI_USAGE",
    kind: "logging",
    description: "Emit ai_usage lines",
    defaultValue: "true",
  },
  {
    key: "LOG_REQUESTS",
    kind: "logging",
    description: "Emit api_request / weather_request / proxy lines",
    defaultValue: "true",
  },
  {
    key: "LOG_ENGINE_TRACES",
    kind: "logging",
    description: "Emit engine_trace orchestrator summaries",
    defaultValue: "false",
  },
  {
    key: "LOG_REDACTED",
    kind: "logging",
    description: "Enforce redaction on free-form log data",
    defaultValue: "true",
  },
  {
    key: "REPLAY_CAPTURE",
    kind: "developer",
    description: "Capture sanitized API metadata for Request Replay (dev only)",
    defaultValue: "false",
  },
  {
    key: "AI_PROVIDER",
    kind: "ai",
    description: "Legacy single-provider AIService backend",
    defaultValue: "gemini",
  },
  {
    key: "GEMINI_MODEL",
    kind: "ai",
    description: "Default Gemini model id",
    defaultValue: "gemini-2.5-flash",
  },
  {
    key: "WEATHER_PROVIDER",
    kind: "weather",
    description: "Weather Runtime provider id",
    defaultValue: "open-meteo",
  },
  {
    key: "APP_ACCESS_CODE",
    kind: "access",
    description: "When set, enables the application access guard",
    defaultValue: "(unset)",
  },
] as const;

export interface FeatureFlagStatus {
  key: string;
  kind: FeatureFlagKind;
  description: string;
  defaultValue: string;
  configured: boolean;
  /** Display value — secrets are masked. */
  displayValue: string;
}

const SECRET_KEYS = new Set(["APP_ACCESS_CODE", "APP_COOKIE_SECRET"]);

export function resolveFeatureFlags(
  env: Record<string, string | undefined> = process.env,
): FeatureFlagStatus[] {
  return FEATURE_FLAG_DEFINITIONS.map((def) => {
    const raw = env[def.key];
    const configured = raw != null && raw !== "";
    let displayValue = configured ? raw : def.defaultValue;
    if (configured && SECRET_KEYS.has(def.key)) {
      displayValue = "••••set";
    }
    return {
      key: def.key,
      kind: def.kind,
      description: def.description,
      defaultValue: def.defaultValue,
      configured,
      displayValue,
    };
  });
}
