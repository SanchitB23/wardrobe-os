/**
 * AI Runtime v2 (RFC-014) — capability-centric runtime types.
 *
 * Vendor-neutral. Builds on the existing `src/ai` contracts (AIProvider,
 * AIResponse, ResponseParser, prompt builders) and adds the capability →
 * policy → provider routing layer, prompt versioning, and metrics. The runtime
 * ROUTES and MEASURES; it never makes a wardrobe decision (ADR-005).
 */

import type {
  AICacheRequest,
  AIProviderId,
  AIRequest,
  AIResponse,
  AIUsage,
  BuiltPrompt,
  PromptContext,
  ResponseParser,
} from "@/ai/types";

/** The semantic capabilities the runtime routes (not mechanical generate/vision). */
export type AICapability =
  | "explanation"
  | "vision"
  | "image_generation"
  | "conversation"
  | "summarization"
  | "structured" // JSON/schema-shaped output (RFC-014A)
  | "classification" // short label/routing output (RFC-014A)
  | "embeddings"; // reserved — future, not wired

export const AI_CAPABILITIES: readonly AICapability[] = [
  "explanation",
  "vision",
  "image_generation",
  "conversation",
  "summarization",
  "structured",
  "classification",
  "embeddings",
] as const;

/** The mechanical provider method a capability maps to. */
export type MechanicalCapability = "generate" | "vision";

/** Primary + optional fallback provider for one capability. */
export interface ProviderPolicy {
  primary: AIProviderId;
  fallback?: AIProviderId;
  /** Optional model hint for this capability. */
  model?: string;
}

export type AIRuntimePolicies = Record<AICapability, ProviderPolicy>;

// ---------------------------------------------------------------------------
// Prompt versioning + experiments
// ---------------------------------------------------------------------------

/** A prompt builder pinned to an explicit version. */
export interface PromptVersionEntry {
  builderId: string;
  version: string; // e.g. "3" → version id "builder@3"
  build(context: PromptContext): BuiltPrompt;
}

/** Route a deterministic share of traffic to a candidate version. */
export interface PromptExperiment {
  builderId: string;
  control: string; // version
  candidate: string; // version
  /** 0–1 fraction routed to the candidate (deterministically bucketed). */
  candidateShare: number;
}

// ---------------------------------------------------------------------------
// Requests / results
// ---------------------------------------------------------------------------

export interface AIRuntimeRequest<T = unknown> {
  capability: AICapability;
  /** A ready request, OR a builderId + promptContext resolved via the registry. */
  request?: AIRequest;
  builderId?: string;
  promptContext?: PromptContext;
  parser?: ResponseParser<T>;
  /** Stable key for deterministic experiment bucketing (e.g. an entity id). */
  bucketKey?: string;
  /** When set (and a cache is configured), read/write the AI cache. */
  cache?: AICacheRequest;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

export interface AIRuntimeResult<T = unknown> extends AIResponse<T> {
  capability: AICapability;
  promptVersion: string;
  /** Which provider actually served it (may be the fallback). */
  servedBy: AIProviderId;
  usedFallback: boolean;
  /** Estimated cost (USD) from the price table; directional, not billed. */
  costUsd: number;
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export interface MetricRow {
  capability: AICapability;
  provider: AIProviderId;
  /** Model that served (or would have served) this bucket. */
  model: string;
  promptVersion: string;
  requests: number;
  cacheHits: number;
  failures: number;
  /** Times the fallback provider served this bucket. */
  fallbacks: number;
  avgLatencyMs: number | null;
  lastLatencyMs: number | null;
  totalTokens: number;
  /** Estimated spend excluding cache hits (directional). */
  estCostUsd: number;
  /** Counterfactual spend avoided by cache hits. */
  cacheSavingsUsd: number;
}

export interface AIRuntimeMetricsSnapshot {
  byCapabilityProvider: MetricRow[];
  totalRequests: number;
  totalCostUsd: number;
  totalFallbacks: number;
  totalCacheSavingsUsd: number;
}

export interface MetricSample {
  capability: AICapability;
  provider: AIProviderId;
  promptVersion: string;
  /** Model id when known (defaults to "unknown" in the metrics key). */
  model?: string;
  latencyMs: number | null;
  usage?: AIUsage;
  costUsd: number;
  cacheHit: boolean;
  ok: boolean;
  usedFallback?: boolean;
}

// ---------------------------------------------------------------------------
// Benchmarking
// ---------------------------------------------------------------------------

export interface BenchmarkEntry {
  provider: AIProviderId;
  ok: boolean;
  latencyMs: number | null;
  totalTokens: number;
  costUsd: number;
  error?: string;
}

export interface BenchmarkResult {
  capability: AICapability;
  promptVersion: string;
  entries: BenchmarkEntry[];
}
