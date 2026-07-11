/**
 * Acquisitions Intelligence (RFC-018B) — public surface.
 *
 * Continuous learning over Shopping Intelligence (RFC-018): purchase lifecycle,
 * recommendation accuracy, need/ROI evolution, opportunity queue, and dynamic
 * strategy. Reuses 018 outputs; never reimplements Buy vs Skip / Priority.
 * Pure and deterministic — AI explains only.
 */

export * from "@/domain/shopping/v2/types";
export {
  ACQUISITIONS_INTELLIGENCE_VERSION,
  OPPORTUNITY_WEIGHTS,
  ESTABLISHED_MIN_WEARS,
  LOW_USAGE_MAX_WEARS,
  ACCEPTABLE_MAX_COST_PER_WEAR,
  LIFECYCLE_URGENCY,
  LIFECYCLE_STATE_ORDER,
  LIFECYCLE_STATE_LABELS,
} from "@/domain/shopping/v2/constants";
export {
  buildPurchaseLifecycle,
  resolveLifecycleState,
  lifecycleStatesReached,
  type LifecycleSubjectInput,
} from "@/domain/shopping/v2/PurchaseLifecycleEngine";
export {
  buildRecommendationAccuracyReport,
  isDeepAccuracyHit,
  type AccuracyDecisionInput,
} from "@/domain/shopping/v2/RecommendationAccuracyEngine";
export {
  buildNeedTimeline,
  type NeedEvolutionInput,
  type NeedEvolutionPurchaseEvent,
} from "@/domain/shopping/v2/NeedEvolution";
export {
  buildRoiTimeline,
  type RoiEvolutionInput,
  type RoiEvolutionPurchase,
} from "@/domain/shopping/v2/ROIEvolution";
export {
  scoreOpportunities,
  type OpportunityEngineInput,
} from "@/domain/shopping/v2/OpportunityEngine";
export {
  buildDynamicStrategy,
  type StrategyEvolutionInput,
} from "@/domain/shopping/v2/StrategyEvolution";
export {
  buildAcquisitionsIntelligence,
  type AcquisitionsIntelligenceInput,
} from "@/domain/shopping/v2/AcquisitionsIntelligence";
