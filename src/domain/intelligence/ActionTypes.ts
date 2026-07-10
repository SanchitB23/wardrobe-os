/**
 * Intelligence Center (RFC-015) — action types + normalized source inputs.
 *
 * Pure type definitions. The Center consumes **normalized source inputs** (small
 * structural views the feature service maps engine outputs into) rather than the
 * raw engine types — so the domain stays decoupled from all eight engines and is
 * trivially unit-testable. Engines decide; the Center aggregates + ranks; AI
 * explains (ADR-005). No React, no Supabase, no I/O.
 */

export type ActionType =
  | "wear"
  | "buy"
  | "skip"
  | "clean"
  | "rotate"
  | "pack"
  | "replace"
  | "explore";

export type ActionPriority = "critical" | "high" | "medium" | "low";

export type ActionSource =
  | "recommendation"
  | "health"
  | "usage"
  | "acquisition"
  | "personalization"
  | "lifestyle"
  | "weather"
  | "vision";

export type ActionReasonCode =
  | "top_recommendation"
  | "over_rotation"
  | "under_rotation"
  | "stale_item"
  | "wardrobe_gap"
  | "buy_verdict"
  | "skip_verdict"
  | "laundry_due"
  | "trip_packing"
  | "worn_out"
  | "duplicate"
  | "explore_underused"
  | "weather_mismatch";

export type ActionSubjectKind =
  | "item"
  | "outfit"
  | "category"
  | "trip"
  | "prospective_item";

export interface ActionSubject {
  kind: ActionSubjectKind;
  /** Stable id where one exists (item/outfit); category/trip use the label. */
  id?: string;
  label: string;
}

/** One prioritised, typed action. */
export interface ActionCard {
  id: string;
  type: ActionType;
  subject: ActionSubject;
  priority: ActionPriority;
  /** 0–1 — how much doing this improves the wardrobe/day. Drives ranking. */
  impact: number;
  /** 0–1 — how sure the source engine is. */
  confidence: number;
  /** Short, deterministic human sentence. */
  reason: string;
  reasonCodes: ActionReasonCode[];
  /** Contributing engines (≥1 after dedup). */
  sources: ActionSource[];
  /** Optional deep-link into the existing feature flow. */
  href?: string;
  /** Debug: how the final impact was formed. */
  debug: {
    provisionalImpact: number;
    sourceReliability: number;
    dedupedFrom: number;
  };
}

/** The standardized Intelligence Center output. */
export interface IntelligenceCenterResult {
  topActions: ActionCard[];
  generatedAt: string;
  metadata: {
    engineVersion: string;
    candidateCount: number;
    dedupedCount: number;
    bySource: Partial<Record<ActionSource, number>>;
  };
}

// ---------------------------------------------------------------------------
// Normalized source inputs (mapped by the feature service from engine outputs).
// All impact-ish numbers are 0–1; confidence 0–1.
// ---------------------------------------------------------------------------

export interface RecommendationSourceInput {
  /** The single top recommended outfit for the day. */
  topOutfit?: { id: string; label: string; score: number; confidence: number };
}

export interface HealthSourceInput {
  /** Coverage gaps (0–1 severity). */
  gaps?: { label: string; severity: number }[];
  /** Redundant clusters (higher count → more redundant). */
  duplicates?: { label: string; count: number }[];
  /** Items past their useful life. */
  wornOut?: { itemId: string; label: string }[];
}

export interface UsageSourceInput {
  /** Worn far above the wardrobe mean (ratio ≥ 1). */
  overRotated?: { itemId: string; label: string; ratio: number }[];
  /** Never-worn or stale, non-protected items. */
  underUsed?: { itemId: string; label: string; stale: boolean }[];
}

export interface AcquisitionSourceInput {
  verdicts?: { label: string; decision: "buy" | "skip"; score: number; confidence: number }[];
}

export interface PersonalizationSourceInput {
  exploreMode?: "explore" | "balanced" | "exploit";
  /** Under-used pieces that match taste — surfaced only in explore. */
  underusedFavorites?: { itemId: string; label: string }[];
}

export interface LifestyleSourceInput {
  laundry?: { label: string; urgency: number }[];
  packing?: { tripLabel: string; itemCount: number };
}

export interface WeatherSourceInput {
  /** Set when the day's weather makes the current top pick unsuitable. */
  severeMismatch?: { label: string };
}

export interface VisionSourceInput {
  candidate?: { label: string; decision: "buy" | "skip"; confidence: number };
}

/** Already-computed, normalized engine outputs the Center aggregates. */
export interface IntelligenceSources {
  recommendation?: RecommendationSourceInput;
  health?: HealthSourceInput;
  usage?: UsageSourceInput;
  acquisition?: AcquisitionSourceInput;
  personalization?: PersonalizationSourceInput;
  lifestyle?: LifestyleSourceInput;
  weather?: WeatherSourceInput;
  vision?: VisionSourceInput;
}

export interface IntelligenceCenterOptions {
  generatedAt?: string;
  /** Max actions returned (default 7). */
  topN?: number;
}

/** A pre-ranking candidate — an ActionCard without the final impact/priority. */
export interface ActionCandidate {
  type: ActionType;
  subject: ActionSubject;
  source: ActionSource;
  /** 0–1 signal strength from the source engine. */
  provisionalImpact: number;
  confidence: number;
  reason: string;
  reasonCodes: ActionReasonCode[];
  href?: string;
}
