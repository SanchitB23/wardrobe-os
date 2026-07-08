/**
 * ExecutionPlanner (RFC-005) — turns a CapabilityRequest into a deterministic
 * ExecutionPlan (ordered nodes + dependency graph). Pure; no execution here.
 */

import type {
  CapabilityRegistry,
  CapabilityRequest,
} from "@/domain/orchestrator/Capability";
import {
  buildDependencyGraph,
  resolveExecutionOrder,
  type DependencyGraph,
} from "@/domain/orchestrator/ExecutionGraph";
import type { ExecutionNode } from "@/domain/orchestrator/ExecutionNode";

export interface ExecutionPlan {
  /** Capabilities in dependency-respecting, deterministic order. */
  order: ExecutionNode["id"][];
  /** The ordered nodes with their dependencies. */
  nodes: ExecutionNode[];
  /** Adjacency (capability → dependencies), including transitive ones. */
  graph: DependencyGraph;
}

/**
 * Plan the execution of a request against a registry. Expands transitive
 * dependencies, resolves a stable order, and returns the plan. Deterministic:
 * same request + registry ⇒ identical plan.
 */
export function planExecution(
  request: CapabilityRequest,
  registry: CapabilityRegistry,
): ExecutionPlan {
  const graph = buildDependencyGraph(request.capabilities, registry);
  const order = resolveExecutionOrder(graph);
  const nodes: ExecutionNode[] = order.map((id) => ({ id, dependsOn: graph[id] }));
  return { order, nodes, graph };
}
