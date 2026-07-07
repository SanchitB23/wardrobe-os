/**
 * RecommendationExplanationService — server-side.
 *
 * Turns a curated {@link ExplanationInput} into a validated
 * {@link RecommendationExplanation} by running the explanation prompt through
 * the app AI service. The AI only explains; it makes no recommendation
 * decisions. Structured JSON is validated by the parser before we return it —
 * on any failure this throws, and the caller (the API route) degrades
 * gracefully.
 *
 * Responses are cached (7-day TTL) via the AI service's cache, keyed on the
 * prompt builder + version + model + input, so an unchanged recommendation is
 * not re-sent to Gemini. `forceRefresh` bypasses the cache.
 *
 * The AIService is injectable so tests can run without a network or API key.
 */

import { getServerAIService } from "@/ai/server/ai-service.server";
import type { AIService } from "@/ai/types";
import {
  buildExplainSharedContext,
  buildExplanationInput,
} from "@/features/recommendations/ai/explanation-input";
import {
  EXPLANATION_PROMPT_VERSION,
  recommendationExplanationPromptBuilder,
} from "@/features/recommendations/ai/explanation.prompt-builder";
import { recommendationExplanationParser } from "@/features/recommendations/ai/explanation.schema";
import type {
  ExplanationInput,
  RecommendationExplanation,
} from "@/features/recommendations/ai/explanation.types";

/** Recommendation explanations cache for 7 days (req 6). */
const EXPLANATION_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Resolve the model the same way the Gemini provider does, for the cache key. */
function resolveModel(): string {
  return process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
}

export interface ExplainDeps {
  /** Defaults to the app-wide server AI service. */
  ai?: AIService;
  /** Injected timestamp for deterministic prompts (optional). */
  now?: string;
  /** Bypass the cache and regenerate (req 8). */
  forceRefresh?: boolean;
}

export interface ExplanationResult {
  explanation: RecommendationExplanation;
  /** True when served from cache rather than a fresh provider call (req 9). */
  cached: boolean;
}

export async function explainRecommendation(
  input: ExplanationInput,
  deps: ExplainDeps = {},
): Promise<ExplanationResult> {
  const ai = deps.ai ?? getServerAIService();
  const model = resolveModel();

  const built = recommendationExplanationPromptBuilder.build({
    task: "recommendation-explanation",
    data: { input },
    now: deps.now,
  });

  const response = await ai.generate<RecommendationExplanation>(
    {
      system: built.system,
      prompt: built.prompt,
      model,
      responseFormat: "json",
      temperature: 0.4,
      maxTokens: 700,
    },
    {
      parser: recommendationExplanationParser,
      forceRefresh: deps.forceRefresh,
      cache: {
        promptBuilder: recommendationExplanationPromptBuilder.id,
        promptVersion: EXPLANATION_PROMPT_VERSION,
        model,
        input,
        ttlSeconds: EXPLANATION_TTL_SECONDS,
      },
    },
  );

  if (!response.parsed) {
    // The parser attaches `parsed` or the orchestrator throws ParseError first;
    // this guard is a belt-and-braces contract check.
    throw new Error("Explanation response was not parsed.");
  }
  return { explanation: response.parsed, cached: Boolean(response.cached) };
}

// Re-export the pure builders so the route/tests have one import site.
export { buildExplainSharedContext, buildExplanationInput };
