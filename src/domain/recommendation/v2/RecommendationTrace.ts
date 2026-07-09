/**
 * Recommendation Engine v2 (RFC-012) — Explanation Trace.
 *
 * Assembles the per-recommendation explanation object (score breakdown, boosts,
 * penalties, reason codes, constraints passed, diversity, a short human reason,
 * and the v1-compatible `debug` block) from the scoring + eligibility + diversity
 * records. It makes NO new decisions — it only formats what the stages decided.
 * Pure.
 */

import type {
  DiversityDecision,
  EligibilityVerdict,
  HardConstraint,
  RecommendationV2,
  ScoreAdjustment,
} from "@/domain/recommendation/v2/types";
import type { ScoredCandidate } from "@/domain/recommendation/v2/ScoringEngine";
import { RECOMMENDATION_V2_ENGINE_VERSION } from "@/domain/recommendation/v2/RecommendationWeights";

function labelsOf(adjustments: readonly ScoreAdjustment[]): string[] {
  return adjustments.map((a) => a.label);
}

/** A short, deterministic human sentence describing the top driver + caveat. */
function buildReason(scored: ScoredCandidate): string {
  const { breakdown, score } = scored;
  const topBoost = [...breakdown.boosts].sort((a, b) => b.delta - a.delta)[0];
  const topPenalty = [...breakdown.penalties].sort((a, b) => a.delta - b.delta)[0];
  const topDimension = [...breakdown.dimensions].sort((a, b) => b.weighted - a.weighted)[0];

  const primary =
    topBoost?.label ??
    (topDimension
      ? {
          outfitAnalysis: "a strong all-round match",
          weatherSuitability: "well-suited to today's weather",
          occasionSuitability: "a good fit for the occasion",
          personalPreferenceFit: "aligned with your taste",
          formalityAlignment: "the right level of formality",
          colorHarmony: "a cohesive palette",
          textureCompatibility: "compatible textures",
          comfortCommuteFit: "comfortable for your day",
          wardrobeHealthContribution: "gives an under-worn piece a turn",
        }[topDimension.dimension]
      : "a solid match");
  const caveat = topPenalty ? `, though ${topPenalty.label.toLowerCase()}` : "";
  return `Scored ${score.toFixed(1)}/10 — ${primary}${caveat}.`;
}

/**
 * Builds the final {@link RecommendationV2} for a scored, admitted candidate.
 * `rejectionReasons` are attached only to the top result (debug convenience).
 */
export function buildRecommendation(
  scored: ScoredCandidate,
  eligibility: EligibilityVerdict,
  diversity: DiversityDecision,
  sourceRank: number,
  generatedAt: string,
  rejectionReasons?: string[],
): RecommendationV2 {
  const { candidate, breakdown, score, confidence, reasonCodes } = scored;
  const constraintsPassed: HardConstraint[] = eligibility.passed;

  const boostLabels = labelsOf(breakdown.boosts);
  const penaltyLabels = labelsOf(breakdown.penalties);

  const strengths = [
    ...boostLabels,
    ...candidate.analysis.strengths.slice(0, 2),
  ].slice(0, 5);
  const tradeoffs = [
    ...penaltyLabels,
    ...candidate.analysis.weaknesses.slice(0, 2),
  ].slice(0, 4);

  return {
    id: candidate.id,
    source: candidate.source,
    savedOutfitId: candidate.savedOutfitId,
    name: candidate.name,
    items: candidate.items,
    score,
    confidence,
    analysis: candidate.analysis,
    reason: buildReason(scored),
    strengths,
    tradeoffs,
    suggestions: candidate.suggestions.slice(0, 3),
    reasonCodes,
    breakdown,
    constraintsPassed,
    diversity,
    debug: {
      savedOutfitScore: candidate.source === "saved_outfit" ? candidate.rawScore : undefined,
      generatedScore: candidate.source === "generated_combo" ? candidate.rawScore : undefined,
      sourceRank,
      rejectionReasons: rejectionReasons && rejectionReasons.length > 0 ? rejectionReasons : undefined,
      boosts: boostLabels,
      penalties: penaltyLabels,
    },
    metadata: {
      generatedAt,
      engineVersion: RECOMMENDATION_V2_ENGINE_VERSION,
    },
  };
}
