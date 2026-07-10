/**
 * AI Runtime v2 (RFC-014) — public surface.
 *
 * A capability-centric AI runtime: callers request a capability, declarative
 * provider policies choose the provider (primary → fallback), and the runtime
 * benchmarks, versions prompts, and records latency/cost/token metrics. It
 * routes and measures; engines decide; AI explains (ADR-005).
 */

export * from "@/runtime/ai/types";
export { AIRuntime, type AIRuntimeConfig } from "@/runtime/ai/AIRuntime";
export { mechanicalFor, resolveProvider } from "@/runtime/ai/CapabilityRouter";
export {
  DEFAULT_POLICIES,
  TARGET_POLICIES,
  loadPolicies,
  isKnownProvider,
} from "@/runtime/ai/ProviderPolicy";
export { ProviderRouter, type ProviderRouterConfig, type RouteOutcome } from "@/runtime/ai/ProviderRouter";
export { PromptRegistry, type SelectedPrompt } from "@/runtime/ai/PromptRegistry";
export { versionId, bucketFraction, inCandidateArm } from "@/runtime/ai/PromptVersion";
export { estimateCost, CostTracker, PRICE_TABLE, type Price } from "@/runtime/ai/CostTracker";
export { LatencyTracker } from "@/runtime/ai/LatencyTracker";
export { RuntimeMetrics, aiRuntimeMetrics } from "@/runtime/ai/RuntimeMetrics";
export { benchmarkCapability } from "@/runtime/ai/ProviderBenchmark";
