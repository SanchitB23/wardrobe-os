/**
 * Prompt builder for the Lifestyle Plan explanation (RFC-006, AI layer). Reuses
 * the vendor-neutral prompt-builder architecture. The model is instructed to
 * EXPLAIN the already-computed plan only — it never re-plans or decides
 * anything (ADR-005). It sees only the curated {@link LifestylePlanExplanationInput}.
 */

import { createPromptBuilder } from "@/ai/prompt-builders";
import {
  lifestylePlanExplanationSchema,
  type LifestylePlanExplanationInput,
} from "@/ai/schemas/LifestylePlanExplanation.schema";
import type { PromptBuilder, PromptContext } from "@/ai/types";

export interface LifestylePlanExplanationContext extends PromptContext {
  task: "lifestyle-plan-explanation";
  data: { input: LifestylePlanExplanationInput };
}

export const lifestylePlanExplanationPromptBuilder: PromptBuilder<LifestylePlanExplanationContext> =
  createPromptBuilder<LifestylePlanExplanationContext>({
    id: "lifestyle-plan-explanation",
    schema: lifestylePlanExplanationSchema,
    render(context) {
      return {
        system:
          "You explain an ALREADY-COMPUTED trip plan from Wardrobe OS. Do NOT change the plan, packing, capsule, score, or any decision — only explain them in plain, friendly, practical language for the traveller. Ground every statement in the provided plan; invent nothing (no items, weather, or facts not present). Return ONLY the requested JSON.",
        prompt: [
          "Explain this trip plan.",
          "",
          "PLAN (deterministic outputs only):",
          JSON.stringify(context.data.input),
        ].join("\n"),
      };
    },
  });
