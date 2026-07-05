import {
  buildEngineEvaluation,
  clampScore0To10,
  inferTextureFamily,
  uniqueRecommendations,
} from "@/domain/outfit/engine-utils";
import { NEUTRAL_ENGINE_SCORE } from "@/domain/outfit/assumptions";
import type {
  EngineEvaluation,
  OutfitEngineModule,
  OutfitEvaluationInput,
  TextureFamily,
} from "@/domain/outfit/types";

const HEAVY_TEXTURES = new Set<TextureFamily>(["knit", "leather", "denim"]);
const COMPLEMENTARY_PAIRS: Array<[TextureFamily, TextureFamily]> = [
  ["smooth", "knit"],
  ["smooth", "denim"],
  ["smooth", "leather"],
  ["denim", "knit"],
];

function isComplementary(left: TextureFamily, right: TextureFamily): boolean {
  if (left === right) {
    return true;
  }

  return COMPLEMENTARY_PAIRS.some(
    ([a, b]) =>
      (a === left && b === right) || (a === right && b === left),
  );
}

function evaluateTextureEngine(input: OutfitEvaluationInput): EngineEvaluation {
  const families = input.items.map((item) =>
    inferTextureFamily(item.material, item.texture),
  );
  const known = families.filter((family) => family !== "unknown");

  if (known.length === 0) {
    return buildEngineEvaluation(
      "texture",
      NEUTRAL_ENGINE_SCORE,
      "No material or texture data was available for outfit items.",
      ["Add material tags (wool, linen, denim) to improve texture scoring."],
    );
  }

  let pairwiseScore = 10;
  const recommendations: string[] = [];

  for (let index = 0; index < known.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < known.length; otherIndex += 1) {
      if (!isComplementary(known[index], known[otherIndex])) {
        pairwiseScore -= 2;
        recommendations.push(
          `Balance ${known[index]} and ${known[otherIndex]} textures with a smoother base piece.`,
        );
      }
    }
  }

  const heavyCount = known.filter((family) => HEAVY_TEXTURES.has(family)).length;
  if (heavyCount >= 3) {
    pairwiseScore -= 2;
    recommendations.push("Limit heavy textures to two focal pieces per outfit.");
  } else if (new Set(known).size === 1 && known.length >= 2) {
    pairwiseScore = Math.max(pairwiseScore, 7);
    recommendations.push("Monotexture outfit — add contrast via accessories or outerwear.");
  }

  const score = clampScore0To10(pairwiseScore);

  return buildEngineEvaluation(
    "texture",
    score,
    heavyCount >= 3
      ? "Outfit stacks too many heavy textures."
      : "Texture mix is within rule-based harmony bounds.",
    uniqueRecommendations(recommendations),
  );
}

export const TextureEngine: OutfitEngineModule = {
  id: "texture",
  evaluate: evaluateTextureEngine,
};

export { evaluateTextureEngine };
