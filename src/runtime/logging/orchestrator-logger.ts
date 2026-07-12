/**
 * OrchestratorLogger (RFC-022) — emit engine_trace from an ExecutionReport.
 *
 * Called at the service boundary after `orchestrate()` — never inside pure
 * domain engines. Gated by LOG_ENGINE_TRACES (default false).
 */

import type { ExecutionReport } from "@/domain/orchestrator";
import { logger } from "@/runtime/logging/logger";
import { getRequestId } from "@/runtime/logging/request-context";
import type { EngineTraceStatus } from "@/runtime/logging/log-types";

export interface OrchestratorLogInput {
  report: ExecutionReport;
  /** Entry capability / tool name (e.g. runIntelligence). */
  capability?: string;
  requestId?: string | null;
  message?: string;
}

function deriveStatus(report: ExecutionReport): EngineTraceStatus {
  if (report.failedCapabilities.length > 0) {
    return report.executedCapabilities.length > 0 ? "partial" : "failed";
  }
  return "ok";
}

function graphSummary(report: ExecutionReport): { nodes: number; edges: number } {
  const graph = report.dependencyGraph ?? {};
  const nodes = Object.keys(graph).length || report.executionOrder.length;
  const edges = Object.values(graph).reduce((sum, deps) => sum + deps.length, 0);
  return { nodes, edges };
}

/** Emit a structured `engine_trace` log (no outcome payloads). */
export function logOrchestratorRun(input: OrchestratorLogInput): void {
  const { report } = input;
  const status = deriveStatus(report);
  const level = status === "failed" ? "warn" : "debug";

  logger.log({
    kind: "engine_trace",
    level,
    message:
      input.message ??
      `engine_trace ${input.capability ?? "orchestrate"} ${status}`,
    source: "orchestrator",
    requestId: input.requestId ?? getRequestId(),
    capability: input.capability ?? "orchestrate",
    executionGraph: graphSummary(report),
    executedCapabilities: [...report.executedCapabilities],
    skippedCapabilities: [...report.skippedCapabilities],
    failedCapabilities: [...report.failedCapabilities],
    totalLatencyMs:
      report.metadata.totalDurationMs ?? report.timings.__total ?? null,
    confidence: report.confidence,
    status,
  });
}
