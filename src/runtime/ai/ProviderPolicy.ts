/**
 * AI Runtime v2 (RFC-014) — provider policies.
 *
 * Declarative capability → { primary, fallback } map. Since RFC-014A wired a real
 * OpenAI provider, the shipped default makes **OpenAI the primary text/reasoning
 * provider with Gemini as fallback**; vision + image generation stay Gemini-only.
 * If `OPENAI_API_KEY` is absent the OpenAI provider is unavailable and the router
 * transparently falls back to Gemini. Override per capability via
 * `AI_POLICY_<CAPABILITY>=primary,fallback`. Pure.
 */

import type { AIProviderId } from "@/ai/types";
import { AI_CAPABILITIES, type AIRuntimePolicies, type ProviderPolicy } from "@/runtime/ai/types";

const KNOWN_PROVIDERS: ReadonlySet<string> = new Set(["gemini", "openai", "claude"]);

/**
 * Shipped default (RFC-014A) — OpenAI primary for text/reasoning with a Gemini
 * fallback; Gemini owns vision + image generation. Falls back to Gemini
 * automatically when OPENAI_API_KEY is unset.
 */
export const DEFAULT_POLICIES: AIRuntimePolicies = {
  explanation: { primary: "openai", fallback: "gemini" },
  summarization: { primary: "openai", fallback: "gemini" },
  conversation: { primary: "openai", fallback: "gemini" },
  vision: { primary: "gemini" },
  image_generation: { primary: "gemini" },
  embeddings: { primary: "gemini" },
};

/** Legacy Gemini-everywhere policy, kept for reference / easy rollback. */
export const GEMINI_ONLY_POLICIES: AIRuntimePolicies = {
  explanation: { primary: "gemini" },
  summarization: { primary: "gemini" },
  conversation: { primary: "gemini" },
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
