/**
 * AI Runtime v2 (RFC-014) — provider policies.
 *
 * Declarative capability → { primary, fallback } map. **Cost-first (RFC-014A):**
 * Gemini is primary for conversation / explanation / summarization / vision;
 * OpenAI is used selectively for cheap, high-value **structured** and
 * **classification** tasks (with Gemini as fallback). If `OPENAI_API_KEY` is
 * absent — or the OpenAI budget guard trips — the OpenAI provider is unavailable
 * and the router transparently falls back to Gemini. Override per capability via
 * `AI_POLICY_<CAPABILITY>=primary,fallback`. Pure.
 */

import type { AIProviderId } from "@/ai/types";
import { AI_CAPABILITIES, type AIRuntimePolicies, type ProviderPolicy } from "@/runtime/ai/types";

const KNOWN_PROVIDERS: ReadonlySet<string> = new Set(["gemini", "openai", "claude"]);

/**
 * Shipped default (RFC-014A) — **cost-first, Gemini-first**. Gemini owns text +
 * vision; OpenAI is primary only for structured JSON + classification (cheap
 * gpt-5.4 mini/nano), always with a Gemini fallback. Never routes to OpenAI's
 * premium model by default.
 */
export const DEFAULT_POLICIES: AIRuntimePolicies = {
  conversation: { primary: "gemini", fallback: "openai" },
  explanation: { primary: "gemini", fallback: "openai" },
  summarization: { primary: "gemini", fallback: "openai" },
  structured: { primary: "openai", fallback: "gemini" },
  classification: { primary: "openai", fallback: "gemini" },
  vision: { primary: "gemini" },
  image_generation: { primary: "openai", fallback: "gemini" },
  embeddings: { primary: "gemini" },
};

/** Gemini-everywhere policy, kept for reference / easy rollback (zero OpenAI spend). */
export const GEMINI_ONLY_POLICIES: AIRuntimePolicies = {
  conversation: { primary: "gemini" },
  explanation: { primary: "gemini" },
  summarization: { primary: "gemini" },
  structured: { primary: "gemini" },
  classification: { primary: "gemini" },
  vision: { primary: "gemini" },
  image_generation: { primary: "gemini" },
  embeddings: { primary: "gemini" },
};

function parsePolicy(value: string | undefined): ProviderPolicy | null {
  if (!value) return null;
  const [primary, fallback] = value.split(",").map((s) => s.trim().toLowerCase());
  if (!primary || !KNOWN_PROVIDERS.has(primary)) return null;
  const policy: ProviderPolicy = { primary };
  if (fallback && KNOWN_PROVIDERS.has(fallback)) policy.fallback = fallback as AIProviderId;
  return policy;
}

/**
 * Load policies, applying `AI_POLICY_<CAPABILITY>` overrides from `env` over the
 * defaults. Deterministic given `env`.
 */
export function loadPolicies(
  env: Record<string, string | undefined> = process.env,
  base: AIRuntimePolicies = DEFAULT_POLICIES,
): AIRuntimePolicies {
  const result = { ...base } as AIRuntimePolicies;
  for (const capability of AI_CAPABILITIES) {
    const override = parsePolicy(env[`AI_POLICY_${capability.toUpperCase()}`]);
    if (override) result[capability] = { ...result[capability], ...override };
  }
  return result;
}

export function isKnownProvider(id: string): boolean {
  return KNOWN_PROVIDERS.has(id);
}
