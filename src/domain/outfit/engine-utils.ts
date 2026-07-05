import type {
  EngineEvaluation,
  EngineId,
  EngineWeightMap,
  OccasionCategory,
  SeasonBucket,
  TextureFamily,
} from "@/domain/outfit/types";

export function clampScore0To10(value: number): number {
  return Math.round(Math.max(0, Math.min(10, value)) * 10) / 10;
}

export function scoreFromRatio(ratio: number): number {
  return clampScore0To10(ratio * 10);
}

export function averageScores(scores: readonly number[]): number {
  if (scores.length === 0) {
    return 0;
  }

  const total = scores.reduce((sum, score) => sum + score, 0);
  return clampScore0To10(total / scores.length);
}

export function weightedAverageScore(
  scores: Readonly<Record<string, number>>,
  weights: EngineWeightMap,
): number {
  let weightedTotal = 0;
  let weightSum = 0;

  for (const [engineId, weight] of Object.entries(weights) as [EngineId, number][]) {
    const score = scores[engineId];
    if (score === undefined) {
      continue;
    }
    weightedTotal += score * weight;
    weightSum += weight;
  }

  if (weightSum === 0) {
    return 0;
  }

  return clampScore0To10(weightedTotal / weightSum);
}

export function buildEngineEvaluation(
  engineId: EngineId,
  score: number,
  reason: string,
  recommendations: string[] = [],
): EngineEvaluation {
  return {
    engineId,
    score: clampScore0To10(score),
    reason,
    recommendations,
  };
}

export function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

const SEASON_ALIASES: Record<string, SeasonBucket> = {
  spring: "spring",
  summer: "summer",
  autumn: "autumn",
  fall: "autumn",
  winter: "winter",
  "all season": "all_season",
  "all-season": "all_season",
  allseason: "all_season",
  transitional: "transitional",
  "transitional season": "transitional",
};

export function normalizeSeasonLabel(
  value: string | null | undefined,
): SeasonBucket | null {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  return SEASON_ALIASES[normalized] ?? null;
}

const OCCASION_KEYWORDS: Array<{ category: OccasionCategory; keywords: string[] }> = [
  { category: "formal", keywords: ["formal", "black tie", "gala", "wedding"] },
  { category: "business", keywords: ["office", "work", "business", "interview", "meeting"] },
  { category: "smart_casual", keywords: ["smart casual", "dinner", "date", "brunch"] },
  { category: "evening", keywords: ["evening", "night out", "party", "cocktail"] },
  { category: "athletic", keywords: ["gym", "workout", "run", "sport", "training"] },
  { category: "outdoor", keywords: ["hike", "outdoor", "travel", "commute", "weekend"] },
  { category: "casual", keywords: ["casual", "errands", "lounge", "home"] },
];

export function categorizeOccasion(
  value: string | null | undefined,
): OccasionCategory {
  const normalized = normalizeText(value);
  if (!normalized) {
    return "unknown";
  }

  for (const entry of OCCASION_KEYWORDS) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry.category;
    }
  }

  return "unknown";
}

const MATERIAL_TEXTURE_MAP: Array<{ family: TextureFamily; keywords: string[] }> = [
  { family: "knit", keywords: ["wool", "cashmere", "knit", "fleece", "sweater"] },
  { family: "denim", keywords: ["denim", "jean", "canvas"] },
  { family: "leather", keywords: ["leather", "suede"] },
  { family: "technical", keywords: ["nylon", "polyester", "gore", "shell", "performance"] },
  { family: "smooth", keywords: ["cotton", "linen", "silk", "satin", "poplin", "twill"] },
];

export function inferTextureFamily(
  material: string | null | undefined,
  explicit?: TextureFamily | null,
): TextureFamily {
  if (explicit && explicit !== "unknown") {
    return explicit;
  }

  const normalized = normalizeText(material);
  if (!normalized) {
    return "unknown";
  }

  for (const entry of MATERIAL_TEXTURE_MAP) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry.family;
    }
  }

  return "unknown";
}

export function uniqueRecommendations(recommendations: readonly string[]): string[] {
  return [...new Set(recommendations.filter(Boolean))];
}
