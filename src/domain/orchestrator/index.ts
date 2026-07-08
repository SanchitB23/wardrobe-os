/**
 * Intelligence Orchestrator domain (RFC-005) — deterministic composition layer.
 * Composes engines; holds no business logic; never calls AI.
 */

export {
  orchestrate,
  INTELLIGENCE_ORCHESTRATOR_VERSION,
  type OrchestrateOptions,
} from "@/domain/orchestrator/IntelligenceOrchestrator";
export {
  DEFAULT_CAPABILITY_REGISTRY,
  createCapabilityRegistry,
} from "@/domain/orchestrator/CapabilityRegistry";
export { planExecution, type ExecutionPlan } from "@/domain/orchestrator/ExecutionPlanner";
export { executePlan, type ExecuteOptions } from "@/domain/orchestrator/EngineExecutor";
export {
  buildExecutionReport,
  type ExecutionReport,
} from "@/domain/orchestrator/ExecutionReport";
export {
  createExecutionContext,
  type ExecutionContext,
  type CreateExecutionContextArgs,
} from "@/domain/orchestrator/ExecutionContext";
export {
  buildDependencyGraph,
  resolveExecutionOrder,
  type DependencyGraph,
} from "@/domain/orchestrator/ExecutionGraph";
export type { ExecutionNode } from "@/domain/orchestrator/ExecutionNode";
export type {
  CapabilityStatus,
  CapabilityOutcome,
  ExecutionResult,
} from "@/domain/orchestrator/ExecutionResult";
export {
  UnknownCapabilityError,
  DependencyCycleError,
  type CapabilityId,
  type CapabilityInputs,
  type CapabilityRequest,
  type CapabilityContext,
  type CapabilityDefinition,
  type CapabilityHandler,
  type CapabilityRegistry,
} from "@/domain/orchestrator/Capability";
