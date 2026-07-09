/**
 * Recommendation Engine v2 (RFC-012) — Quality Metrics.
 *
 * Aggregates one run into inspectable metrics for the developer surface + tests:
 * eligible/rejected counts, diversity score, average confidence, source mix, and
 * the weather / personalization **influence** — a deterministic counterfactual
 * measure of how much each dimension moved the ranking (re-score with that
 * dimension's weight zeroed, then measure how far the top-K order shifts). Pure.
 */

import type { RecommendationContext } from "@/domain/recommendation/RecommendationContext";
import type {
  OutfitCandidate,
  RecommendationQuality,
  RecommendationV2,
  RejectedCandidate,
  ScoreDimensionId,
} from "@/domain/recommendation/v2/types";
import {
  compareScored,
  scoreCandidates,
  type ScoredCandidate,
} from "@/domain/recommendation/v2/ScoringEngine";
import {
  DIMENSION_WEIGHTS,
  type RecommendationWeights,
} from "@/domain/recommendation/v2/RecommendationWeights";

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function withZeroed(dimension: ScoreDimensionId): RecommendationWeights {
  return { ...DIMENSION_WEIGHTS, [dimension]: 0 };
}

/** Fraction of the top-K whose position changes when `dimension` is zeroed. 0–1. */
function influenceOf(
  dimension: ScoreDimensionId,
  eligible: readonly OutfitCandidate[],
  context: RecommendationContext,
  occasion: string | null,
  baselineTopKIds: readonly string[],
): number {
  if (baselineTopKIds.length === 0) return 0;
  const counterfactual = scoreCandidates(eligible, context, occasion, withZeroed(dimension))
    .sort(compareScored)
    .slice(0, baselineTopKIds.length)
    .map((s) => s.candidate.id);
  let changed = 0;
  for (let i = 0; i < baselineTopKIds.length; i += 1) {
    if (baselineTopKIds[i] !== counterfactual[i]) changed += 1;
  }
  return round2(changed / baselineTopKIds.length);
}

export function computeQuality(args: {
  eligible: readonly OutfitCandidate[];
  rejected: readonly RejectedCandidate[];
  /** All eligible candidates scored + sorted (pre-diversity). */
  ranked: readonly ScoredCandidate[];
  /** The returned recommendations (post-diversity). */
  finalTopK: readonly RecommendationV2[];
  diversityScore: number;
  context: RecommendationContext;
  occasion: string | null;
}): RecommendationQuality {
  const { eligible, rejected, ranked, finalTopK, diversityScore, context, occasion } = args;
  const limit = finalTopK.length;

  const baselineTopKIds = ranked.slice(0, limit).map((s) => s.candidate.id);

  const sourceMix = finalTopK.reduce(
    (acc, rec) => {
      if (rec.source === "saved_outfit") acc.saved += 1;
      else acc.generated += 1;
      return acc;
    },
    { saved: 0, generated: 0 },
  );

  const averageConfidence =
    finalTopK.length > 0
      ? round2(finalTopK.reduce((s, r) => s + r.confidence, 0) / finalTopK.length)
      : 0;

  return {
    eligibleCandidateCount: eligible.length,
    rejectedCandidateCount: rejected.length,
    rejections: [...rejected],
    diversityScore,
    averageConfidence,
    sourceMix,
    weatherInfluence: influenceOf("weatherSuitability", eligible, context, occasion, baselineTopKIds),
    personalizationInfluence: influenceOf(
      "personalPreferenceFit",
      eligible,
      context,
      occasion,
      baselineTopKIds,
    ),
  };
}
