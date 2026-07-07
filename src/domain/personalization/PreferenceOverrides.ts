/**
 * Pure override application (RFC-004). User overrides ALWAYS win over derivation
 * and are never overwritten by later learning:
 *   - pin      → fix the value at confidence = 1, stability = 1, source = override
 *   - adjust   → multiply the derived weight by the override weight
 *   - suppress → remove the derived preference
 * Deterministic; operates on already-derived preference lists.
 */

import type {
  DerivedPreference,
  PreferenceDimension,
  PreferenceOverride,
} from "@/domain/personalization/types";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Apply the overrides for a single dimension to its derived preference list.
 * Returns a new array; input is not mutated.
 */
export function applyOverridesForDimension(
  dimension: PreferenceDimension,
  derived: DerivedPreference[],
  overrides: PreferenceOverride[],
): DerivedPreference[] {
  const forDim = overrides.filter((o) => o.dimension === dimension);
  if (forDim.length === 0) return derived;

  const result = derived.map((p) => ({ ...p }));

  for (const override of forDim) {
    const value = override.value.trim();
    if (!value) continue;
    const idx = result.findIndex((p) => p.value === value);

    if (override.mode === "suppress") {
      if (idx >= 0) result.splice(idx, 1);
      continue;
    }

    if (override.mode === "pin") {
      const pinned: DerivedPreference = {
        dimension,
        value,
        weight: 1,
        confidence: 1,
        stability: 1,
        source: "override",
        reason: "Pinned by you.",
        evidence: idx >= 0 ? result[idx].evidence : [],
      };
      if (idx >= 0) result[idx] = pinned;
      else result.push(pinned);
      continue;
    }

    // adjust — scale the derived weight (confidence/stability recompute-free:
    // they describe the evidence, which the override doesn't change).
    const factor = override.weight ?? 1;
    if (idx >= 0) {
      const base = result[idx];
      result[idx] = {
        ...base,
        weight: clamp01(base.weight * factor),
        source: "override",
        reason: `${base.reason} (adjusted by you ×${factor}).`,
      };
    } else {
      result.push({
        dimension,
        value,
        weight: clamp01(factor),
        confidence: 0.5,
        stability: 0,
        source: "override",
        reason: `Adjusted by you ×${factor}.`,
        evidence: [],
      });
    }
  }

  // Keep strongest first after edits.
  return result.sort((a, b) => b.weight - a.weight);
}
