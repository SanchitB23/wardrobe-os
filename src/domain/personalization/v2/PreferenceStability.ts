/**
 * Personalization Engine v2 (RFC-013) — trend, series stability, and `since`.
 *
 * Computes a preference's direction and a sharper, cross-window stability from
 * its timeline series (spread + persistence), plus the earliest sustained-
 * dominant window (`since`). Pure and deterministic — no I/O, no AI, no ML.
 */

import type { PreferenceTrend, TimelinePoint } from "@/domain/personalization/v2/types";

/** Trend is declared only when the recent half moves beyond this vs the older half. */
export const TREND_DELTA = 0.1;
/** A window "contains" the preference when its weight exceeds this. */
export const PRESENCE_THRESHOLD = 0.05;
/** Weight at/above which a preference counts as "dominant" for `since`. */
export const SINCE_WEIGHT = 0.5;

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Direction of a weight series (oldest → newest). Deterministic. */
export function computeTrend(weights: readonly number[]): PreferenceTrend {
  if (weights.length < 2) return "steady";
  const half = Math.floor(weights.length / 2);
  const older = mean(weights.slice(0, Math.max(1, half)));
  const recent = mean(weights.slice(half));
  const delta = recent - older;
  if (delta > TREND_DELTA) return "rising";
  if (delta < -TREND_DELTA) return "falling";
  return "steady";
}

/**
 * Cross-window stability in [0,1] — sharper than the single-window heuristic.
 * Combines **spread** (fraction of windows the preference is present in) and
 * **persistence** (low window-to-window volatility). Distinct from confidence.
 */
export function seriesStability(weights: readonly number[]): number {
  if (weights.length === 0) return 0;
  const present = weights.filter((w) => w > PRESENCE_THRESHOLD).length;
  const spread = present / weights.length;

  let volatility = 0;
  if (weights.length >= 2) {
    let stepSum = 0;
    for (let i = 1; i < weights.length; i += 1) stepSum += Math.abs(weights[i] - weights[i - 1]);
    volatility = stepSum / (weights.length - 1);
  }
  const persistence = Math.max(0, 1 - volatility);

  const stability = 0.6 * spread + 0.4 * persistence;
  return Math.max(0, Math.min(1, Number(stability.toFixed(4))));
}

/**
 * The earliest window (ISO date) from which the preference stayed dominant
 * (`weight >= SINCE_WEIGHT`) through the latest window. `null` if never
 * sustained. Points must be oldest → newest.
 */
export function sinceFrom(points: readonly Pick<TimelinePoint, "at" | "weight">[]): string | null {
  for (let i = 0; i < points.length; i += 1) {
    if (points.slice(i).every((p) => p.weight >= SINCE_WEIGHT)) {
      return points[i].at.slice(0, 10);
    }
  }
  return null;
}
