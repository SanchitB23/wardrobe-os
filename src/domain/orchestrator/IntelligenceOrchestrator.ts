/**
 * Intelligence Orchestrator (RFC-005) — deterministic composition of the
 * existing engines. Given a capability request + an ExecutionContext, it plans
 * the execution (dependency resolution → order), runs each capability's engine
 * with failure isolation, and returns an ExecutionReport.
 *
 * It composes engines only: no business logic, never calls AI, engines stay
 * pure and never call each other. AI consumes the report (explanation only).
 * Identical request + context (+ injected clock) ⇒ identical report, timing aside.
 */

import type {
  CapabilityRegistry,
  CapabilityRequest,
} from "@/domain/orchestrator/Capability";
import { DEFAULT_CAPABILITY_REGISTRY } from "@/domain/orchestrator/CapabilityRegistry";
import { executePlan } from "@/domain/orchestrator/EngineExecutor";
import type { ExecutionContext } from "@/domain/orchestrator/ExecutionContext";
import { planExecution } from "@/domain/orchestrator/ExecutionPlanner";
import {
  buildExecutionReport,
  type ExecutionReport,
} from "@/domain/orchestrator/ExecutionReport";

export const INTELLIGENCE_ORCHESTRATOR_VERSION = "1.0.0";

export interface OrchestrateOptions {
  /** Override the default capability registry (tests / future consumers). */
  registry?: CapabilityRegistry;
  /** Monotonic clock (ms) for timing; injected for deterministic tests. */
  clock?: () => number;
}

/** Plan + execute + report. Pure aside from the injected timing clock. */
export function orchestrate(
  request: CapabilityRequest,
  context: ExecutionContext,
  options: OrchestrateOptions = {},
): ExecutionReport {
  const registry = options.registry ?? DEFAULT_CAPABILITY_REGISTRY;
  const plan = planExecution(request, registry);
  const result = executePlan(plan, context, registry, { clock: options.clock });
  return buildExecutionReport(result, {
    orchestratorVersion: INTELLIGENCE_ORCHESTRATOR_VERSION,
    generatedAt: context.generatedAt,
  });
}
