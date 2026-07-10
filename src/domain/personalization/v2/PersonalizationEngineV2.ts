/**
 * Personalization Engine v2 (RFC-013) — the entry point.
 *
 * Refines the v1 point-in-time profile with **lifecycle**, a re-derivable
 * **timeline**, an **evolution** audit, and sharper **stability** — all by
 * re-running the pure v1 derivation over rolling historical windows. Adds no new
 * signal model and no new data source. Behaviour is the source of truth; the
 * engine derives; AI only consumes. Deterministic: same signals + overrides +
 * `generatedAt` + window ⇒ identical output. No AI, no ML, no randomness.
 */

import { derivePreferenceProfile } from "@/domain/personalization/PersonalizationEngine";
import { aggregateSignals } from "@/domain/personalization/PreferenceScoring";
import type {
  DerivedPreference,
  PersonalizationInput,
  PreferenceDimension,
  PreferenceSignal,
  UserPreferenceProfile,
} from "@/domain/personalization/types";
import { classifyLifecycle } from "@/domain/personalization/v2/PreferenceLifecycle";
import { seriesStability, sinceFrom } from "@/domain/personalization/v2/PreferenceStability";
import {
  DEFAULT_WINDOW,
  buildTimeline,
  deriveWindowEnds,
} from "@/domain/personalization/v2/PreferenceTimeline";
import { buildEvolution } from "@/domain/personalization/v2/PreferenceEvolution";
import type {
  PersonalizationProfileV2,
  PersonalizationV2Options,
  PreferenceTimeline,
  TimelinePoint,
} from "@/domain/personalization/v2/types";

export const PERSONALIZATION_V2_ENGINE_VERSION = "2.0.0";

const DEFAULT_TIMELINE_TOP_N = 6;

/** Dimension → the profile array field holding its derived preferences. */
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

function findPref(
  profile: UserPreferenceProfile,
  field: keyof UserPreferenceProfile,
  value: string,
): DerivedPreference | undefined {
  return prefsOf(profile, field).find((p) => p.value === value);
}

function signalsUpTo(signals: readonly PreferenceSignal[], endIso: string): PreferenceSignal[] {
  const end = Date.parse(endIso);
  return signals.filter((s) => Date.parse(s.occurredAt) <= end);
}

/**
 * Derive the v2 profile: the v1 point-in-time profile enriched with lifecycle +
 * `since`, plus optional timelines, an evolution audit, and the avoided values.
 */
export function derivePreferenceProfileV2(
  input: PersonalizationInput,
  options: PersonalizationV2Options = {},
): PersonalizationProfileV2 {
  const now = options.generatedAt ?? new Date().toISOString();
  const window = options.window ?? DEFAULT_WINDOW;
  const timelineTopN = options.timelineTopN ?? DEFAULT_TIMELINE_TOP_N;

  // Current profile (v1 core) as-of now.
  const current = derivePreferenceProfile(input, { generatedAt: now });

  // As-of derivations over the rolling windows (oldest → newest).
  const windowEnds = deriveWindowEnds(now, window);
  const asOf = windowEnds.map((end) => ({
    end,
    profile: derivePreferenceProfile(
      { ...input, signals: signalsUpTo(input.signals, end) },
      { generatedAt: end },
    ),
  }));
  const previousWindow = asOf.length >= 2 ? asOf[asOf.length - 2].profile : current;

  // Net-negative (avoided) values, from the same aggregates the profile derives from.
  const aggregates = aggregateSignals([...input.signals], now);
  const avoidedPreferences: { dimension: PreferenceDimension; value: string }[] = [];
  for (const [dimension, valueMap] of aggregates.entries()) {
    for (const agg of valueMap.values()) {
      if (agg.rawWeight <= 0 && agg.negativeMass > 0) {
        avoidedPreferences.push({ dimension, value: agg.value });
      }
    }
  }
  avoidedPreferences.sort((a, b) => a.dimension.localeCompare(b.dimension) || a.value.localeCompare(b.value));

  // Enrich each current preference with lifecycle + since + series stability, and
  // (opt-in) collect its timeline.
  const timelines: PreferenceTimeline[] = [];
  const enrichedFields: Partial<Record<keyof UserPreferenceProfile, DerivedPreference[]>> = {};

  for (const { dimension, field } of DIMENSION_FIELDS) {
    const enriched = prefsOf(current, field).map((pref) => {
      const points: TimelinePoint[] = asOf.map(({ end, profile }) => {
        const at = findPref(profile, field, pref.value);
        return {
          at: end,
          weight: at?.weight ?? 0,
          confidence: at?.confidence ?? 0,
          stability: at?.stability ?? 0,
        };
      });
      const weights = points.map((p) => p.weight);
      const timeline = buildTimeline(dimension, pref.value, points);
      // Overrides always win: keep the user-set stability and don't let the
      // timeline reclassify a pinned/adjusted preference.
      const isOverride = pref.source === "override";
      const stability = isOverride ? pref.stability : seriesStability(weights);
      const lifecycle = classifyLifecycle({
        weight: pref.weight,
        stability,
        trend: isOverride ? "steady" : timeline.trend,
        netNegative: false, // profile preferences are positive by construction
      });
      const since = isOverride ? (pref.since ?? null) : sinceFrom(points);

      if (options.withTimeline) timelines.push({ ...timeline, dimension, value: pref.value });

      return { ...pref, stability, lifecycle, since };
    });
    enrichedFields[field] = enriched;
  }

  const profile: UserPreferenceProfile = {
    ...current,
    ...(enrichedFields as Partial<UserPreferenceProfile>),
    metadata: { ...current.metadata, engineVersion: PERSONALIZATION_V2_ENGINE_VERSION },
  };

  // Keep only the strongest timelines (by current weight) when requested.
  const topTimelines = options.withTimeline
    ? [...timelines]
        .sort((a, b) => {
          const aw = findPref(profile, DIMENSION_FIELDS.find((d) => d.dimension === a.dimension)!.field, a.value)?.weight ?? 0;
          const bw = findPref(profile, DIMENSION_FIELDS.find((d) => d.dimension === b.dimension)!.field, b.value)?.weight ?? 0;
          return bw - aw || a.dimension.localeCompare(b.dimension) || a.value.localeCompare(b.value);
        })
        .slice(0, timelineTopN)
    : [];

  const evolution = buildEvolution(previousWindow, profile, now);

  return { profile, timelines: topTimelines, evolution, avoidedPreferences };
}
