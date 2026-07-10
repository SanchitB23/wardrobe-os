/**
 * Personalization Engine v2 (RFC-013) — rolling-window timeline helpers.
 *
 * Produces the window-end timestamps for the deterministic re-derivation, and
 * assembles a preference's `PreferenceTimeline` (points + trend). Pure — no I/O,
 * no wall-clock reads (all times derive from the injected `generatedAt`).
 */

import { computeTrend } from "@/domain/personalization/v2/PreferenceStability";
import type {
  PreferenceDimension,
  PreferenceTimeline,
  TimelinePoint,
  WindowOptions,
} from "@/domain/personalization/v2/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Default rolling window: six monthly points ending at `generatedAt`. */
export const DEFAULT_WINDOW: WindowOptions = { stepDays: 30, count: 6 };

/**
 * Window-end ISO timestamps, **oldest → newest**, the last being `generatedAt`.
 * Each end anchors an as-of derivation over the signals up to that instant.
 */
export function deriveWindowEnds(generatedAt: string, window: WindowOptions): string[] {
  const nowMs = Date.parse(generatedAt);
  const count = Math.max(1, Math.floor(window.count));
  const ends: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    ends.push(new Date(nowMs - i * window.stepDays * MS_PER_DAY).toISOString());
  }
  return ends;
}

/** Assemble a timeline (points + derived trend) for one preference value. */
export function buildTimeline(
  dimension: PreferenceDimension,
  value: string,
  points: TimelinePoint[],
): PreferenceTimeline {
  return {
    dimension,
    value,
    points,
    trend: computeTrend(points.map((p) => p.weight)),
  };
}
