/**
 * Structured Logger (RFC-022) — level-gated single-line JSON → stdout/stderr.
 *
 * Vercel Runtime Logs ingest stdout/stderr; one JSON object per line.
 */

import { getRequestId } from "@/runtime/logging/request-context";
import {
  containsLeakedSecret,
  redactValue,
} from "@/runtime/logging/redaction";
import { logRingBuffer } from "@/runtime/logging/ring-buffer";
import {
  getLoggingConfig,
  levelMeetsThreshold,
  type LogLevel,
  type LoggingConfig,
  type StructuredLogRecord,
} from "@/runtime/logging/log-types";

export type EmitFn = (line: string, level: LogLevel) => void;

/**
 * Allow omitting timestamp / requestId — logger fills them in.
 * Distributive over the StructuredLogRecord union so each kind keeps its fields.
 */
export type LogWrite = StructuredLogRecord extends infer R
  ? R extends StructuredLogRecord
    ? Omit<R, "timestamp" | "requestId"> & {
        requestId?: string | null;
        timestamp?: string;
      }
    : never
  : never;

function defaultEmit(line: string, level: LogLevel): void {
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    // info + debug → stdout (Vercel captures both)
    console.log(line);
  }
}

export interface LoggerOptions {
  config?: LoggingConfig;
  emit?: EmitFn;
  now?: () => Date;
  /** When false, skip the in-memory ring buffer (tests). Default true. */
  buffer?: boolean;
}

export class StructuredLogger {
  private config: LoggingConfig;
  private readonly emit: EmitFn;
  private readonly now: () => Date;
  private readonly buffer: boolean;

  constructor(options: LoggerOptions = {}) {
    this.config = options.config ?? getLoggingConfig();
    this.emit = options.emit ?? defaultEmit;
    this.now = options.now ?? (() => new Date());
    this.buffer = options.buffer !== false;
  }

  /** Refresh config from env (or inject for tests). */
  setConfig(config: LoggingConfig): void {
    this.config = config;
  }

  getConfig(): LoggingConfig {
    return this.config;
  }

  log(record: LogWrite): void {
    if (!levelMeetsThreshold(record.level, this.config.level)) return;

    if (record.kind === "api_request" && !this.config.requests) return;
    if (record.kind === "ai_usage" && !this.config.aiUsage) return;
    if (record.kind === "engine_trace" && !this.config.engineTraces) return;

    const full = {
      ...record,
      requestId: record.requestId ?? getRequestId(),
      timestamp: record.timestamp ?? this.now().toISOString(),
    } as StructuredLogRecord;

    // Redact free-form app data bags.
    if (full.kind === "app" && full.data && this.config.redacted) {
      full.data = redactValue(full.data, true) as Record<string, unknown>;
    }

    let line = JSON.stringify(full);
    if (this.config.redacted && containsLeakedSecret(line)) {
      // Last-line defence: never emit a line that still looks like a key/blob.
      const scrubbed: StructuredLogRecord = {
        kind: "app",
        level: "warn",
        message: full.message,
        source: full.source,
        requestId: full.requestId,
        timestamp: full.timestamp,
        data: { note: "log_line_suppressed_possible_secret" },
      };
      line = JSON.stringify(scrubbed);
      if (this.buffer) {
        logRingBuffer.push(scrubbed);
      }
      this.emit(line, scrubbed.level);
      return;
    }

    if (this.buffer) {
      logRingBuffer.push(full);
    }
    this.emit(line, full.level);
  }

  debug(message: string, data?: Record<string, unknown>, source = "app"): void {
    this.log({ kind: "app", level: "debug", message, source, data });
  }

  info(message: string, data?: Record<string, unknown>, source = "app"): void {
    this.log({ kind: "app", level: "info", message, source, data });
  }

  warn(message: string, data?: Record<string, unknown>, source = "app"): void {
    this.log({ kind: "app", level: "warn", message, source, data });
  }

  error(message: string, data?: Record<string, unknown>, source = "app"): void {
    this.log({ kind: "app", level: "error", message, source, data });
  }
}

/** Shared process logger. */
export const logger = new StructuredLogger();
