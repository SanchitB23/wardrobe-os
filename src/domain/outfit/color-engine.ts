import { assessOutfitColorCompatibility } from "@/domain/outfit/color-compatibility";
import {
  buildEngineEvaluation,
  scoreFromRatio,
  uniqueRecommendations,
} from "@/domain/outfit/engine-utils";
import {
  MIN_ITEMS_FOR_PAIRWISE,
  NEUTRAL_ENGINE_SCORE,
} from "@/domain/outfit/assumptions";
import type {
  EngineEvaluation,
  OutfitEngineModule,
  OutfitEvaluationInput,
} from "@/domain/outfit/types";

function evaluateColorEngine(input: OutfitEvaluationInput): EngineEvaluation {
  const colors = input.items
    .map((item) => ({ hex: item.colorHex, name: item.colorName }))
    .filter((color) => color.hex || color.name);

  if (colors.length === 0) {
    return buildEngineEvaluation(
      "color",
      NEUTRAL_ENGINE_SCORE,
      "No color data was provided for outfit items.",
      ["Add primary colors to items for more accurate palette scoring."],
    );
  }

  if (colors.length < MIN_ITEMS_FOR_PAIRWISE) {
    return buildEngineEvaluation(
      "color",
      8,
      "Single-color outfit reads cohesive by default.",
      ["Introduce a complementary accent color for visual interest."],
    );
  }

  const assessment = assessOutfitColorCompatibility(colors);
  const score = scoreFromRatio(assessment.score);
  const recommendations = uniqueRecommendations([
    ...assessment.conflictingPairs.map(
      (pair) => `Swap or neutralize the pairing of ${pair.left} and ${pair.right}.`,
    ),
    assessment.compatible
      ? "Palette is harmonious — consider a neutral anchor piece."
      : "Anchor the outfit with navy, black, white, or beige to reduce clashes.",
  ]);

  return buildEngineEvaluation(
    "color",
    score,
    assessment.compatible
      ? "Colors are pairwise compatible across the outfit."
      : `Detected ${assessment.conflictingPairs.length} conflicting color pairing(s).`,
    recommendations,
  );
}

export const ColorEngine: OutfitEngineModule = {
  id: "color",
  evaluate: evaluateColorEngine,
};

export { evaluateColorEngine };
