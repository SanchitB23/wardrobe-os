/**
 * Personalization Engine v2 (RFC-013) — public surface.
 *
 * Refines the RFC-004 profile with preference lifecycle, timeline, evolution,
 * sharper stability, and an explore/exploit control. Behaviour is the source of
 * truth; the engine derives; AI only explains. Pure and deterministic.
 */

export * from "@/domain/personalization/v2/types";
export {
  derivePreferenceProfileV2,
  PERSONALIZATION_V2_ENGINE_VERSION,
} from "@/domain/personalization/v2/PersonalizationEngineV2";
export { classifyLifecycle, LIFECYCLE_THRESHOLDS } from "@/domain/personalization/v2/PreferenceLifecycle";
export {
  computeTrend,
  seriesStability,
  sinceFrom,
  TREND_DELTA,
  SINCE_WEIGHT,
} from "@/domain/personalization/v2/PreferenceStability";
export {
  deriveWindowEnds,
  buildTimeline,
  DEFAULT_WINDOW,
} from "@/domain/personalization/v2/PreferenceTimeline";
export { buildEvolution, EVOLUTION_EPSILON } from "@/domain/personalization/v2/PreferenceEvolution";
export {
  resolveExploreExploit,
  EXPLORE_EXPLOIT_DEFAULT,
  EXPLORE_EXPLOIT_MODES,
} from "@/domain/personalization/v2/ExploreExploit";
