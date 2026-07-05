import { assessOutfitColorCompatibility } from "@/domain/outfit/color-compatibility";
import {
  buildRuleResult,
  coverageConfidence,
  MISSING_DATA_CONFIDENCE,
  scoreFromRatio,
  uniqueRecommendations,
} from "@/domain/outfit/engine-utils";
import { MIN_ITEMS_FOR_PAIRWISE } from "@/domain/outfit/assumptions";
import { NEUTRAL_ENGINE_SCORE } from "@/domain/outfit/assumptions";
import type {
  EngineRuleResult,
  OutfitEngineModule,
  OutfitEvaluationInput,
} from "@/domain/outfit/types";

function evaluateColorEngine(input: OutfitEvaluationInput): EngineRuleResult {
  const colors = input.items
    .map((item) => ({ hex: item.colorHex, name: item.colorName }))
    .filter((color) => color.hex || color.name);

  if (colors.length === 0) {
    return buildRuleResult(
      "color",
      NEUTRAL_ENGINE_SCORE,
      "No color data was provided for outfit items.",
      {
        confidence: MISSING_DATA_CONFIDENCE,
        suggestions: [
          "Add primary colors to items for more accurate palette scoring.",
        ],
      },
    );
  }

  const confidence = coverageConfidence(colors.length, input.items.length);

  if (colors.length < MIN_ITEMS_FOR_PAIRWISE) {
    return buildRuleResult(
      "color",
      8,
      "Single-color outfit reads cohesive by default.",
      {
        confidence,
        suggestions: [
          "Introduce a complementary accent color for visual interest.",
        ],
      },
    );
  }

  const assessment = assessOutfitColorCompatibility(colors);
  const score = scoreFromRatio(assessment.score);
  const suggestions = uniqueRecommendations([
    ...assessment.conflictingPairs.map(
      (pair) => `Swap or neutralize the pairing of ${pair.left} and ${pair.right}.`,
    ),
    assessment.compatible
      ? "Palette is harmonious — consider a neutral anchor piece."
      : "Anchor the outfit with navy, black, white, or beige to reduce clashes.",
  ]);

  return buildRuleResult(
    "color",
    score,
    assessment.compatible
      ? "Colors are pairwise compatible across the outfit."
      : `Detected ${assessment.conflictingPairs.length} conflicting color pairing(s).`,
    {
      confidence,
      suggestions,
      weaknesses: assessment.compatible
        ? []
        : assessment.conflictingPairs.map(
            (pair) => `${pair.left} clashes with ${pair.right}.`,
          ),
    },
  );
}

export const ColorEngine: OutfitEngineModule = {
  id: "color",
  evaluate: evaluateColorEngine,
};

export { evaluateColorEngine };
