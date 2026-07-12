/**
 * Logging & Observability Runtime (RFC-022) — public exports.
 *
 * Shared infrastructure under `src/runtime/logging`. Domain engines must not
 * import this module.
 */

export {
  generateRequestId,
  isWellFormedRequestId,
  resolveRequestId,
  REQUEST_ID_HEADER,
} from "@/runtime/logging/correlation-id";

export {
  getRequestContext,
  getRequestId,
  getRequestRoute,
  runWithRequestContext,
  type RequestContext,
} from "@/runtime/logging/request-context";

export {
  hashValue,
  redactIp,
  redactUserAgent,
  redactValue,
  containsLeakedSecret,
} from "@/runtime/logging/redaction";

export {
  StructuredLogger,
  logger,
  type EmitFn,
  type LoggerOptions,
} from "@/runtime/logging/logger";

export {
  logAIUsage,
  buildAIUsageFields,
  type AIUsageEventInput,
} from "@/runtime/logging/ai-usage-logger";

export {
  logWeatherRequest,
  type WeatherRequestEventInput,
} from "@/runtime/logging/weather-logger";

export {
  replayStore,
  type ReplayCapture,
} from "@/runtime/logging/request-replay";

export {
  logApiRequest,
  withApiLogging,
  attachRequestId,
  type ApiHandler,
  type ApiRequestEventInput,
} from "@/runtime/logging/api-logger";

export {
  logOrchestratorRun,
  type OrchestratorLogInput,
} from "@/runtime/logging/orchestrator-logger";

export {
  LogRingBuffer,
  logRingBuffer,
} from "@/runtime/logging/ring-buffer";

export {
  parseLogLevel,
  levelMeetsThreshold,
  getLoggingConfig,
  type LogLevel,
  type LogKind,
  type LoggingConfig,
  type StructuredLogRecord,
  type AIUsageLogFields,
  type ApiRequestLogFields,
  type EngineTraceLogFields,
  type WeatherRequestLogFields,
  type AIUsageStatus,
  type EngineTraceStatus,
  type WeatherRequestStatus,
  type TokenSource,
  type CostSource,
} from "@/runtime/logging/log-types";

export {
  createStructuredAILogger,
} from "@/runtime/logging/structured-ai-logger";
