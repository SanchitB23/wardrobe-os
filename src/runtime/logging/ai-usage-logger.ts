/**
 * AIUsageLogger (RFC-022) — emit one structured line per AI provider call.
 *
 * Integrates with RuntimeCostEstimator for estimatedCostUsd. Does not log raw
 * prompts, API keys, or image payloads.
 */

import type { AIProviderId, AIUsage } from "@/ai/types";
import { RuntimeCostEstimator } from "@/runtime/ai/RuntimeCostEstimator";
import { logger } from "@/runtime/logging/logger";
import { getRequestId, getRequestRoute } from "@/runtime/logging/request-context";
import type {
  AIUsageLogFields,
  AIUsageStatus,
  CostSource,
  TokenSource,
} from "@/runtime/logging/log-types";

const costEstimator = new RuntimeCostEstimator();

export interface AIUsageEventInput {
  capability: string;
  provider: string;
  model: string;
  fallbackProvider?: string | null;
  usedFallback?: boolean;
  promptVersion?: string;
  cacheHit?: boolean;
  usage?: AIUsage | null;
  /** Precomputed cost; when omitted, estimated via RuntimeCostEstimator. */
  estimatedCostUsd?: number | null;
  latencyMs?: number | null;
  status: AIUsageStatus;
  errorCode?: string | null;
  route?: string | null;
  requestId?: string | null;
  level?: "info" | "warn" | "error" | "debug";
  message?: string;
}

function tokenFields(usage: AIUsage | null | undefined): {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  tokenSource: TokenSource;
} {
  if (!usage) {
    return {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      tokenSource: "unavailable",
    };
  }
  return {
    inputTokens: usage.promptTokens ?? null,
    outputTokens: usage.completionTokens ?? null,
    totalTokens: usage.totalTokens ?? null,
    tokenSource: "provider",
  };
}

function costFields(
  input: AIUsageEventInput,
): { estimatedCostUsd: number | null; costSource: CostSource } {
  if (input.estimatedCostUsd != null) {
    return { estimatedCostUsd: input.estimatedCostUsd, costSource: "estimated" };
  }
  if (!input.usage || !input.model) {
    return { estimatedCostUsd: null, costSource: "unavailable" };
  }
  const usd = costEstimator.perCall(
    input.usage,
    input.provider as AIProviderId,
    input.model,
  );
  return { estimatedCostUsd: usd, costSource: "estimated" };
}

/** Build the AI usage field set (pure; useful for tests). */
export function buildAIUsageFields(input: AIUsageEventInput): AIUsageLogFields {
  const tokens = tokenFields(input.usage);
  const cost = costFields(input);
  return {
    route: input.route ?? getRequestRoute(),
    capability: input.capability,
    provider: input.provider,
    model: input.model,
    fallbackProvider: input.fallbackProvider ?? null,
    usedFallback: input.usedFallback ?? false,
    promptVersion: input.promptVersion ?? "adhoc",
    cacheHit: input.cacheHit ?? false,
    ...tokens,
    ...cost,
    latencyMs: input.latencyMs ?? null,
    status: input.status,
    errorCode: input.errorCode ?? null,
  };
}

/** Emit a structured `ai_usage` log line. */
export function logAIUsage(input: AIUsageEventInput): void {
  const fields = buildAIUsageFields(input);
  const level =
    input.level ??
    (input.status === "error" ? "error" : "info");
  logger.log({
    kind: "ai_usage",
    level,
    message: input.message ?? `ai_usage ${input.capability} ${input.status}`,
    source: "ai_runtime",
    requestId: input.requestId ?? getRequestId(),
    ...fields,
  });
}
