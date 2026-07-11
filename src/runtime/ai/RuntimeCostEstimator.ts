/**
 * RuntimeCostEstimator (RFC-014B) — estimated cost tracking for the AI Runtime.
 *
 * Thin, testable wrapper over the static price table (`estimateCost`): per-call
 * cost from token usage, and month-to-date spend for a provider summed from the
 * runtime metrics. Estimates are DIRECTIONAL (comparison / budgeting), never
 * billed — no pricing/billing APIs (RFC-014B non-goal). Pure over its inputs.
 */

import { estimateCost } from "@/runtime/ai/CostTracker";
import type { AIProviderId, AIUsage } from "@/ai/types";
import type { AIRuntimeMetricsSnapshot } from "@/runtime/ai/types";

export class RuntimeCostEstimator {
  /** Estimated USD for a single call, from token usage × the price table. */
  perCall(usage: AIUsage | undefined, provider: AIProviderId, model: string): number {
    return estimateCost(usage, provider, model);
  }

  /** Estimated month-to-date spend for a provider, from the metrics snapshot. */
  monthToDate(snapshot: AIRuntimeMetricsSnapshot, provider: AIProviderId): number {
    return snapshot.byCapabilityProvider
      .filter((row) => row.provider === provider)
      .reduce((sum, row) => sum + row.estCostUsd, 0);
  }
}
