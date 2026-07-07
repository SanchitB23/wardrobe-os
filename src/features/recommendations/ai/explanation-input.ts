/**
 * Pure mappers that assemble the curated {@link ExplanationInput} and derive a
 * deterministic cache key for it. No React, no I/O, no provider — just data
 * shaping, so it is trivially testable and safe to run on client or server.
 *
 * Split of responsibility:
 * - {@link buildExplainSharedContext} runs server-side (it needs domain
 *   snapshots) and yields a plain {@link ExplainSharedContext} DTO.
 * - {@link buildExplanationInput} merges that shared DTO with the per-card
 *   recommendation the client already holds.
 *
 * Deliberately excludes the raw wardrobe, usage, and purchase data — only the
 * recommendation, its analysis, and short summaries reach the model.
 */

import type { OutfitAnalysis } from "@/domain/outfit/types";
import type {
  CommuteSnapshot,
  UnifiedOutfitRecommendation,
  WeatherSnapshot,
} from "@/domain/recommendation";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import type {
  ExplainSharedContext,
  ExplanationInput,
} from "@/features/recommendations/ai/explanation.types";

/** Keep prompts small (and cheap): cap list-y fields. */
const MAX_LIST = 5;
const MAX_ACTIONS = 3;

function cap<T>(list: readonly T[] | undefined, max = MAX_LIST): T[] {
  return (list ?? []).slice(0, max);
}

function analysisPart(
  analysis: OutfitAnalysis,
): ExplanationInput["outfitAnalysis"] {
  const breakdown = Object.entries(analysis.breakdown)
    .filter(([, rule]) => Boolean(rule))
    .map(([dimension, rule]) => ({
      dimension,
      score: rule!.score,
      reason: rule!.reason,
    }));
  return {
    overallScore: analysis.overallScore,
    confidence: analysis.confidence,
    summary: analysis.summary,
    breakdown,
    strengths: cap(analysis.strengths),
    weaknesses: cap(analysis.weaknesses),
    suggestions: cap(analysis.suggestions),
  };
}

/** Server-side: turn domain snapshots into the shared, wardrobe-free summary. */
export function buildExplainSharedContext(params: {
  wardrobeHealth: WardrobeHealth;
  /** Pre-flattened insight summary (overall text + top action titles). */
  insights: { overallSummary: string; topActions: string[] };
  weather: WeatherSnapshot;
  commute: CommuteSnapshot;
}): ExplainSharedContext {
  const { wardrobeHealth, insights, weather, commute } = params;
  return {
    wardrobeHealth: {
      overallScore: wardrobeHealth.overallScore,
      strengths: cap(wardrobeHealth.strengths),
      weaknesses: cap(wardrobeHealth.weaknesses),
      recommendations: cap(wardrobeHealth.recommendations),
    },
    insights: {
      overallSummary: insights.overallSummary,
      topActions: cap(insights.topActions, MAX_ACTIONS),
    },
    weather: {
      season: weather.season,
      condition: weather.condition,
      temperatureC: weather.temperatureC,
      humidity: weather.humidity,
    },
    commute: {
      mode: commute.mode,
      officeDaysPerWeek: commute.officeDaysPerWeek,
      durationMinutes: commute.durationMinutes,
    },
  };
}

/** Merge the per-card recommendation with the shared context DTO. */
export function buildExplanationInput(
  recommendation: UnifiedOutfitRecommendation,
  shared: ExplainSharedContext,
): ExplanationInput {
  return {
    recommendation: {
      id: recommendation.id,
      name: recommendation.name,
      source: recommendation.source,
      score: recommendation.score,
      confidence: recommendation.confidence,
      reason: recommendation.reason,
      strengths: cap(recommendation.strengths),
      tradeoffs: cap(recommendation.tradeoffs),
      suggestions: cap(recommendation.suggestions),
      items: recommendation.items.map((item) => ({
        slot: item.slot,
        name: item.name,
        category: item.category,
      })),
    },
    outfitAnalysis: analysisPart(recommendation.analysis),
    wardrobeHealth: shared.wardrobeHealth,
    insights: shared.insights,
    weather: shared.weather,
    commute: shared.commute,
  };
}

// ---------------------------------------------------------------------------
// Deterministic cache key — same recommendation + context ⇒ same key, so the
// explanation is not regenerated unless the recommendation actually changes.
// ---------------------------------------------------------------------------

/** Stable stringify: object keys sorted recursively so key order can't vary. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** djb2 — small, dependency-free, good enough for a cache key. */
function hash(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = (h * 33) ^ input.charCodeAt(i);
  }
  // >>> 0 → unsigned; base36 keeps it short.
  return (h >>> 0).toString(36);
}

/**
 * Deterministic key for an explanation. Includes the recommendation id (already
 * signature-based on the item set + source) plus a hash of the full curated
 * input, so any change to the recommendation or its context yields a new key.
 */
export function explanationCacheKey(input: ExplanationInput): string {
  return `explain:v1:${input.recommendation.id}:${hash(stableStringify(input))}`;
}
