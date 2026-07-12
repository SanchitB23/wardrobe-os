/**
 * LifestyleExplanationService (RFC-006) — server-side. Turns a curated
 * {@link LifestylePlanExplanationInput} into a validated
 * {@link LifestylePlanExplanation} via AIRuntime (capability: explanation,
 * 7-day cache). The AI only explains the deterministic plan — it never
 * re-plans or decides (ADR-005). Structured JSON is validated by the parser
 * before returning; on any failure this throws and the caller degrades
 * gracefully. The runtime is injectable for tests.
 */

import { lifestylePlanExplanationPromptBuilder } from "@/ai/prompt-builders/LifestylePlanExplanationPromptBuilder";
import {
  LIFESTYLE_PLAN_EXPLANATION_PROMPT_VERSION,
  lifestylePlanExplanationParser,
  type LifestylePlanExplanation,
  type LifestylePlanExplanationInput,
} from "@/ai/schemas/LifestylePlanExplanation.schema";
import { getServerAIRuntime } from "@/ai/server/ai-runtime.server";
import type { AIRuntime } from "@/runtime/ai";

const EXPLANATION_TTL_SECONDS = 7 * 24 * 60 * 60;

function resolveModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

export interface ExplainLifestyleDeps {
  runtime?: Pick<AIRuntime, "run">;
  now?: string;
  forceRefresh?: boolean;
}

export interface LifestyleExplanationResult {
  explanation: LifestylePlanExplanation;
  /** True when served from cache rather than a fresh provider call. */
  cached: boolean;
}

export async function explainLifestylePlan(
  input: LifestylePlanExplanationInput,
  deps: ExplainLifestyleDeps = {},
): Promise<LifestyleExplanationResult> {
  const runtime = deps.runtime ?? getServerAIRuntime();
  const model = resolveModel();

  const built = lifestylePlanExplanationPromptBuilder.build({
    task: "lifestyle-plan-explanation",
    data: { input },
    now: deps.now,
  });

  const result = await runtime.run<LifestylePlanExplanation>({
    capability: "explanation",
    request: {
      system: built.system,
      prompt: built.prompt,
      model,
      responseFormat: "json",
      temperature: 0.4,
      maxTokens: 900,
    },
    parser: lifestylePlanExplanationParser,
    forceRefresh: deps.forceRefresh,
    cache: {
      promptBuilder: lifestylePlanExplanationPromptBuilder.id,
      promptVersion: LIFESTYLE_PLAN_EXPLANATION_PROMPT_VERSION,
      model,
      input,
      ttlSeconds: EXPLANATION_TTL_SECONDS,
    },
  });

  if (!result.parsed) throw new Error("Explanation was not parsed.");
  return { explanation: result.parsed, cached: Boolean(result.cached) };
}
