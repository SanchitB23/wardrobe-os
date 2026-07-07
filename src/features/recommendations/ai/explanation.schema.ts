/**
 * Structured-output schema + parser for recommendation explanations.
 *
 * Built on the vendor-neutral AI layer helpers so validation stays independent
 * of any provider. The model must return exactly the five fields below; the
 * parser extracts JSON from the response and validates it before we trust it.
 */

import { createJsonResponseParser, objectSchema } from "@/ai/schemas";
import type { ResponseParser, ResponseSchema } from "@/ai/types";
import type { RecommendationExplanation } from "@/features/recommendations/ai/explanation.types";

export const recommendationExplanationSchema: ResponseSchema<RecommendationExplanation> =
  objectSchema<RecommendationExplanation>({
    name: "RecommendationExplanation",
    description:
      "a natural-language explanation of an already-chosen outfit recommendation",
    jsonHint: JSON.stringify({
      summary: "One or two sentences describing the look.",
      whyThisWorks: "Why these pieces work together for this context.",
      stylingTips: ["A short, actionable tip.", "Another tip."],
      confidenceExplanation:
        "Plain-language reason the recommendation scored the way it did.",
      thingsToAvoid: ["A pitfall to avoid with this outfit."],
    }),
    fields: {
      summary: { type: "string" },
      whyThisWorks: { type: "string" },
      stylingTips: { type: "array" },
      confidenceExplanation: { type: "string" },
      thingsToAvoid: { type: "array" },
    },
  });

export const recommendationExplanationParser: ResponseParser<RecommendationExplanation> =
  createJsonResponseParser(recommendationExplanationSchema);
