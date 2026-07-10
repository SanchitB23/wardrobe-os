/**
 * Personalization Engine v2 (RFC-013) — preference evolution (audit).
 *
 * Diffs the previous-window profile against the current one, emitting a
 * before/after/signal/reason/timestamp record per changed preference value.
 * Pure and deterministic — no I/O, no AI, no ML. Read off already-derived
 * profiles; nothing is journaled.
 */

import type {
  DerivedPreference,
  PreferenceDimension,
  PreferenceEvolution,
  PreferenceSignalType,
  UserPreferenceProfile,
} from "@/domain/personalization/types";

/** Weight change below this is treated as no change (noise). */
export const EVOLUTION_EPSILON = 0.05;

const DIMENSION_FIELDS: { dimension: PreferenceDimension; field: keyof UserPreferenceProfile }[] = [
  { dimension: "color", field: "preferredColors" },
  { dimension: "brand", field: "preferredBrands" },
  { dimension: "formality", field: "preferredFormality" },
  { dimension: "footwear", field: "preferredFootwear" },
  { dimension: "style", field: "preferredStyles" },
  { dimension: "season", field: "preferredSeasons" },
  { dimension: "occasion", field: "preferredOccasions" },
  { dimension: "silhouette", field: "preferredSilhouettes" },
  { dimension: "care", field: "carePreference" },
  { dimension: "commute", field: "commutePreference" },
];

function prefsOf(profile: UserPreferenceProfile, field: keyof UserPreferenceProfile): DerivedPreference[] {
  const value = profile[field];
  return Array.isArray(value) ? (value as DerivedPreference[]) : [];
}

/** The dominant contributing signal type for a preference (most evidence). */
function dominantSignal(pref: DerivedPreference | undefined): PreferenceSignalType {
  if (!pref || pref.evidence.length === 0) return "wear";
  return [...pref.evidence].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))[0].type;
}

function reasonFor(before: number | null, after: number | null, value: string): string {
  if (before == null) return `${value} newly emerged`;
  if (after == null) return `${value} dropped off`;
  if (after > before) return `${value} strengthened`;
  return `${value} weakened`;
}

/**
 * Build the evolution audit between two derivations. `at` timestamps the change
 * (the current window end). Returns one entry per changed (dimension, value).
 */
export function buildEvolution(
  previous: UserPreferenceProfile,
  current: UserPreferenceProfile,
  at: string,
): PreferenceEvolution[] {
  const out: PreferenceEvolution[] = [];

  for (const { dimension, field } of DIMENSION_FIELDS) {
    const prev = new Map(prefsOf(previous, field).map((p) => [p.value, p]));
    const curr = new Map(prefsOf(current, field).map((p) => [p.value, p]));
    const values = new Set<string>([...prev.keys(), ...curr.keys()]);

    for (const value of [...values].sort()) {
      const before = prev.get(value)?.weight ?? null;
      const after = curr.get(value)?.weight ?? null;
      const delta = (after ?? 0) - (before ?? 0);
      const appeared = before == null && after != null;
      const removed = before != null && after == null;
      if (!appeared && !removed && Math.abs(delta) < EVOLUTION_EPSILON) continue;

      out.push({
        dimension,
        value,
        changes: [
          {
            before: before != null ? Number(before.toFixed(4)) : null,
            after: after != null ? Number(after.toFixed(4)) : null,
            signal: dominantSignal(curr.get(value) ?? prev.get(value)),
            reason: reasonFor(before, after, value),
            timestamp: at,
          },
        ],
      });
    }
  }

  return out;
}
