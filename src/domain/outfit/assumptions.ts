import type { EngineWeightMap, OutfitEngineAssumption } from "@/domain/outfit/types";

/**
 * Rule-based outfit engine assumptions.
 * These are intentional simplifications — not ML predictions.
 */
export const OUTFIT_ENGINE_ASSUMPTIONS: readonly OutfitEngineAssumption[] = [
  {
    id: "scores-0-10",
    description:
      "All engine scores are on a 0–10 scale. Missing item metadata yields neutral mid-scores rather than failures.",
  },
  {
    id: "no-ai",
    description:
      "Scoring is deterministic and rule-based. No embeddings, LLMs, or probabilistic models are used.",
  },
  {
    id: "season-normalization",
    description:
      "Season labels are normalized into spring, summer, autumn, winter, all_season, or transitional buckets.",
  },
  {
    id: "occasion-formality-bridge",
    description:
      "Occasion labels are mapped to categories with expected formality ranges that cross-check item formality.",
  },
  {
    id: "texture-from-material",
    description:
      "When texture is omitted, material names are heuristically mapped to texture families (wool → knit, leather → leather, etc.).",
  },
  {
    id: "weather-outerwear",
    description:
      "Cold (<12°C), hot (>28°C), and rainy conditions adjust scores based on outerwear presence and heavy fabrics.",
  },
  {
    id: "composite-weighting",
    description:
      "The overall score is a weighted average of sub-engine scores. Weights can be overridden per caller.",
  },
];

/** Default relative importance of each engine in the composite score. */
export const DEFAULT_ENGINE_WEIGHTS: EngineWeightMap = {
  color: 0.2,
  formality: 0.2,
  season: 0.15,
  occasion: 0.15,
  texture: 0.15,
  weather: 0.15,
};

/**
 * Semantic version of the outfit analysis contract. Bump when RuleResult or
 * OutfitAnalysis shape or scoring semantics change.
 */
export const OUTFIT_ENGINE_VERSION = "2.0.0";

/** Score returned when an engine lacks enough data to judge confidently. */
export const NEUTRAL_ENGINE_SCORE = 6;

/** Minimum item count before color/formality/texture engines run pairwise logic. */
export const MIN_ITEMS_FOR_PAIRWISE = 2;
