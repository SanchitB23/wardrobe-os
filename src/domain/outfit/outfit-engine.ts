import {
  DEFAULT_ENGINE_WEIGHTS,
  OUTFIT_ENGINE_VERSION,
} from "@/domain/outfit/assumptions";
import { ColorEngine } from "@/domain/outfit/color-engine";
import { FormalityEngine } from "@/domain/outfit/formality-engine";
import { OccasionEngine } from "@/domain/outfit/occasion-engine";
import { SeasonEngine } from "@/domain/outfit/season-engine";
import { TextureEngine } from "@/domain/outfit/texture-engine";
import { WeatherEngine } from "@/domain/outfit/weather-engine";
import {
  clampConfidence,
  clampScore0To10,
  uniqueRecommendations,
  weightedAverageScore,
} from "@/domain/outfit/engine-utils";
import type {
  EngineId,
  EngineRuleResult,
  OutfitAnalysis,
  OutfitAnalysisBreakdown,
  OutfitEngineConfig,
  OutfitEngineModule,
  OutfitEvaluationInput,
  RuleResult,
} from "@/domain/outfit/types";

const DEFAULT_ENGINES: readonly OutfitEngineModule[] = [
  ColorEngine,
  FormalityEngine,
  SeasonEngine,
  OccasionEngine,
  TextureEngine,
  WeatherEngine,
];

function resolveEngines(config?: OutfitEngineConfig): OutfitEngineModule[] {
  const extras = config?.extraEngines ?? [];
  const byId = new Map<EngineId, OutfitEngineModule>();

  for (const engine of DEFAULT_ENGINES) {
    byId.set(engine.id, engine);
  }

  for (const engine of extras) {
    byId.set(engine.id, engine);
  }

  return [...byId.values()];
}

function toRuleResult(result: EngineRuleResult): RuleResult {
  return {
    score: result.score,
    confidence: result.confidence,
    reason: result.reason,
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    suggestions: result.suggestions,
  };
}

function buildSummary(
  overallScore: number,
  results: readonly EngineRuleResult[],
): string {
  const strongest = [...results].sort((left, right) => right.score - left.score)[0];
  const weakest = [...results].sort((left, right) => left.score - right.score)[0];

  return `Overall outfit score is ${overallScore}/10. Strongest dimension: ${strongest.engineId} (${strongest.score}). Weakest dimension: ${weakest.engineId} (${weakest.score}).`;
}

function weightedConfidence(
  results: readonly EngineRuleResult[],
  weights: OutfitEngineConfig["weights"],
): number {
  const weightMap = weights ?? DEFAULT_ENGINE_WEIGHTS;
  let weightedTotal = 0;
  let weightSum = 0;

  for (const result of results) {
    const weight = weightMap[result.engineId] ?? 0;
    weightedTotal += result.confidence * weight;
    weightSum += weight;
  }

  if (weightSum === 0) {
    return 0;
  }

  return clampConfidence(weightedTotal / weightSum);
}

/**
 * Evaluates an outfit using all rule-based sub-engines and returns a
 * structured, versioned {@link OutfitAnalysis}. Deterministic given the same
 * input and config (inject `config.generatedAt` for reproducible metadata).
 * Engines are extensible via {@link OutfitEngineConfig.extraEngines}.
 */
export function evaluateOutfit(
  input: OutfitEvaluationInput,
  config?: OutfitEngineConfig,
): OutfitAnalysis {
  const enginesList = resolveEngines(config);
  const weights = config?.weights ?? DEFAULT_ENGINE_WEIGHTS;
  const results: EngineRuleResult[] = [];
  const scoreMap: Partial<Record<EngineId, number>> = {};

  for (const engine of enginesList) {
    const result = engine.evaluate(input);
    results.push(result);
    scoreMap[engine.id] = result.score;
  }

  const overallScore = clampScore0To10(weightedAverageScore(scoreMap, weights));
  const byId = new Map(results.map((result) => [result.engineId, result]));

  const breakdown: OutfitAnalysisBreakdown = {
    color: toRuleResult(byId.get("color")!),
    formality: toRuleResult(byId.get("formality")!),
    season: toRuleResult(byId.get("season")!),
    occasion: toRuleResult(byId.get("occasion")!),
    texture: toRuleResult(byId.get("texture")!),
  };

  const weather = byId.get("weather");
  if (weather) {
    breakdown.weather = toRuleResult(weather);
  }

  const footwear = byId.get("footwear");
  if (footwear) {
    breakdown.footwear = toRuleResult(footwear);
  }

  const weakestFirst = [...results].sort((left, right) => left.score - right.score);

  return {
    overallScore,
    confidence: weightedConfidence(results, weights),
    summary: buildSummary(overallScore, results),
    strengths: results.flatMap((result) =>
      result.strengths.map((entry) => `${result.engineId}: ${entry}`),
    ),
    weaknesses: results.flatMap((result) =>
      result.weaknesses.map((entry) => `${result.engineId}: ${entry}`),
    ),
    suggestions: uniqueRecommendations(
      weakestFirst.flatMap((result) => result.suggestions),
    ),
    breakdown,
    metadata: {
      engineVersion: OUTFIT_ENGINE_VERSION,
      generatedAt: config?.generatedAt ?? new Date().toISOString(),
      rulesApplied: enginesList.map((engine) => engine.id),
    },
  };
}

export const OutfitEngine = {
  evaluate: evaluateOutfit,
  defaultEngines: DEFAULT_ENGINES,
};

export { DEFAULT_ENGINES };
