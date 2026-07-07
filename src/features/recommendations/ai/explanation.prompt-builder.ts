/**
 * Prompt builder for recommendation explanations.
 *
 * Built on the vendor-neutral `createPromptBuilder`, so it has no knowledge of
 * any provider. It receives ONLY the curated {@link ExplanationInput} (no raw
 * wardrobe) and asks the model to EXPLAIN the already-chosen recommendation —
 * never to re-decide it or invent items. Output shape is enforced by
 * {@link recommendationExplanationSchema}.
 */

import { createPromptBuilder } from "@/ai/prompt-builders";
import type { PromptBuilder, PromptContext } from "@/ai/types";
import { recommendationExplanationSchema } from "@/features/recommendations/ai/explanation.schema";
import type { ExplanationInput } from "@/features/recommendations/ai/explanation.types";

export interface ExplanationPromptContext extends PromptContext {
  task: "recommendation-explanation";
  data: { input: ExplanationInput };
}

/**
 * Version of the explanation prompt. Bump this whenever the prompt/system text
 * changes so previously cached explanations are treated as stale (the cache key
 * folds this in). Kept in sync with `recommendationExplanationPromptBuilder.id`.
 */
export const EXPLANATION_PROMPT_VERSION = "v1";

const SYSTEM = [
  "You are a concise personal stylist for a single user's wardrobe.",
  "You are given an outfit recommendation that was ALREADY chosen by a deterministic engine, together with its analysis and short context summaries.",
  "Your job is ONLY to explain that recommendation in natural language — do NOT change it, do NOT pick different items, and do NOT invent items or facts that are not present in the input.",
  "Ground every statement in the provided recommendation, analysis, wardrobe health, insights, weather, and commute. If the input is thin, keep the explanation modest rather than fabricating detail.",
  "Keep it friendly, specific, and brief. Return ONLY the requested JSON.",
].join(" ");

export const recommendationExplanationPromptBuilder: PromptBuilder<ExplanationPromptContext> =
  createPromptBuilder<ExplanationPromptContext>({
    id: "recommendation-explanation",
    schema: recommendationExplanationSchema,
    render(context) {
      const { input } = context.data;
      return {
        system: SYSTEM,
        prompt: [
          context.now ? `Today: ${context.now}` : undefined,
          "Explain this recommendation for the user.",
          "",
          "RECOMMENDATION:",
          JSON.stringify(input.recommendation),
          "",
          "OUTFIT ANALYSIS:",
          JSON.stringify(input.outfitAnalysis),
          "",
          "WARDROBE HEALTH SUMMARY:",
          JSON.stringify(input.wardrobeHealth),
          "",
          "INSIGHT SUMMARY:",
          JSON.stringify(input.insights),
          "",
          "WEATHER:",
          JSON.stringify(input.weather),
          "",
          "COMMUTE:",
          JSON.stringify(input.commute),
        ]
          .filter((line) => line !== undefined)
          .join("\n"),
      };
    },
  });
