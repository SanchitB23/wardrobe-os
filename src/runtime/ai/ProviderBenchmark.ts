/**
 * AI Runtime v2 (RFC-014) — provider benchmarking (developer tool, off the hot
 * path). Runs the same capability request across several providers and returns a
 * latency / cost / token comparison. Isolates each provider (no fallback) so the
 * comparison is per-provider. Does not touch the shared metrics sink.
 */

import { estimateCost } from "@/runtime/ai/CostTracker";
import type { ProviderRouter } from "@/runtime/ai/ProviderRouter";
import type {
  AICapability,
  BenchmarkEntry,
  BenchmarkResult,
  MechanicalCapability,
} from "@/runtime/ai/types";
import type { AIProviderId, AIRequest } from "@/ai/types";

export async function benchmarkCapability(args: {
  router: ProviderRouter;
  capability: AICapability;
  mechanical: MechanicalCapability;
  request: AIRequest;
  providerIds: AIProviderId[];
  promptVersion: string;
}): Promise<BenchmarkResult> {
  const { router, capability, mechanical, request, providerIds, promptVersion } = args;
  const entries: BenchmarkEntry[] = [];

  for (const id of providerIds) {
    try {
      // Isolate each provider — a single-primary policy, no fallback.
      const outcome = await router.route({ primary: id }, mechanical, request);
      const { response } = outcome;
      entries.push({
        provider: id,
        ok: true,
        latencyMs: response.latencyMs ?? null,
        totalTokens: response.usage?.totalTokens ?? 0,
        costUsd: estimateCost(response.usage, id, response.model),
      });
    } catch (error) {
      entries.push({
        provider: id,
        ok: false,
        latencyMs: null,
        totalTokens: 0,
        costUsd: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { capability, promptVersion, entries };
}
