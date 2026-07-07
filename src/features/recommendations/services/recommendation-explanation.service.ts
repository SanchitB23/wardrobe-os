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
 * The AIService is injectable so tests can run without a network or API key.
 */

import { getServerAIService } from "@/ai/server/ai-service.server";
import type { AIService } from "@/ai/types";
import {
  buildExplanationInput,
  buildExplainSharedContext,
} from "@/features/recommendations/ai/explanation-input";
import { explanationCacheKey } from "@/features/recommendations/ai/explanation-input";
import { recommendationExplanationParser } from "@/features/recommendations/ai/explanation.schema";
import { recommendationExplanationPromptBuilder } from "@/features/recommendations/ai/explanation.prompt-builder";
import type {
  ExplanationInput,
  RecommendationExplanation,
} from "@/features/recommendations/ai/explanation.types";

export interface ExplainDeps {
  /** Defaults to the app-wide server AI service. */
  ai?: AIService;
  /** Injected timestamp for deterministic prompts (optional). */
  now?: string;
}

export async function explainRecommendation(
  input: ExplanationInput,
  deps: ExplainDeps = {},
): Promise<RecommendationExplanation> {
  const ai = deps.ai ?? getServerAIService();

  const built = recommendationExplanationPromptBuilder.build({
    task: "recommendation-explanation",
    data: { input },
    now: deps.now,
  });

  const response = await ai.generate<RecommendationExplanation>(
    {
      system: built.system,
      prompt: built.prompt,
      responseFormat: "json",
      temperature: 0.4,
      maxTokens: 700,
    },
    {
      parser: recommendationExplanationParser,
      cacheKey: explanationCacheKey(input),
    },
  );

  if (!response.parsed) {
    // The parser attaches `parsed` or the orchestrator throws ParseError first;
    // this guard is a belt-and-braces contract check.
    throw new Error("Explanation response was not parsed.");
  }
  return response.parsed;
}

// Re-export the pure builders so the route/tests have one import site.
export { buildExplainSharedContext, buildExplanationInput };
