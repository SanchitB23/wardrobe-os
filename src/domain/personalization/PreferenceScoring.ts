/**
 * Pure preference scoring (RFC-004): recency decay + weighted aggregation of
 * signals into per-dimension, per-value raw weights and evidence. Deterministic;
 * no I/O, no time reads (ages are computed against an injected `now`).
 */

import { HALF_LIFE_DAYS, SIGNAL_WEIGHTS } from "@/domain/personalization/constants";
import type {
  PreferenceDimension,
  PreferenceSignal,
  PreferenceSignalType,
} from "@/domain/personalization/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Whole days between two ISO instants (never negative). */
export function ageInDays(occurredAt: string, now: string): number {
  const then = Date.parse(occurredAt);
  const ref = Date.parse(now);
  if (Number.isNaN(then) || Number.isNaN(ref)) return 0;
  return Math.max(0, (ref - then) / MS_PER_DAY);
}

/** Exponential recency decay: 1 at age 0, 0.5 at one half-life, → 0 with age. */
export function recencyDecay(ageDays: number, halfLifeDays = HALF_LIFE_DAYS): number {
  if (halfLifeDays <= 0) return 1;
  return 0.5 ** (ageDays / halfLifeDays);
}

/** Per-signal-type contribution to a single value. */
export interface EvidenceEntry {
  type: PreferenceSignalType;
  count: number;
  /** Signed, decayed contribution (positive for +ve signals, negative for rejects). */
  contribution: number;
}

/** Aggregated evidence for one (dimension, value) pair. */
export interface ValueAggregate {
  dimension: PreferenceDimension;
  value: string;
  /** Signed sum of all decayed contributions (can be negative → net-avoided). */
  rawWeight: number;
  positiveMass: number;
  negativeMass: number;
  totalCount: number;
  /** ISO timestamps of contributing signals (for stability + reserved `since`). */
  occurredAts: string[];
  evidence: EvidenceEntry[];
}

export type DimensionAggregates = Map<PreferenceDimension, Map<string, ValueAggregate>>;

function emptyAggregate(dimension: PreferenceDimension, value: string): ValueAggregate {
  return {
    dimension,
    value,
    rawWeight: 0,
    positiveMass: 0,
    negativeMass: 0,
    totalCount: 0,
    occurredAts: [],
    evidence: [],
  };
}

function bumpEvidence(agg: ValueAggregate, type: PreferenceSignalType, contribution: number): void {
  const existing = agg.evidence.find((e) => e.type === type);
  if (existing) {
    existing.count += 1;
    existing.contribution += contribution;
  } else {
    agg.evidence.push({ type, count: 1, contribution });
  }
}

/**
 * Aggregate signals into per-dimension, per-value weighted evidence. Each
 * signal contributes `polarity · signalWeight · recencyDecay(age)` to every
 * facet value it names.
 */
export function aggregateSignals(signals: PreferenceSignal[], now: string): DimensionAggregates {
  const byDimension: DimensionAggregates = new Map();

  for (const signal of signals) {
    const decay = recencyDecay(ageInDays(signal.occurredAt, now));
    const magnitude = SIGNAL_WEIGHTS[signal.type] ?? 0;
    const contribution = signal.polarity * magnitude * decay;

    for (const facet of signal.facets) {
      const value = facet.value?.trim();
      if (!value) continue;

      let valueMap = byDimension.get(facet.dimension);
      if (!valueMap) {
        valueMap = new Map();
        byDimension.set(facet.dimension, valueMap);
      }
      let agg = valueMap.get(value);
      if (!agg) {
        agg = emptyAggregate(facet.dimension, value);
        valueMap.set(value, agg);
      }

      agg.rawWeight += contribution;
      agg.totalCount += 1;
      agg.occurredAts.push(signal.occurredAt);
      if (contribution >= 0) agg.positiveMass += contribution;
      else agg.negativeMass += Math.abs(contribution);
      bumpEvidence(agg, signal.type, contribution);
    }
  }

  return byDimension;
}

/**
 * Normalize a value's positive raw weight within its dimension to [0,1] against
 * the strongest positive value in that dimension.
 */
export function normalizedWeight(agg: ValueAggregate, maxPositiveInDimension: number): number {
  if (maxPositiveInDimension <= 0) return 0;
  return Math.max(0, agg.rawWeight) / maxPositiveInDimension;
}

/** The strongest positive raw weight across a dimension's values (for normalization). */
export function maxPositiveWeight(valueMap: Map<string, ValueAggregate>): number {
  let max = 0;
  for (const agg of valueMap.values()) {
    if (agg.rawWeight > max) max = agg.rawWeight;
  }
  return max;
}
