/**
 * ExecutionResult (RFC-005) — the raw per-capability outcomes from running an
 * ExecutionPlan, before it is summarised into an ExecutionReport. Pure data.
 */

import type { CapabilityId } from "@/domain/orchestrator/Capability";
import type { DependencyGraph } from "@/domain/orchestrator/ExecutionGraph";

export type CapabilityStatus = "executed" | "failed" | "skipped";

export interface CapabilityOutcome {
  id: CapabilityId;
  status: CapabilityStatus;
  /** Engine output when executed; null when failed/skipped. */
  output: unknown | null;
  /** 0–1 when the engine reports one; null otherwise. */
  confidence: number | null;
  /** Wall-clock duration; metadata only (not part of the determinism guarantee). */
  durationMs: number | null;
  /** Present when status = "failed". */
  error?: string;
  /** Present when status = "skipped" — the failed/skipped dependency that caused it. */
  skippedBecause?: CapabilityId;
}

export interface ExecutionResult {
  outcomes: Record<CapabilityId, CapabilityOutcome>;
  /** The order capabilities were executed/considered in. */
  order: CapabilityId[];
  graph: DependencyGraph;
}
