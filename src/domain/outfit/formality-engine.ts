import { assessOutfitFormalityCompatibility } from "@/domain/outfit/formality-compatibility";
import {
  buildEngineEvaluation,
  clampScore0To10,
  uniqueRecommendations,
} from "@/domain/outfit/engine-utils";
import { NEUTRAL_ENGINE_SCORE } from "@/domain/outfit/assumptions";
import type {
  EngineEvaluation,
  OutfitEngineModule,
  OutfitEvaluationInput,
} from "@/domain/outfit/types";
import { FORMALITY_LEVELS } from "@/types/wardrobe";

function evaluateFormalityEngine(input: OutfitEvaluationInput): EngineEvaluation {
  const formalities = input.items.map((item) => item.formality);
  const defined = formalities.filter(Boolean);

  if (defined.length === 0) {
    return buildEngineEvaluation(
      "formality",
      NEUTRAL_ENGINE_SCORE,
      "No formality levels were set on outfit items.",
      ["Tag each item with a formality level to tighten outfit coherence."],
    );
  }

  const assessment = assessOutfitFormalityCompatibility(formalities);
  const spreadPenalty = assessment.spread * 1.5;
  const score = assessment.compatible
    ? clampScore0To10(10 - spreadPenalty * 0.5)
    : clampScore0To10(7 - spreadPenalty);

  const recommendations = uniqueRecommendations([
    assessment.outliers.length > 0
      ? `Replace or restyle ${assessment.outliers.join(", ")} pieces toward ${assessment.dominantFormality ?? "the dominant level"}.`
      : "Formality levels are aligned across items.",
    `Target formality ladder: ${FORMALITY_LEVELS.join(" → ")}.`,
  ]);

  return buildEngineEvaluation(
    "formality",
    score,
    assessment.compatible
      ? `Formality spread is ${assessment.spread} step(s) — within acceptable range.`
      : `Formality spread is ${assessment.spread} step(s) — outfit mixes incompatible dress codes.`,
    recommendations,
  );
}

export const FormalityEngine: OutfitEngineModule = {
  id: "formality",
  evaluate: evaluateFormalityEngine,
};

export { evaluateFormalityEngine };
