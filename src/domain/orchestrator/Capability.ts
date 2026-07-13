/**
 * Capability contracts for the Intelligence Orchestrator (RFC-005).
 *
 * A capability names a unit of work the Orchestrator can run by invoking an
 * existing pure engine. Capabilities declare their dependencies; the Orchestrator
 * owns execution order. Pure types — no React, Supabase, AI, or I/O.
 *
 * The Orchestrator COMPOSES engines; it holds no business logic and never calls
 * AI. Engines never call each other — cross-engine data flows only as declared
 * capability dependencies routed through the executor.
 */

import type { ExecutionContext } from "@/domain/orchestrator/ExecutionContext";

/** The capabilities the orchestrator can run, plus reserved future ones. */
export type CapabilityId =
  // Registered now (compose existing engines):
  | "health"
  | "usage"
  | "analytics"
  | "outfit"
  | "recommendation"
  | "acquisition"
  | "vision"
  | "personalization"
  | "pairing"
  // Reserved for future consumers (declared, not registered in this RFC):
  | "travel"
  | "packing"
  | "weather"
  | "calendar"
  | "shopping";

/** Capability-specific inputs a consumer supplies with a request. */
export interface CapabilityInputs {
  occasion?: string | null;
  limit?: number;
  /** For `acquisition` — a prospective item to evaluate. */
  prospectiveItem?: unknown;
  /** For `vision` — an already-produced VisionAnalysis (AI extraction happens upstream). */
  visionAnalysis?: unknown;
  /** For `pairing` — the owned anchor item to pair around (RFC-030). Required. */
  itemId?: string;
  [key: string]: unknown;
}

/** What a consumer asks the orchestrator to run. Deterministic — no AI selects these. */
export interface CapabilityRequest {
  capabilities: CapabilityId[];
  inputs?: CapabilityInputs;
}

/** The narrowed context handed to a single capability's `run`. */
export interface CapabilityContext {
  /** Shared, read-only execution context. */
  shared: ExecutionContext;
  /** Outputs of already-executed upstream capabilities (keyed by id). */
  upstream: Partial<Record<CapabilityId, unknown>>;
}

export type CapabilityHandler = (ctx: CapabilityContext) => unknown;

/** One registry entry: dependencies + a pure adapter over an existing engine. */
export interface CapabilityDefinition {
  id: CapabilityId;
  /** Capabilities whose completion this one requires (drives ordering). */
  dependsOn: CapabilityId[];
  /** Pure: invokes the engine with the scoped context + upstream outputs. */
  run: CapabilityHandler;
  /** Optional: pull a 0–1 confidence out of the engine output for the report. */
  confidenceOf?: (output: unknown) => number | null;
}

export type CapabilityRegistry = Record<string, CapabilityDefinition>;

/** Errors the orchestrator raises for malformed requests/registries. */
export class UnknownCapabilityError extends Error {
  constructor(public readonly capability: string) {
    super(`Unknown capability: "${capability}".`);
    this.name = "UnknownCapabilityError";
  }
}

export class DependencyCycleError extends Error {
  constructor(public readonly cycle: CapabilityId[]) {
    super(`Dependency cycle detected: ${cycle.join(" → ")}.`);
    this.name = "DependencyCycleError";
  }
}
