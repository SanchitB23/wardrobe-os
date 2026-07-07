/**
 * Pure confidence + stability computation (RFC-004). Two DISTINCT concepts:
 *
 *   confidence — "how sure are we NOW?"  (evidence volume × consistency)
 *   stability  — "how consistently has this REMAINED over time?" (temporal spread)
 *
 * A new-but-strong preference is high-confidence / low-stability; a long-held
 * quiet one is lower-confidence / high-stability. Both are deterministic.
 */

import {
  CONFIDENCE_VOLUME_K,
  MIN_EVIDENCE,
  STABILITY_BUCKETS,
} from "@/domain/personalization/constants";
import { ageInDays, type ValueAggregate } from "@/domain/personalization/PreferenceScoring";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Confidence in [0,1]: how sure we are of this preference right now.
 * - volume: more corroborating signals → higher (saturating curve).
 * - consistency: agreement (positive mass vs conflicting negative mass).
 */
export function computeConfidence(agg: ValueAggregate): number {
  const volume = 1 - 0.5 ** (agg.totalCount / CONFIDENCE_VOLUME_K);
  const mass = agg.positiveMass + agg.negativeMass;
  const consistency = mass > 0 ? agg.positiveMass / mass : 0.5;
  return clamp01(volume * consistency);
}

/**
 * Stability in [0,1]: how consistently the preference has held across the whole
 * history window, independent of confidence. Computed as the fraction of
 * temporal buckets (spanning oldest signal → now) that contain a signal for
 * this value. Signals clustered in one recent window → low stability even at
 * high confidence; signals spread across the window → high stability.
 */
export function computeStability(agg: ValueAggregate, now: string): number {
  if (agg.occurredAts.length === 0) return 0;

  const ages = agg.occurredAts.map((iso) => ageInDays(iso, now));
  const oldest = Math.max(...ages);
  // All signals effectively at one instant → present in a single bucket only.
  if (oldest <= 0) return 1 / STABILITY_BUCKETS;

  const bucketSize = oldest / STABILITY_BUCKETS;
  const filled = new Set<number>();
  for (const age of ages) {
    // age ∈ [0, oldest]; map to bucket [0, STABILITY_BUCKETS - 1].
    const bucket = Math.min(STABILITY_BUCKETS - 1, Math.floor(age / bucketSize));
    filled.add(bucket);
  }
  return clamp01(filled.size / STABILITY_BUCKETS);
}

/** Cold start: total evidence below the minimum → the prior should dominate. */
export function isColdStart(totalSignals: number): boolean {
  return totalSignals < MIN_EVIDENCE;
}
