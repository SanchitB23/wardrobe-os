/**
 * AI Runtime v2 (RFC-014) — cost estimation.
 *
 * A static provider/model price table (USD per 1K tokens) + a pure
 * `estimateCost`. Estimates are DIRECTIONAL (for comparison/benchmarking), not
 * billed. Prices are tunable constants. No I/O.
 */

import type { AIProviderId, AIUsage } from "@/ai/types";

export interface Price {
  /** USD per 1K prompt (input) tokens. */
  inputPer1k: number;
  /** USD per 1K completion (output) tokens. */
  outputPer1k: number;
}

/**
 * Representative prices (USD / 1K tokens). Keyed by `provider:model`, with a
 * per-provider default fallback. Approximate — update as pricing changes.
 */
export const PRICE_TABLE: Record<string, Price> = {
  "gemini:default": { inputPer1k: 0.000075, outputPer1k: 0.0003 },
  "gemini:gemini-2.5-flash": { inputPer1k: 0.000075, outputPer1k: 0.0003 },
  "gemini:gemini-2.5-flash-lite": { inputPer1k: 0.00003, outputPer1k: 0.00012 },
  "openai:default": { inputPer1k: 0.0005, outputPer1k: 0.0015 },
  "claude:default": { inputPer1k: 0.0008, outputPer1k: 0.0024 },
};

function priceFor(provider: AIProviderId, model: string): Price {
  return (
    PRICE_TABLE[`${provider}:${model}`] ??
    PRICE_TABLE[`${provider}:default`] ?? { inputPer1k: 0, outputPer1k: 0 }
  );
}

/** Estimated USD cost of a call. Returns 0 when usage/prices are unknown. */
export function estimateCost(
  usage: AIUsage | undefined,
  provider: AIProviderId,
  model: string,
): number {
  if (!usage) return 0;
  const price = priceFor(provider, model);
  const cost = (usage.promptTokens / 1000) * price.inputPer1k +
    (usage.completionTokens / 1000) * price.outputPer1k;
  return Math.round(cost * 1e6) / 1e6;
}

/** Running cost accumulator (used by RuntimeMetrics). */
export class CostTracker {
  private total = 0;

  add(costUsd: number): void {
    this.total += costUsd;
  }

  totalUsd(): number {
    return Math.round(this.total * 1e6) / 1e6;
  }

  reset(): void {
    this.total = 0;
  }
}
