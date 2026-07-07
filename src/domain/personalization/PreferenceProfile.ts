/**
 * Pure profile assembly (RFC-004): turn aggregated evidence into ranked
 * {@link DerivedPreference} lists and assemble the final
 * {@link UserPreferenceProfile}. Handles cold-start fallback to a prior.
 * Deterministic — no I/O, injected `now`.
 */

import { MAX_PER_DIMENSION, PRIOR_CONFIDENCE } from "@/domain/personalization/constants";
import { computeConfidence, computeStability, isColdStart } from "@/domain/personalization/PreferenceConfidence";
import {
  maxPositiveWeight,
  normalizedWeight,
  type DimensionAggregates,
  type ValueAggregate,
} from "@/domain/personalization/PreferenceScoring";
import type {
  DerivedPreference,
  PreferenceDimension,
  PreferencePrior,
  PreferenceSignalType,
  UserPreferenceProfile,
} from "@/domain/personalization/types";

const SIGNAL_PHRASE: Record<PreferenceSignalType, (n: number) => string> = {
  wear: (n) => `worn ${n}×`,
  favorite: (n) => `favourited ${n}×`,
  outfit_saved: (n) => `in ${n} saved outfit${n === 1 ? "" : "s"}`,
  purchase: (n) => `purchased ${n}×`,
  recommendation_accepted: (n) => `accepted ${n} rec${n === 1 ? "" : "s"}`,
  recommendation_rejected: (n) => `rejected ${n} rec${n === 1 ? "" : "s"}`,
  manual_edit: (n) => `edited ${n}×`,
  acquisition_decision: (n) => `${n} buy decision${n === 1 ? "" : "s"}`,
};

function buildReason(agg: ValueAggregate): string {
  const parts = [...agg.evidence]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 2)
    .map((e) => SIGNAL_PHRASE[e.type](e.count));
  if (parts.length === 0) return "Derived from your behaviour.";
  const sentence = parts.join(", ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

/** Build ranked, positive preferences for one dimension from its evidence. */
export function deriveDimension(
  valueMap: Map<string, ValueAggregate>,
  now: string,
): DerivedPreference[] {
  const maxPositive = maxPositiveWeight(valueMap);
  const derived: DerivedPreference[] = [];

  for (const agg of valueMap.values()) {
    // Net-negative values are not preferences (they are being avoided).
    if (agg.rawWeight <= 0) continue;
    derived.push({
      dimension: agg.dimension,
      value: agg.value,
      weight: normalizedWeight(agg, maxPositive),
      confidence: computeConfidence(agg),
      stability: computeStability(agg, now),
      source: "derived",
      reason: buildReason(agg),
      evidence: agg.evidence.map((e) => ({
        type: e.type,
        count: e.count,
        contribution: Number(e.contribution.toFixed(4)),
      })),
    });
  }

  return derived.sort((a, b) => b.weight - a.weight).slice(0, MAX_PER_DIMENSION);
}

type PreferenceArrayField =
  | "preferredColors"
  | "preferredBrands"
  | "preferredFormality"
  | "preferredFootwear"
  | "preferredStyles"
  | "preferredSeasons"
  | "preferredOccasions"
  | "preferredSilhouettes"
  | "carePreference"
  | "commutePreference";

const DIMENSION_TO_FIELD: Record<PreferenceDimension, PreferenceArrayField> = {
  color: "preferredColors",
  brand: "preferredBrands",
  formality: "preferredFormality",
  footwear: "preferredFootwear",
  style: "preferredStyles",
  season: "preferredSeasons",
  occasion: "preferredOccasions",
  silhouette: "preferredSilhouettes",
  care: "carePreference",
  commute: "commutePreference",
};

/** Map a prior (static defaults) into low-confidence, prior-sourced preferences. */
export function priorPreferences(prior: PreferencePrior | undefined): {
  dimension: PreferenceDimension;
  items: DerivedPreference[];
}[] {
  if (!prior) return [];
  const make = (dimension: PreferenceDimension, values: string[] | undefined): DerivedPreference[] =>
    (values ?? []).map((value) => ({
      dimension,
      value,
      weight: 0.5,
      confidence: PRIOR_CONFIDENCE,
      stability: 0,
      source: "prior" as const,
      reason: "Starting assumption — still learning your taste.",
      evidence: [],
    }));

  return [
    { dimension: "style", items: make("style", prior.preferredStyles) },
    { dimension: "formality", items: make("formality", prior.preferredFormality) },
  ];
}

function emptyProfileFields(): Pick<UserPreferenceProfile,
  | "preferredColors" | "preferredBrands" | "preferredFormality" | "preferredFootwear"
  | "preferredStyles" | "preferredSeasons" | "preferredOccasions" | "preferredSilhouettes"
  | "carePreference" | "commutePreference"> {
  return {
    preferredColors: [],
    preferredBrands: [],
    preferredFormality: [],
    preferredFootwear: [],
    preferredStyles: [],
    preferredSeasons: [],
    preferredOccasions: [],
    preferredSilhouettes: [],
    carePreference: [],
    commutePreference: [],
  };
}

/** Evidence-weighted mean confidence across all included preferences. */
function overallConfidence(all: DerivedPreference[]): number {
  let weightSum = 0;
  let confSum = 0;
  for (const p of all) {
    const evidenceCount = p.evidence.reduce((n, e) => n + e.count, 0);
    const w = Math.max(1, evidenceCount);
    weightSum += w;
    confSum += w * p.confidence;
  }
  return weightSum > 0 ? Number((confSum / weightSum).toFixed(4)) : 0;
}

export interface AssembleProfileArgs {
  byDimension: DimensionAggregates;
  overridesFor: (dimension: PreferenceDimension, derived: DerivedPreference[]) => DerivedPreference[];
  protectedItemIds: string[];
  avoidedItemIds: string[];
  signalCount: number;
  overrideCount: number;
  prior?: PreferencePrior;
  now: string;
  engineVersion: string;
}

/** Assemble the final profile (with cold-start prior fallback). */
export function assembleProfile(args: AssembleProfileArgs): UserPreferenceProfile {
  const fields = emptyProfileFields();
  const coldStart = isColdStart(args.signalCount);

  // Derive each dimension, then let overrides win.
  for (const [dimension, valueMap] of args.byDimension.entries()) {
    const derived = deriveDimension(valueMap, args.now);
    fields[DIMENSION_TO_FIELD[dimension]] = args.overridesFor(dimension, derived);
  }

  // Cold start: seed the empty dimensions from the prior (low confidence).
  if (coldStart) {
    for (const { dimension, items } of priorPreferences(args.prior)) {
      const field = DIMENSION_TO_FIELD[dimension];
      if (fields[field].length === 0 && items.length > 0) {
        fields[field] = args.overridesFor(dimension, items);
      }
    }
  }

  const all = Object.values(fields).flat();

  return {
    ...fields,
    protectedItemIds: [...new Set(args.protectedItemIds)].sort(),
    avoidedItemIds: [...new Set(args.avoidedItemIds)].sort(),
    confidence: overallConfidence(all),
    coldStart,
    metadata: {
      engineVersion: args.engineVersion,
      generatedAt: args.now,
      signalCount: args.signalCount,
      overrideCount: args.overrideCount,
    },
  };
}
