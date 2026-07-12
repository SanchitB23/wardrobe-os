/**
 * Structured AILogger adapter (RFC-022) — backs legacy AIOrchestrator logging
 * with the shared structured sink. Never logs raw prompts from `data`.
 */

import type { AILogger, AILogRecord } from "@/ai/types";
import { logger } from "@/runtime/logging/logger";
import { redactValue } from "@/runtime/logging/redaction";
import { getLoggingConfig } from "@/runtime/logging/log-types";

const BLOCKED_DATA_KEYS = new Set([
  "prompt",
  "system",
  "messages",
  "content",
  "images",
  "imageBase64",
  "request",
]);

function safeData(data: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const config = getLoggingConfig();
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (BLOCKED_DATA_KEYS.has(k)) {
      filtered[k] = "[REDACTED]";
      continue;
    }
    filtered[k] = config.redacted ? redactValue(v, true) : v;
  }
  return filtered;
}

/** AILogger that emits through the structured Logger (no prompts / secrets). */
export function createStructuredAILogger(): AILogger {
  return {
    log(record: AILogRecord): void {
      logger.log({
        kind: "app",
        level: record.level,
        message: record.message,
        source: "ai_orchestrator",
        data: safeData(record.data),
      });
    },
  };
}
