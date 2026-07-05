import {
  buildRuleResult,
  clampScore0To10,
  coverageConfidence,
  MISSING_DATA_CONFIDENCE,
  normalizeSeasonLabel,
  uniqueRecommendations,
} from "@/domain/outfit/engine-utils";
import { NEUTRAL_ENGINE_SCORE } from "@/domain/outfit/assumptions";
import type {
  EngineRuleResult,
  OutfitEngineItem,
  OutfitEngineModule,
  OutfitEvaluationInput,
  SeasonBucket,
} from "@/domain/outfit/types";

const ADJACENT_SEASONS: Record<SeasonBucket, SeasonBucket[]> = {
  spring: ["spring", "transitional", "all_season"],
  summer: ["summer", "transitional", "all_season"],
  autumn: ["autumn", "transitional", "all_season"],
  winter: ["winter", "transitional", "all_season"],
  all_season: ["spring", "summer", "autumn", "winter", "all_season", "transitional"],
  transitional: ["spring", "autumn", "transitional", "all_season"],
};

function collectItemSeasons(item: OutfitEngineItem): SeasonBucket[] {
  const buckets = (item.seasonTags ?? [])
    .map((tag) => normalizeSeasonLabel(tag))
    .filter((bucket): bucket is SeasonBucket => bucket !== null);

  return buckets.length > 0 ? buckets : [];
}

function itemMatchesTargetSeason(
  item: OutfitEngineItem,
  target: SeasonBucket,
): boolean {
  const itemSeasons = collectItemSeasons(item);
  if (itemSeasons.length === 0) {
    return true;
  }

  const allowed = ADJACENT_SEASONS[target];
  return itemSeasons.some((season) => allowed.includes(season));
}

function evaluateSeasonEngine(input: OutfitEvaluationInput): EngineRuleResult {
  const target = normalizeSeasonLabel(input.context?.targetSeason);
  const items = input.items;
  const taggedCount = items.filter(
    (item) => collectItemSeasons(item).length > 0,
  ).length;

  if (!target) {
    if (taggedCount === 0) {
      return buildRuleResult(
        "season",
        NEUTRAL_ENGINE_SCORE,
        "No target season or item season tags were provided.",
        {
          confidence: MISSING_DATA_CONFIDENCE,
          suggestions: [
            "Set an outfit season or tag items with seasonal suitability.",
          ],
        },
      );
    }

    const uniqueBuckets = new Set(
      items.flatMap((item) => collectItemSeasons(item)),
    );
    const score = uniqueBuckets.size <= 2 ? 8 : 5;

    return buildRuleResult(
      "season",
      score,
      `Items span ${uniqueBuckets.size} season bucket(s) without a target season.`,
      {
        confidence: coverageConfidence(taggedCount, items.length),
        suggestions:
          uniqueBuckets.size > 2
            ? ["Narrow seasonal tags to one primary season for stronger cohesion."]
            : ["Season tagging is consistent across items."],
      },
    );
  }

  const mismatched = items.filter((item) => !itemMatchesTargetSeason(item, target));
  const matchRatio =
    items.length === 0 ? 0 : (items.length - mismatched.length) / items.length;
  const score = clampScore0To10(matchRatio * 10);

  const suggestions = uniqueRecommendations([
    mismatched.length > 0
      ? `Swap ${mismatched.map((item) => item.name).join(", ")} for ${target}-appropriate pieces.`
      : `All items align with the ${target} season target.`,
    "Use all-season layers to bridge transitional weather.",
  ]);

  return buildRuleResult(
    "season",
    score,
    mismatched.length === 0
      ? `Outfit aligns with the ${target} season target.`
      : `${mismatched.length} item(s) fall outside the ${target} season window.`,
    {
      confidence: coverageConfidence(taggedCount, items.length),
      suggestions,
      weaknesses: mismatched.map(
        (item) => `${item.name} is not suited to ${target}.`,
      ),
    },
  );
}

export const SeasonEngine: OutfitEngineModule = {
  id: "season",
  evaluate: evaluateSeasonEngine,
};

export { evaluateSeasonEngine };
