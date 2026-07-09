/**
 * Recommendation Engine v2 (RFC-012) — the entry point.
 *
 * Wires the pipeline: Candidate Generation → Eligibility → Scoring → Diversity
 * Rerank → Trace → RecommendationResult. Composes the existing engines; holds no
 * scoring math of its own (each stage owns that). Weather- and personalization-
 * aware, diverse, explainable — and fully deterministic (same context +
 * generatedAt + options ⇒ identical result). No AI, no ML, no randomness.
 */

import type { RecommendationContext } from "@/domain/recommendation/RecommendationContext";
import type {
  OutfitCandidate,
  RecommendationResult,
  RecommendationV2,
  RecommendationV2Options,
  RejectedCandidate,
  EligibilityVerdict,
} from "@/domain/recommendation/v2/types";
import { generateCandidates } from "@/domain/recommendation/v2/CandidateGenerator";
import { assessCandidateEligibility } from "@/domain/recommendation/v2/EligibilityEngine";
import { compareScored, scoreCandidates } from "@/domain/recommendation/v2/ScoringEngine";
import { rerankForDiversity } from "@/domain/recommendation/v2/DiversityReranker";
import { buildRecommendation } from "@/domain/recommendation/v2/RecommendationTrace";
import { computeQuality } from "@/domain/recommendation/v2/RecommendationQualityMetrics";
import {
  DEFAULT_LIMIT,
  RECOMMENDATION_V2_ENGINE_VERSION,
} from "@/domain/recommendation/v2/RecommendationWeights";

const MAX_REJECTION_REASONS = 12;

/**
 * Produces ranked, diverse, explainable recommendations plus per-run quality
 * metrics. Deterministic given the same context + options.
 */
export function recommendV2(
  context: RecommendationContext,
  options: RecommendationV2Options = {},
): RecommendationResult {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const occasion = options.occasion ?? null;
  const generatedAt = context.generatedAt;

  // 1. Candidates (reuse existing engines).
  let candidates = generateCandidates(context, { occasion });
  if (options.favoritesOnly) {
    candidates = candidates.filter((c) => c.source === "saved_outfit");
  }

  // 2. Eligibility (hard constraints, before scoring).
  const eligible: OutfitCandidate[] = [];
  const rejected: RejectedCandidate[] = [];
  const eligibilityById = new Map<string, EligibilityVerdict>();
  for (const candidate of candidates) {
    const verdict = assessCandidateEligibility(candidate, context, occasion);
    if (verdict.eligible) {
      eligible.push(candidate);
      eligibilityById.set(candidate.id, verdict);
    } else {
      rejected.push({
        id: candidate.id,
        name: candidate.name,
        source: candidate.source,
        failed: verdict.failed,
        reasons: verdict.reasons,
      });
    }
  }

  // 3. Score + 4. sort deterministically.
  const ranked = scoreCandidates(eligible, context, occasion).sort(compareScored);

  // 5. Diversity rerank → top-K.
  const { reranked, decisions, diversityScore } = rerankForDiversity(ranked, limit);

  // 6. Trace → RecommendationV2[]. Attach the aggregate rejection reasons to the
  //    first card (debug convenience, matching v1).
  const rejectionReasons = rejected
    .flatMap((r) => r.reasons)
    .slice(0, MAX_REJECTION_REASONS);
  const recommendations: RecommendationV2[] = reranked.map((scored, index) =>
    buildRecommendation(
      scored,
      eligibilityById.get(scored.candidate.id)!,
      decisions.get(scored.candidate.id)!,
      index + 1,
      generatedAt,
      index === 0 ? rejectionReasons : undefined,
    ),
  );

  // 7. Quality metrics.
  const quality = computeQuality({
    eligible,
    rejected,
    ranked,
    finalTopK: recommendations,
    diversityScore,
    context,
    occasion,
  });

  return {
    recommendations,
    quality,
    metadata: {
      engineVersion: RECOMMENDATION_V2_ENGINE_VERSION,
      generatedAt,
      weatherSource: context.weather.source,
      personalizationApplied: options.personalizationApplied ?? true,
    },
  };
}
