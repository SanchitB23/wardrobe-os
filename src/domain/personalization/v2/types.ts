/**
 * Personalization Engine v2 (RFC-013) — domain types.
 *
 * Pure type definitions — no React, no Supabase, no AI, no ML. v2 promotes the
 * RFC-004 reserved shapes (`PreferenceLifecycle`, `PreferenceTimeline`,
 * `PreferenceEvolution`, `DerivedPreference.lifecycle` / `since`) from *declared*
 * to *produced*, and adds an explore/exploit control. Behaviour is the source of
 * truth; the engine derives; AI only ever consumes the result.
 */

import type {
  DerivedPreference,
  PreferenceDimension,
  PreferenceEvolution,
  PreferenceLifecycle,
  PreferenceSignal,
  UserPreferenceProfile,
} from "@/domain/personalization/types";

export type { PreferenceLifecycle, PreferenceEvolution, PreferenceDimension };

/** How strongly recommendations lean on known taste vs surface neglected items. */
export type ExploreExploitMode = "explore" | "balanced" | "exploit";

/** Deterministic weight adjustments the mode applies to Recommendation Engine v2. */
export interface ExploreExploitWeights {
  /** Multiplier on RFC-012 `personalPreferenceFit`. */
  preferenceFit: number;
  /** Multiplier on RFC-012 `wardrobeHealthContribution` (rotation/novelty). */
  wardrobeHealthContribution: number;
  /** Integer nudge to the diversity threshold (explore → more diverse top-K). */
  diversityBias: number;
}

/** Direction of a preference over its timeline. */
export type PreferenceTrend = "rising" | "steady" | "falling";

/** One point in a preference's timeline (an as-of derivation window). */
export interface TimelinePoint {
  /** ISO — the window end this point was derived as-of. */
  at: string;
  weight: number;
  confidence: number;
  stability: number;
  lifecycle?: PreferenceLifecycle;
}

/** Time series of one preference value, for visualization. */
export interface PreferenceTimeline {
  dimension: PreferenceDimension;
  value: string;
  points: TimelinePoint[];
  trend: PreferenceTrend;
}

/** Rolling-window parameters for timeline/lifecycle derivation. */
export interface WindowOptions {
  /** Days between successive window ends. */
  stepDays: number;
  /** Number of windows (points), ending at `generatedAt`. */
  count: number;
}

export interface PersonalizationV2Options {
  generatedAt?: string;
  /** Return the full `PreferenceTimeline[]` (opt-in; lifecycle is always computed). */
  withTimeline?: boolean;
  /** Override the default rolling window. */
  window?: WindowOptions;
  /** How many top preferences (by weight) to build timelines for. */
  timelineTopN?: number;
}

/** The standardized v2 output. */
export interface PersonalizationProfileV2 {
  /** The profile, with `lifecycle` + `since` populated on every preference. */
  profile: UserPreferenceProfile;
  /** Timelines for the top preferences (empty unless `withTimeline`). */
  timelines: PreferenceTimeline[];
  /** Audit of what changed between the previous window and now. */
  evolution: PreferenceEvolution[];
  /** Net-negative values the user steers away from (lifecycle: "avoided"). */
  avoidedPreferences: { dimension: PreferenceDimension; value: string }[];
}

/** Structured input to the pure lifecycle classifier. */
export interface LifecycleInput {
  /** Current normalized weight (0–1). */
  weight: number;
  /** Current stability (0–1). */
  stability: number;
  trend: PreferenceTrend;
  /** True when the value's net signal is negative (being avoided). */
  netNegative: boolean;
}

export type { PreferenceSignal, DerivedPreference };
