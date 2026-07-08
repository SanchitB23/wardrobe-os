/**
 * ExecutionGraph (RFC-005) — deterministic dependency resolution.
 *
 * Given the requested capabilities + the registry, expand the transitive
 * dependency set and resolve a stable topological order. Pure and deterministic:
 * cycles are detected (never an infinite loop), and among ready nodes the
 * smallest id is chosen so the order is reproducible.
 */

import {
  DependencyCycleError,
  UnknownCapabilityError,
  type CapabilityId,
  type CapabilityRegistry,
} from "@/domain/orchestrator/Capability";

/** Adjacency map: capability id → its (in-plan) dependencies. */
export type DependencyGraph = Record<string, CapabilityId[]>;

/**
 * Expand the requested capabilities into a dependency graph including every
 * transitive dependency. Throws UnknownCapabilityError for unregistered ids.
 */
export function buildDependencyGraph(
  requested: readonly CapabilityId[],
  registry: CapabilityRegistry,
): DependencyGraph {
  const graph: DependencyGraph = {};
  const visit = (id: CapabilityId) => {
    if (id in graph) return;
    const def = registry[id];
    if (!def) throw new UnknownCapabilityError(id);
    // Record first (with its declared deps) to guard against cycles via `in graph`.
    graph[id] = [...def.dependsOn];
    for (const dep of def.dependsOn) visit(dep);
  };
  for (const id of requested) visit(id);
  return graph;
}

/**
 * Kahn's algorithm with a stable tie-break (smallest id among ready nodes),
 * yielding a deterministic execution order. Throws DependencyCycleError if the
 * graph cannot be fully ordered.
 */
export function resolveExecutionOrder(graph: DependencyGraph): CapabilityId[] {
  const ids = Object.keys(graph) as CapabilityId[];
  const remaining = new Set<CapabilityId>(ids);
  const order: CapabilityId[] = [];

  while (remaining.size > 0) {
    const ready = ids
      .filter((id) => remaining.has(id))
      .filter((id) => graph[id].every((dep) => !remaining.has(dep)))
      .sort((a, b) => a.localeCompare(b));

    if (ready.length === 0) {
      // Everything left is in a cycle (or depends on one).
      throw new DependencyCycleError([...remaining].sort((a, b) => a.localeCompare(b)));
    }
    for (const id of ready) {
      order.push(id);
      remaining.delete(id);
    }
  }

  return order;
}
