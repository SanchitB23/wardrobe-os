/**
 * ExecutionNode (RFC-005) — a single capability in a planned execution, with the
 * dependencies that must complete before it runs. Pure data.
 */

import type { CapabilityId } from "@/domain/orchestrator/Capability";

export interface ExecutionNode {
  id: CapabilityId;
  /** Dependencies (present in the same plan) that must complete first. */
  dependsOn: CapabilityId[];
}
