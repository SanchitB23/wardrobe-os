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
  GEMINI_ONLY_POLICIES,
  loadPolicies,
  isKnownProvider,
} from "@/runtime/ai/ProviderPolicy";
export {
  ProviderRouter,
  type ProviderRouterConfig,
  type RouteOutcome,
  type RouteOptions,
} from "@/runtime/ai/ProviderRouter";
export {
  resolveModel,
  premiumModel,
  OPENAI_DEFAULT_TEXT_MODEL,
  OPENAI_DEFAULT_STRUCTURED_MODEL,
  OPENAI_DEFAULT_CLASSIFIER_MODEL,
  OPENAI_PREMIUM_MODEL,
} from "@/runtime/ai/ModelPolicy";
export {
  loadBudgetConfig,
  evaluateBudget,
  DEFAULT_BUDGET,
  type BudgetConfig,
  type BudgetStatus,
} from "@/runtime/ai/BudgetGuard";
export {
  resolveCapabilityPolicy,
  mechanicalForCapability,
} from "@/runtime/ai/CapabilityPolicy";
export {
  resolveProviderPreference,
  activeProvider,
  type ProviderPreference,
  type PreferenceOptions,
} from "@/runtime/ai/ProviderPreferenceResolver";
export { RuntimeCostEstimator } from "@/runtime/ai/RuntimeCostEstimator";
export { RuntimeBudgetMonitor } from "@/runtime/ai/RuntimeBudgetMonitor";
export {
  RuntimePolicyResolver,
  type ResolvedRoute,
  type RouteDescription,
} from "@/runtime/ai/RuntimePolicyResolver";
export { PromptRegistry, type SelectedPrompt } from "@/runtime/ai/PromptRegistry";
export { versionId, bucketFraction, inCandidateArm } from "@/runtime/ai/PromptVersion";
export { estimateCost, CostTracker, PRICE_TABLE, type Price } from "@/runtime/ai/CostTracker";
export { LatencyTracker } from "@/runtime/ai/LatencyTracker";
export { RuntimeMetrics, aiRuntimeMetrics } from "@/runtime/ai/RuntimeMetrics";
export { benchmarkCapability } from "@/runtime/ai/ProviderBenchmark";
