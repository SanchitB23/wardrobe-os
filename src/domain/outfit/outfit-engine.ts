import { DEFAULT_ENGINE_WEIGHTS } from "@/domain/outfit/assumptions";
import { ColorEngine } from "@/domain/outfit/color-engine";
import { FormalityEngine } from "@/domain/outfit/formality-engine";
import { OccasionEngine } from "@/domain/outfit/occasion-engine";
import { SeasonEngine } from "@/domain/outfit/season-engine";
import { TextureEngine } from "@/domain/outfit/texture-engine";
import { WeatherEngine } from "@/domain/outfit/weather-engine";
import {
  clampScore0To10,
  uniqueRecommendations,
  weightedAverageScore,
} from "@/domain/outfit/engine-utils";
import type {
  EngineEvaluation,
  EngineId,
  OutfitEngineConfig,
  OutfitEngineModule,
  OutfitEvaluationInput,
  OutfitEvaluationResult,
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

function scoreBand(score: number): "strong" | "moderate" | "weak" {
  if (score >= 8) {
    return "strong";
  }
  if (score >= 6) {
    return "moderate";
  }
  return "weak";
}

function buildSummary(
  overallScore: number,
  engines: Readonly<Record<EngineId, EngineEvaluation>>,
): string {
  const entries = Object.values(engines);
  const strongest = [...entries].sort((left, right) => right.score - left.score)[0];
  const weakest = [...entries].sort((left, right) => left.score - right.score)[0];

  return `Overall outfit score is ${overallScore}/10. Strongest dimension: ${strongest.engineId} (${strongest.score}). Weakest dimension: ${weakest.engineId} (${weakest.score}).`;
}

function collectStrengths(engines: Readonly<Record<EngineId, EngineEvaluation>>): string[] {
  return Object.values(engines)
    .filter((engine) => scoreBand(engine.score) === "strong")
    .map((engine) => `${engine.engineId}: ${engine.reason}`);
}

function collectWeaknesses(engines: Readonly<Record<EngineId, EngineEvaluation>>): string[] {
  return Object.values(engines)
    .filter((engine) => scoreBand(engine.score) === "weak")
    .map((engine) => `${engine.engineId}: ${engine.reason}`);
}

function collectSuggestions(
  engines: Readonly<Record<EngineId, EngineEvaluation>>,
): string[] {
  const sorted = Object.values(engines).sort((left, right) => left.score - right.score);
  return uniqueRecommendations(
    sorted.flatMap((engine) => engine.recommendations),
  );
}

/**
 * Evaluates an outfit using all rule-based sub-engines and returns a composite result.
 * Engines are extensible via {@link OutfitEngineConfig.extraEngines}.
 */
export function evaluateOutfit(
  input: OutfitEvaluationInput,
  config?: OutfitEngineConfig,
): OutfitEvaluationResult {
  const enginesList = resolveEngines(config);
  const weights = config?.weights ?? DEFAULT_ENGINE_WEIGHTS;
  const engineResults = {} as Record<EngineId, EngineEvaluation>;
  const scoreMap = {} as Record<EngineId, number>;

  for (const engine of enginesList) {
    const evaluation = engine.evaluate(input);
    engineResults[engine.id] = evaluation;
    scoreMap[engine.id] = evaluation.score;
  }

  const overallScore = clampScore0To10(weightedAverageScore(scoreMap, weights));

  return {
    overallScore,
    summary: buildSummary(overallScore, engineResults),
    strengths: collectStrengths(engineResults),
    weaknesses: collectWeaknesses(engineResults),
    suggestions: collectSuggestions(engineResults),
    engines: engineResults,
  };
}

export const OutfitEngine = {
  evaluate: evaluateOutfit,
  defaultEngines: DEFAULT_ENGINES,
};

export { DEFAULT_ENGINES };
