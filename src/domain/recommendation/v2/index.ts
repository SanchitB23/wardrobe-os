/**
 * Recommendation Engine v2 (RFC-012) — public surface.
 *
 * A pure, deterministic, multi-objective recommendation pipeline that supersedes
 * the v1 `recommendUnifiedOutfits`: weather- and personalization-aware scoring,
 * hard-constraint eligibility, diversity reranking, full explainability, and
 * quality metrics. Engines decide; AI only explains.
 */

export * from "@/domain/recommendation/v2/types";
export {
  DIMENSION_WEIGHTS,
  RECOMMENDATION_V2_ENGINE_VERSION,
  DEFAULT_LIMIT as RECOMMENDATION_V2_DEFAULT_LIMIT,
  type RecommendationWeights,
} from "@/domain/recommendation/v2/RecommendationWeights";
export { recommendV2 } from "@/domain/recommendation/v2/RecommendationEngineV2";
export { generateCandidates } from "@/domain/recommendation/v2/CandidateGenerator";
export {
  assessCandidateEligibility,
  assessEligibility,
} from "@/domain/recommendation/v2/EligibilityEngine";
export {
  scoreCandidate,
  scoreCandidates,
  scoreDimensions,
  compareScored,
  type ScoredCandidate,
} from "@/domain/recommendation/v2/ScoringEngine";
export { rerankForDiversity, type RerankResult } from "@/domain/recommendation/v2/DiversityReranker";
export { buildRecommendation } from "@/domain/recommendation/v2/RecommendationTrace";
export { computeQuality } from "@/domain/recommendation/v2/RecommendationQualityMetrics";
