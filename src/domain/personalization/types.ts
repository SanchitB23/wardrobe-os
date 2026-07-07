/**
 * Personalization Engine types (RFC-004).
 *
 * Pure type definitions — no React, no Supabase, no AI, no I/O. The engine
 * DERIVES preferences from behaviour deterministically; AI only ever consumes
 * the resulting {@link UserPreferenceProfile}. Preferences are recalculated from
 * the full signal history each run, never incrementally mutated.
 */

import type { FormalityEnum } from "@/types/wardrobe";

/** The preference dimensions the engine derives. */
export type PreferenceDimension =
  | "color"
  | "brand"
  | "formality"
  | "footwear"
  | "style"
  | "season"
  | "occasion"
  | "silhouette"
  | "care"
  | "commute";

/** The behavioural signal types, strongest → weakest (see constants). */
export type PreferenceSignalType =
  | "wear" // from wear_logs
  | "outfit_saved" // from outfits (favourited/curated combinations)
  | "favorite" // from wardrobe_items.favorite
  | "purchase" // from purchases
  | "recommendation_accepted" // captured feedback (future capture)
  | "recommendation_rejected" // captured feedback — negative signal (future capture)
  | "manual_edit" // captured edit event (future capture)
  | "acquisition_decision"; // acted-on Buy vs Skip verdict (future capture)

/** One normalized, timestamped behavioural event. */
export interface PreferenceSignal {
  type: PreferenceSignalType;
  /** Which preference dimension(s) this event informs, with the observed value. */
  facets: { dimension: PreferenceDimension; value: string }[];
  /** +1 positive (wear/favourite/accept), -1 negative (reject). */
  polarity: 1 | -1;
  /** ISO timestamp — drives recency decay. */
  occurredAt: string;
  subjectId?: string | null;
}

export type OverrideMode = "pin" | "adjust" | "suppress";

/** An explicit user override. Overrides always win over derivation. */
export interface PreferenceOverride {
  dimension: PreferenceDimension;
  value: string;
  mode: OverrideMode;
  /** For "adjust": multiplier on the derived weight. */
  weight?: number | null;
}

/**
 * RESERVED — FUTURE (visualization only; see RFC-004 §9). The lifecycle state a
 * preference eventually belongs to. Declared for forward-compatibility; NOT
 * computed by {@link derivePreferenceProfile} in this RFC.
 */
export type PreferenceLifecycle = "core" | "emerging" | "declining" | "avoided";

/** How a derived preference's value was sourced. */
export type PreferenceSource = "derived" | "override" | "prior";

/** A single derived (or overridden) preference with evidence. */
export interface DerivedPreference {
  dimension: PreferenceDimension;
  value: string;
  /** Normalized strength within its dimension (0–1). */
  weight: number;
  /** How certain the engine is about this preference TODAY (0–1). "How sure are we?" */
  confidence: number;
  /**
   * How consistently this preference has REMAINED over time (0–1) — a concept
   * distinct from confidence. Confidence = "how sure are we now?"; stability =
   * "how consistent has this preference remained over time?"
   */
  stability: number;
  source: PreferenceSource;
  /**
   * RESERVED — FUTURE (not populated in this RFC). Lifecycle classification for
   * visualization.
   */
  lifecycle?: PreferenceLifecycle;
  /**
   * RESERVED — FUTURE (not populated in this RFC). ISO month/date when the
   * preference became dominant — e.g. "2026-05".
   */
  since?: string | null;
  /** Auditable "because": contributing signals and their contribution. */
  reason: string;
  evidence: { type: PreferenceSignalType; count: number; contribution: number }[];
}

/**
 * THE standardized output. Feeds `RecommendationContext.preferences`, and is the
 * only thing AI ever consumes for personalization.
 */
export interface UserPreferenceProfile {
  preferredColors: DerivedPreference[];
  preferredBrands: DerivedPreference[];
  preferredFormality: DerivedPreference[];
  preferredFootwear: DerivedPreference[];
  preferredStyles: DerivedPreference[];
  preferredSeasons: DerivedPreference[];
  preferredOccasions: DerivedPreference[];
  preferredSilhouettes: DerivedPreference[];
  carePreference: DerivedPreference[];
  commutePreference: DerivedPreference[];
  /** Items the user protects (never suggest removing / flag as unused). */
  protectedItemIds: string[];
  /** Items the user avoids (stop recommending / stop suggesting buying more). */
  avoidedItemIds: string[];
  /** Overall profile confidence (evidence-weighted mean of included preferences). */
  confidence: number;
  /** True when evidence is thin and the prior dominates. */
  coldStart: boolean;
  metadata: {
    engineVersion: string;
    generatedAt: string;
    signalCount: number;
    overrideCount: number;
  };
}

/** A cold-start prior — today's static `DEFAULT_PREFERENCES`, mapped in. */
export interface PreferencePrior {
  preferredStyles?: string[];
  preferredFormality?: FormalityEnum[];
  avoidedColors?: string[];
}

export interface PersonalizationInput {
  signals: PreferenceSignal[];
  overrides?: PreferenceOverride[];
  protectedItemIds?: string[];
  avoidedItemIds?: string[];
  /** Cold-start prior, used when evidence is thin. */
  prior?: PreferencePrior;
}

export interface PersonalizationOptions {
  generatedAt?: string;
}

// ---------------------------------------------------------------------------
// RESERVED — FUTURE shapes (declared for forward-compatibility; not produced by
// derivePreferenceProfile in this RFC). See RFC-004 §9.
// ---------------------------------------------------------------------------

/** RESERVED — FUTURE. Time series of a preference, for visualization. */
export interface PreferenceTimeline {
  dimension: PreferenceDimension;
  value: string;
  points: {
    at: string;
    weight: number;
    confidence: number;
    stability: number;
    lifecycle?: PreferenceLifecycle;
  }[];
}

/** RESERVED — FUTURE. Audit/debug record of preference changes over time. */
export interface PreferenceEvolution {
  dimension: PreferenceDimension;
  value: string;
  changes: {
    before: number | null;
    after: number | null;
    signal: PreferenceSignalType;
    reason: string;
    timestamp: string;
  }[];
}
