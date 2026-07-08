export {
  OUTFIT_SLOT_DEFINITIONS,
  categoryMatchesOutfitSlot,
  getOptionalOutfitSlots,
  getRequiredOutfitSlots,
} from "@/domain/outfit/slot-matching";

export {
  areFormalitiesCompatible,
  assessOutfitFormalityCompatibility,
  getFormalityRank,
} from "@/domain/outfit/formality-compatibility";

export {
  areColorsCompatible,
  assessOutfitColorCompatibility,
  isNeutralColor,
} from "@/domain/outfit/color-compatibility";

export {
  getOutfitSlotDefinitions,
  scoreOutfit,
  type OutfitScore,
  type OutfitScoringItem,
} from "@/domain/outfit/outfit-scoring";

export {
  DEFAULT_ENGINE_WEIGHTS,
  MIN_ITEMS_FOR_PAIRWISE,
  NEUTRAL_ENGINE_SCORE,
  OUTFIT_ENGINE_ASSUMPTIONS,
  OUTFIT_ENGINE_VERSION,
} from "@/domain/outfit/assumptions";

export type {
  EngineId,
  EngineRuleResult,
  EngineWeightMap,
  OccasionCategory,
  OutfitAnalysis,
  OutfitAnalysisBreakdown,
  OutfitEngineAssumption,
  OutfitEngineConfig,
  OutfitEngineItem,
  OutfitEngineModule,
  OutfitEvaluationContext,
  OutfitEvaluationInput,
  PrecipitationLevel,
  RuleResult,
  SeasonBucket,
  TextureFamily,
  WeatherContext,
  WindLevel,
} from "@/domain/outfit/types";

export {
  buildRuleResult,
  clampConfidence,
  clampScore0To10,
  categorizeOccasion,
  coverageConfidence,
  inferTextureFamily,
  MISSING_DATA_CONFIDENCE,
  normalizeSeasonLabel,
  scoreFromRatio,
  weightedAverageScore,
} from "@/domain/outfit/engine-utils";

export { ColorEngine, evaluateColorEngine } from "@/domain/outfit/color-engine";
export { FormalityEngine, evaluateFormalityEngine } from "@/domain/outfit/formality-engine";
export { SeasonEngine, evaluateSeasonEngine } from "@/domain/outfit/season-engine";
export { OccasionEngine, evaluateOccasionEngine } from "@/domain/outfit/occasion-engine";
export { TextureEngine, evaluateTextureEngine } from "@/domain/outfit/texture-engine";
export { WeatherEngine, evaluateWeatherEngine } from "@/domain/outfit/weather-engine";

export {
  DEFAULT_ENGINES,
  OutfitEngine,
  evaluateOutfit,
} from "@/domain/outfit/outfit-engine";

export { normalizeOccasion, resolveStyleOccasion } from "@/domain/outfit/occasion";
