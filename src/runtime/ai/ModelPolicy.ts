/**
 * AI Runtime v2 — model policy (RFC-014A). Separates *which provider* (provider
 * policy) from *which model* (model policy):
 *
 *   capability → provider policy → provider → model policy → model
 *
 * Cost-first model selection for OpenAI: classification uses the cheapest Nano
 * model, structured/text use Mini. The premium model (gpt-5.5) is defined but
 * **never selected by default** — callers must opt in explicitly. Gemini uses its
 * single `GEMINI_MODEL` (the provider defaults it when unset). Pure: model ids
 * come only from env + these constants, never hard-coded in feature code.
 */

import type { AIProviderId } from "@/ai/types";
import type { AICapability } from "@/runtime/ai/types";

export const OPENAI_DEFAULT_TEXT_MODEL = "gpt-5.4-mini";
export const OPENAI_DEFAULT_STRUCTURED_MODEL = "gpt-5.4-mini";
export const OPENAI_DEFAULT_CLASSIFIER_MODEL = "gpt-5.4-nano";
/** Premium — future/manual use only; never a default. */
export const OPENAI_PREMIUM_MODEL = "gpt-5.5";

type Env = Record<string, string | undefined>;

/**
 * Resolve the model id for a (capability, provider) pair. Returns `undefined`
 * when the provider should use its own default (e.g. Gemini with no `GEMINI_MODEL`
 * set, or providers without a configured model) — the provider then falls back.
 */
export function resolveModel(
  capability: AICapability,
  provider: AIProviderId,
  env: Env = process.env,
): string | undefined {
  if (provider === "gemini") {
    // The Gemini provider resolves its own default from GEMINI_MODEL; passing it
    // through keeps the dashboard/metrics honest.
    return env.GEMINI_MODEL || undefined;
  }

  if (provider === "openai") {
    if (capability === "classification") {
      return env.OPENAI_MODEL_CLASSIFIER || OPENAI_DEFAULT_CLASSIFIER_MODEL;
    }
    if (capability === "structured") {
      return env.OPENAI_MODEL_STRUCTURED || OPENAI_DEFAULT_STRUCTURED_MODEL;
    }
    // conversation / explanation / summarization / image-gen prompt / other text.
    return env.OPENAI_MODEL_TEXT || OPENAI_DEFAULT_TEXT_MODEL;
  }

  // Unknown/other providers (e.g. claude stub) — let the provider decide.
  return undefined;
}

/** The premium OpenAI model id (opt-in only; not used by default routing). */
export function premiumModel(env: Env = process.env): string {
  return env.OPENAI_MODEL_PREMIUM || OPENAI_PREMIUM_MODEL;
}
