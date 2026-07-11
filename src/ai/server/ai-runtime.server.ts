/**
 * Server-side AI Runtime v2 composition root (RFC-014).
 *
 * Registers the available providers (Gemini real; OpenAI/Claude stubs until their
 * SDKs are wired), loads the capability → provider policies from env, and shares
 * the process-local metrics sink. This is additive: existing AI features keep
 * using `getServerAIService()` unchanged — the runtime is exposed for the
 * Developer dashboard and future capability-routed callers. Server-only.
 */

import { createServerAICache } from "@/ai/server/ai-service.server";
import { ClaudeProvider } from "@/ai/providers/claude-provider";
import { GeminiProvider } from "@/ai/providers/gemini-provider";
import { OpenAIProvider } from "@/ai/providers/openai-provider";
import { AIRuntime, aiRuntimeMetrics, loadBudgetConfig, loadPolicies } from "@/runtime/ai";

function assertServerSide(): void {
  if (typeof window !== "undefined") {
    throw new Error("AI runtime is server-side only and must not be imported into client code.");
  }
}

let cached: AIRuntime | undefined;

/**
 * The app-wide {@link AIRuntime}. Gemini and OpenAI are real providers (RFC-014A);
 * Claude is still a stub. **Cost-first default:** Gemini is primary for text +
 * vision; OpenAI is primary only for structured + classification (with Gemini
 * fallback). When `OPENAI_API_KEY` is unset — or the OpenAI budget hard stop is
 * reached — OpenAI is unavailable and routing falls back to Gemini. Policies come
 * from `AI_POLICY_<CAP>` env overrides; the budget from `OPENAI_*_USD` env.
 */
export function getServerAIRuntime(): AIRuntime {
  assertServerSide();
  if (cached) return cached;

  cached = new AIRuntime({
    providers: [new GeminiProvider(), new OpenAIProvider(), new ClaudeProvider()],
    policies: loadPolicies(process.env),
    budget: loadBudgetConfig(process.env),
    env: process.env,
    metrics: aiRuntimeMetrics,
    cache: createServerAICache(),
    // Gemini already retries once internally; keep runtime retry at 1 to bound cost.
    retries: 1,
  });
  return cached;
}

/** Test/maintenance helper — drops the memoized runtime. */
export function resetServerAIRuntime(): void {
  cached = undefined;
}
