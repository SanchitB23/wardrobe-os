/**
 * Personalization Engine v2 (RFC-013) — lifecycle classification.
 *
 * Deterministically classifies a preference as core / emerging / declining /
 * avoided from its current weight, stability, and recent trend. Pure — no I/O,
 * no AI, no ML. Thresholds are tunable constants, calibrated with tests.
 */

import type { LifecycleInput, PreferenceLifecycle } from "@/domain/personalization/v2/types";

export const LIFECYCLE_THRESHOLDS = {
  /** At/above this weight AND stability → an established, defining preference. */
  coreWeight: 0.6,
  coreStability: 0.6,
  /** Below this stability a positive preference reads as still-forming. */
  emergingStability: 0.4,
} as const;

/**
 * Classify a preference's lifecycle. Deterministic and total — every input maps
 * to exactly one of core / emerging / declining / avoided.
 *
 * Order matters:
 *  1. net-negative signal → **avoided** (the user steers away from this value).
 *  2. falling trend while not yet core-strong → **declining** (was stronger).
 *  3. strong + stable → **core**.
 *  4. rising, or not-yet-stable → **emerging**.
 *  5. otherwise fall back to core (strong) / emerging (weak).
 */
export function classifyLifecycle(input: LifecycleInput): PreferenceLifecycle {
  const { coreWeight, coreStability, emergingStability } = LIFECYCLE_THRESHOLDS;

  if (input.netNegative) return "avoided";
  if (input.trend === "falling" && input.weight < coreWeight) return "declining";
  if (input.weight >= coreWeight && input.stability >= coreStability) return "core";
  if (input.trend === "rising" || input.stability < emergingStability) return "emerging";
  return input.weight >= coreWeight ? "core" : "emerging";
}
