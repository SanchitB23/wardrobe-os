/**
 * EngineExecutor (RFC-005) — runs a planned set of capabilities in order,
 * threading each one's declared upstream outputs into its CapabilityContext,
 * isolating failures, and timing each via an injected clock.
 *
 * Failure isolation: a capability whose `run` throws is recorded as `failed`;
 * any capability that (transitively) depends on a failed/skipped one is
 * `skipped` (never run, never crashes the whole execution). Independent
 * capabilities still execute. Pure aside from the injected clock.
 */

import type {
  CapabilityContext,
  CapabilityId,
  CapabilityRegistry,
} from "@/domain/orchestrator/Capability";
import type { ExecutionContext } from "@/domain/orchestrator/ExecutionContext";
import type { ExecutionPlan } from "@/domain/orchestrator/ExecutionPlanner";
import type {
  CapabilityOutcome,
  ExecutionResult,
} from "@/domain/orchestrator/ExecutionResult";

export interface ExecuteOptions {
  /** Monotonic clock (ms) for timing; injected for deterministic tests. */
  clock?: () => number;
}

function defaultClock(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

export function executePlan(
  plan: ExecutionPlan,
  context: ExecutionContext,
  registry: CapabilityRegistry,
  options: ExecuteOptions = {},
): ExecutionResult {
  const clock = options.clock ?? defaultClock;
  const outcomes: Record<string, CapabilityOutcome> = {};
  const upstream: Partial<Record<CapabilityId, unknown>> = {};

  for (const node of plan.nodes) {
    const failedDep = node.dependsOn.find((dep) => {
      const o = outcomes[dep];
      return o && (o.status === "failed" || o.status === "skipped");
    });

    if (failedDep) {
      outcomes[node.id] = {
        id: node.id,
        status: "skipped",
        output: null,
        confidence: null,
        durationMs: null,
        skippedBecause: failedDep,
      };
      continue;
    }

    const def = registry[node.id];
    const capContext: CapabilityContext = { shared: context, upstream };
    const start = clock();
    try {
      const output = def.run(capContext);
      const durationMs = round2(clock() - start);
      upstream[node.id] = output;
      outcomes[node.id] = {
        id: node.id,
        status: "executed",
        output,
        confidence: def.confidenceOf ? def.confidenceOf(output) : null,
        durationMs,
      };
    } catch (error) {
      outcomes[node.id] = {
        id: node.id,
        status: "failed",
        output: null,
        confidence: null,
        durationMs: round2(clock() - start),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return { outcomes, order: plan.order, graph: plan.graph };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
