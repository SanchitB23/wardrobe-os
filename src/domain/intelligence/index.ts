/**
 * Intelligence Center (RFC-015) — public surface.
 *
 * A pure, deterministic action engine: it aggregates every deterministic engine's
 * output into one deduplicated, impact-ranked list of typed actions. Engines
 * decide the actions; the Center ranks; AI explains (ADR-005).
 */

export * from "@/domain/intelligence/ActionTypes";
export { buildIntelligenceCenter } from "@/domain/intelligence/IntelligenceCenter";
export { generateActions } from "@/domain/intelligence/ActionGenerator";
export { prioritize } from "@/domain/intelligence/PriorityEngine";
export { dedupe, rank, subjectKey } from "@/domain/intelligence/ActionRanking";
export {
  computeImpact,
  priorityFor,
  SOURCE_RELIABILITY,
  PRIORITY_THRESHOLDS,
  INTELLIGENCE_ENGINE_VERSION,
} from "@/domain/intelligence/ImpactScoring";
