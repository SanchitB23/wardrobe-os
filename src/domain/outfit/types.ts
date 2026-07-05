import type { FormalityEnum, OutfitSlot } from "@/types/wardrobe";

/** Identifiers for pluggable outfit scoring engines. */
export type EngineId =
  | "color"
  | "formality"
  | "season"
  | "occasion"
  | "texture"
  | "weather";

/** Normalized season buckets used by the season engine. */
export type SeasonBucket =
  | "spring"
  | "summer"
  | "autumn"
  | "winter"
  | "all_season"
  | "transitional";

/** Texture families inferred from material names or explicit tags. */
export type TextureFamily =
  | "smooth"
  | "knit"
  | "denim"
  | "leather"
  | "technical"
  | "unknown";

/** Precipitation levels for weather-aware scoring. */
export type PrecipitationLevel = "none" | "light" | "heavy";

/** Wind levels for weather-aware scoring. */
export type WindLevel = "calm" | "moderate" | "strong";

/** Occasion categories mapped from free-text occasion labels. */
export type OccasionCategory =
  | "casual"
  | "smart_casual"
  | "business"
  | "formal"
  | "athletic"
  | "outdoor"
  | "evening"
  | "unknown";

/** Shared result shape returned by every sub-engine. */
export interface EngineEvaluation {
  engineId: EngineId;
  score: number;
  reason: string;
  recommendations: string[];
}

/** Contract for extensible, rule-based outfit engines. */
export interface OutfitEngineModule {
  readonly id: EngineId;
  evaluate(input: OutfitEvaluationInput): EngineEvaluation;
}

/** Per-item attributes consumed by outfit engines. */
export interface OutfitEngineItem {
  slot: OutfitSlot;
  name: string;
  formality: FormalityEnum | null;
  colorHex: string | null;
  colorName?: string | null;
  /** Item-level season tags, e.g. ["Summer", "All Season"]. */
  seasonTags?: readonly string[];
  /** Item-level occasion tags, e.g. ["Office", "Travel"]. */
  occasionTags?: readonly string[];
  /** Raw material label, e.g. "Wool", "Linen". */
  material?: string | null;
  /** Optional explicit texture override. */
  texture?: TextureFamily | null;
  rating?: number | null;
}

/** Optional environmental and intent context for outfit evaluation. */
export interface OutfitEvaluationContext {
  /** Target season label from outfit metadata or user selection. */
  targetSeason?: string | null;
  /** Target occasion label from outfit metadata or user selection. */
  targetOccasion?: string | null;
  /** Weather snapshot for the planned wear date. */
  weather?: WeatherContext | null;
}

/** Weather inputs used by the weather engine. */
export interface WeatherContext {
  /** Temperature in Celsius. */
  temperatureC: number;
  precipitation?: PrecipitationLevel;
  wind?: WindLevel;
}

/** Full input to the outfit domain engine and its sub-engines. */
export interface OutfitEvaluationInput {
  items: readonly OutfitEngineItem[];
  context?: OutfitEvaluationContext;
}

/** Per-engine weighting for the composite outfit score. */
export type EngineWeightMap = Readonly<Record<EngineId, number>>;

/** Configuration for {@link evaluateOutfit}. */
export interface OutfitEngineConfig {
  weights?: EngineWeightMap;
  /** Additional engines appended after the defaults. */
  extraEngines?: readonly OutfitEngineModule[];
}

/** Composite output from {@link evaluateOutfit}. */
export interface OutfitEvaluationResult {
  overallScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  engines: Readonly<Record<EngineId, EngineEvaluation>>;
}

/** Documented design assumptions for the rule-based outfit engine. */
export interface OutfitEngineAssumption {
  id: string;
  description: string;
}
