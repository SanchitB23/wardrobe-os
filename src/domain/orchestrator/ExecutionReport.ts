/**
 * ExecutionReport (RFC-005) — the summarised, consumer/AI-facing view of an
 * ExecutionResult: which capabilities ran, were skipped, or failed; the order
 * and dependency graph; per-capability timings and confidence; and a
 * plain-language, decision-free explainability trace. Pure.
 *
 * AI consumes this report to narrate "what ran and why" — it never participates
 * in planning or execution (ADR-005).
 */

import type { CapabilityId } from "@/domain/orchestrator/Capability";
import type { DependencyGraph } from "@/domain/orchestrator/ExecutionGraph";
import type {
  CapabilityOutcome,
  ExecutionResult,
} from "@/domain/orchestrator/ExecutionResult";

export interface ExecutionReport {
  executedCapabilities: CapabilityId[];
  skippedCapabilities: CapabilityId[];
  failedCapabilities: CapabilityId[];
  executionOrder: CapabilityId[];
  dependencyGraph: DependencyGraph;
  /** Per-capability duration (ms), plus a `__total` key for the whole run. */
  timings: Record<string, number | null>;
  /** Evidence-mean of executed capabilities that report a confidence (else null). */
  confidence: number | null;
  outcomes: Record<CapabilityId, CapabilityOutcome>;
  /** Human-facing, decision-free "what ran and why" trace. */
  explainability: string[];
  metadata: {
    orchestratorVersion: string;
    generatedAt: string;
    totalDurationMs: number | null;
    capabilityCount: number;
  };
}

export interface BuildReportOptions {
  orchestratorVersion: string;
  generatedAt: string;
}

function meanConfidence(outcomes: CapabilityOutcome[]): number | null {
  const values = outcomes
    .filter((o) => o.status === "executed" && o.confidence != null)
    .map((o) => o.confidence as number);
  if (values.length === 0) return null;
  return Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(4));
}

function explain(o: CapabilityOutcome): string {
  switch (o.status) {
    case "executed":
      return `Ran ${o.id}${o.durationMs != null ? ` (${o.durationMs}ms)` : ""}${
        o.confidence != null ? ` — confidence ${Math.round(o.confidence * 100)}%` : ""
      }.`;
    case "skipped":
      return `Skipped ${o.id} — dependency ${o.skippedBecause} did not complete.`;
    case "failed":
      return `Failed ${o.id}: ${o.error ?? "unknown error"}.`;
  }
}

export function buildExecutionReport(
  result: ExecutionResult,
  options: BuildReportOptions,
): ExecutionReport {
  const ordered = result.order.map((id) => result.outcomes[id]).filter(Boolean);

  const executed = ordered.filter((o) => o.status === "executed").map((o) => o.id);
  const skipped = ordered.filter((o) => o.status === "skipped").map((o) => o.id);
  const failed = ordered.filter((o) => o.status === "failed").map((o) => o.id);

  const timings: Record<string, number | null> = {};
  let total = 0;
  let anyTiming = false;
  for (const o of ordered) {
    timings[o.id] = o.durationMs;
    if (o.durationMs != null) {
      total += o.durationMs;
      anyTiming = true;
    }
  }
  const totalDurationMs = anyTiming ? Number(total.toFixed(2)) : null;
  timings.__total = totalDurationMs;

  return {
    executedCapabilities: executed,
    skippedCapabilities: skipped,
    failedCapabilities: failed,
    executionOrder: result.order,
    dependencyGraph: result.graph,
    timings,
    confidence: meanConfidence(ordered),
    outcomes: result.outcomes,
    explainability: ordered.map(explain),
    metadata: {
      orchestratorVersion: options.orchestratorVersion,
      generatedAt: options.generatedAt,
      totalDurationMs,
      capabilityCount: ordered.length,
    },
  };
}
