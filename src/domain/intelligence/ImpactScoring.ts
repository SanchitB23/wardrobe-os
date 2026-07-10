/**
 * Intelligence Center (RFC-015) — impact scoring + priority buckets.
 *
 * Pure, deterministic. Final impact combines the source engine's provisional
 * signal, that source's reliability, and the action's confidence — never a new
 * verdict, just a weighting of what the engine already decided. Constants are
 * tunable + test-calibrated. No I/O.
 */

import type { ActionPriority, ActionSource } from "@/domain/intelligence/ActionTypes";

export const INTELLIGENCE_ENGINE_VERSION = "1.0.0";

/** How much to trust each source's signal (0–1). Tunable. */
export const SOURCE_RELIABILITY: Record<ActionSource, number> = {
  recommendation: 0.9,
  health: 0.95,
  usage: 0.85,
  acquisition: 0.9,
  personalization: 0.7,
  lifestyle: 0.85,
  weather: 0.8,
  vision: 0.75,
};

/** Impact thresholds → priority bucket. */
export const PRIORITY_THRESHOLDS = {
  critical: 0.8,
  high: 0.6,
  medium: 0.35,
} as const;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Final impact (0–1) = provisional × sourceReliability × (0.5 + 0.5·confidence).
 * A low-confidence action can never fully dominate; a high-reliability source's
 * strong, confident signal ranks near the top.
 */
export function computeImpact(
  provisionalImpact: number,
  source: ActionSource,
  confidence: number,
): number {
  const reliability = SOURCE_RELIABILITY[source] ?? 0.7;
  const impact = clamp01(provisionalImpact) * reliability * (0.5 + 0.5 * clamp01(confidence));
  return Math.round(clamp01(impact) * 1000) / 1000;
}

/** Deterministic priority bucket from an impact score. */
export function priorityFor(impact: number): ActionPriority {
  if (impact >= PRIORITY_THRESHOLDS.critical) return "critical";
  if (impact >= PRIORITY_THRESHOLDS.high) return "high";
  if (impact >= PRIORITY_THRESHOLDS.medium) return "medium";
  return "low";
}
