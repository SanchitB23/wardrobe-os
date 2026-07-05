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
} from "@/domain/outfit/types";
import { getRequiredOutfitSlots } from "@/domain/outfit/slot-matching";

const COLD_THRESHOLD_C = 12;
const HOT_THRESHOLD_C = 28;
const HEAVY_MATERIALS = ["wool", "cashmere", "fleece", "leather", "down"];

function hasOuterwear(input: OutfitEvaluationInput): boolean {
  return input.items.some((item) => item.slot === "outerwear");
}

function countHeavyFabrics(input: OutfitEvaluationInput): number {
  return input.items.filter((item) => {
    const material = (item.material ?? "").toLowerCase();
    const texture = inferTextureFamily(item.material, item.texture);
    return (
      HEAVY_MATERIALS.some((keyword) => material.includes(keyword)) ||
      texture === "knit" ||
      texture === "leather"
    );
  }).length;
}

function evaluateWeatherEngine(input: OutfitEvaluationInput): EngineEvaluation {
  const weather = input.context?.weather;

  if (!weather) {
    return buildEngineEvaluation(
      "weather",
      NEUTRAL_ENGINE_SCORE,
      "No weather context was provided for this outfit.",
      ["Add temperature and precipitation to validate weather suitability."],
    );
  }

  let score = 10;
  const recommendations: string[] = [];
  const temperature = weather.temperatureC;
  const precipitation = weather.precipitation ?? "none";
  const wind = weather.wind ?? "calm";
  const outerwear = hasOuterwear(input);
  const heavyFabrics = countHeavyFabrics(input);
  const requiredSlots = getRequiredOutfitSlots();
  const filledRequired = new Set(
    input.items
      .filter((item) => requiredSlots.includes(item.slot))
      .map((item) => item.slot),
  );

  if (temperature <= COLD_THRESHOLD_C && !outerwear) {
    score -= 3;
    recommendations.push("Add outerwear for cold weather protection.");
  }

  if (temperature >= HOT_THRESHOLD_C && heavyFabrics >= 2) {
    score -= 3;
    recommendations.push("Swap heavy knits or leather for linen or lightweight cotton.");
  }

  if (precipitation !== "none" && !outerwear) {
    score -= precipitation === "heavy" ? 4 : 2;
    recommendations.push("Include a water-resistant outer layer for precipitation.");
  }

  if (wind === "strong" && !outerwear) {
    score -= 1.5;
    recommendations.push("Strong wind calls for a structured outer layer.");
  }

  if (filledRequired.size < requiredSlots.length) {
    score -= 1;
    recommendations.push("Complete core slots before evaluating weather readiness.");
  }

  const reason =
    temperature <= COLD_THRESHOLD_C
      ? `Cold (${temperature}°C) — outerwear ${outerwear ? "present" : "missing"}.`
      : temperature >= HOT_THRESHOLD_C
        ? `Hot (${temperature}°C) — ${heavyFabrics} heavy fabric piece(s).`
        : `Mild (${temperature}°C) — precipitation ${precipitation}, wind ${wind}.`;

  return buildEngineEvaluation(
    "weather",
    clampScore0To10(score),
    reason,
    uniqueRecommendations(recommendations),
  );
}

export const WeatherEngine: OutfitEngineModule = {
  id: "weather",
  evaluate: evaluateWeatherEngine,
};

export { evaluateWeatherEngine };
