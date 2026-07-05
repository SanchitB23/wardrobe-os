import {
  buildEngineEvaluation,
  categorizeOccasion,
  clampScore0To10,
  normalizeText,
  uniqueRecommendations,
} from "@/domain/outfit/engine-utils";
import { NEUTRAL_ENGINE_SCORE } from "@/domain/outfit/assumptions";
import type {
  EngineEvaluation,
  OccasionCategory,
  OutfitEngineItem,
  OutfitEngineModule,
  OutfitEvaluationInput,
} from "@/domain/outfit/types";
import { getFormalityRank } from "@/domain/outfit/formality-compatibility";

const OCCASION_FORMALITY_RANGE: Record<
  OccasionCategory,
  { min: number; max: number; label: string }
> = {
  athletic: { min: 0, max: 1, label: "casual to smart casual" },
  casual: { min: 0, max: 1, label: "casual to smart casual" },
  outdoor: { min: 0, max: 2, label: "casual to business casual" },
  smart_casual: { min: 1, max: 2, label: "smart casual to business casual" },
  business: { min: 2, max: 3, label: "business casual to business formal" },
  evening: { min: 2, max: 4, label: "business casual to formal" },
  formal: { min: 3, max: 4, label: "business formal to formal" },
  unknown: { min: 0, max: 4, label: "any formality" },
};

function itemMatchesOccasion(
  item: OutfitEngineItem,
  category: OccasionCategory,
): boolean {
  const tags = item.occasionTags ?? [];
  if (tags.some((tag) => categorizeOccasion(tag) === category)) {
    return true;
  }

  const rank = getFormalityRank(item.formality);
  if (rank === null) {
    return tags.length === 0;
  }

  const range = OCCASION_FORMALITY_RANGE[category];
  return rank >= range.min && rank <= range.max;
}

function evaluateOccasionEngine(input: OutfitEvaluationInput): EngineEvaluation {
  const targetCategory = categorizeOccasion(input.context?.targetOccasion);
  const targetLabel = normalizeText(input.context?.targetOccasion) || targetCategory;
  const items = input.items;

  if (targetCategory === "unknown" && items.every((item) => (item.occasionTags ?? []).length === 0)) {
    return buildEngineEvaluation(
      "occasion",
      NEUTRAL_ENGINE_SCORE,
      "No target occasion or item occasion tags were provided.",
      ["Set a target occasion such as office, date night, or travel."],
    );
  }

  const mismatched = items.filter((item) => !itemMatchesOccasion(item, targetCategory));
  const matchRatio =
    items.length === 0 ? 0 : (items.length - mismatched.length) / items.length;
  const score = clampScore0To10(matchRatio * 10);

  const range = OCCASION_FORMALITY_RANGE[targetCategory];
  const recommendations = uniqueRecommendations([
    mismatched.length > 0
      ? `Adjust ${mismatched.map((item) => item.name).join(", ")} toward ${range.label}.`
      : `Items suit a ${targetLabel || targetCategory} occasion.`,
    targetCategory === "formal"
      ? "Ensure footwear and outerwear match formal dress code."
      : "Confirm footwear formality matches the occasion intent.",
  ]);

  return buildEngineEvaluation(
    "occasion",
    score,
    mismatched.length === 0
      ? `Outfit suits a ${targetLabel || targetCategory} occasion.`
      : `${mismatched.length} item(s) are misaligned with a ${targetLabel || targetCategory} occasion.`,
    recommendations,
  );
}

export const OccasionEngine: OutfitEngineModule = {
  id: "occasion",
  evaluate: evaluateOccasionEngine,
};

export { evaluateOccasionEngine };
