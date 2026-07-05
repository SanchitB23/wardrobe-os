import { assessOutfitFormalityCompatibility } from "@/domain/outfit/formality-compatibility";
import {
  buildRuleResult,
  clampScore0To10,
  coverageConfidence,
  MISSING_DATA_CONFIDENCE,
  uniqueRecommendations,
} from "@/domain/outfit/engine-utils";
import { NEUTRAL_ENGINE_SCORE } from "@/domain/outfit/assumptions";
import type {
  EngineRuleResult,
  OutfitEngineModule,
  OutfitEvaluationInput,
} from "@/domain/outfit/types";
import { FORMALITY_LEVELS } from "@/types/wardrobe";

function evaluateFormalityEngine(input: OutfitEvaluationInput): EngineRuleResult {
  const formalities = input.items.map((item) => item.formality);
  const defined = formalities.filter(Boolean);

  if (defined.length === 0) {
    return buildRuleResult(
      "formality",
      NEUTRAL_ENGINE_SCORE,
      "No formality levels were set on outfit items.",
      {
        confidence: MISSING_DATA_CONFIDENCE,
        suggestions: [
          "Tag each item with a formality level to tighten outfit coherence.",
        ],
      },
    );
  }

  const assessment = assessOutfitFormalityCompatibility(formalities);
  const spreadPenalty = assessment.spread * 1.5;
  const score = assessment.compatible
    ? clampScore0To10(10 - spreadPenalty * 0.5)
    : clampScore0To10(7 - spreadPenalty);

  const suggestions = uniqueRecommendations([
    assessment.outliers.length > 0
      ? `Replace or restyle ${assessment.outliers.join(", ")} pieces toward ${assessment.dominantFormality ?? "the dominant level"}.`
      : "Formality levels are aligned across items.",
    `Target formality ladder: ${FORMALITY_LEVELS.join(" → ")}.`,
  ]);

  return buildRuleResult(
    "formality",
    score,
    assessment.compatible
      ? `Formality spread is ${assessment.spread} step(s) — within acceptable range.`
      : `Formality spread is ${assessment.spread} step(s) — outfit mixes incompatible dress codes.`,
    {
      confidence: coverageConfidence(defined.length, input.items.length),
      suggestions,
      weaknesses: assessment.compatible
        ? []
        : uniqueRecommendations([
            `Formality spread is ${assessment.spread} step(s) — outfit mixes incompatible dress codes.`,
            ...assessment.outliers.map(
              (outlier) => `${outlier} sits outside the dominant dress code.`,
            ),
          ]),
    },
  );
}

export const FormalityEngine: OutfitEngineModule = {
  id: "formality",
  evaluate: evaluateFormalityEngine,
};

export { evaluateFormalityEngine };
