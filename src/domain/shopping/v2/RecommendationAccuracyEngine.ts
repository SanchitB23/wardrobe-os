/**
 * RecommendationAccuracyEngine (RFC-018B) — pure.
 * Extends shallow buy→purchased / skip→dismissed accuracy with deep outcomes:
 * Recommended Buy → Bought → Worn → acceptable ROI → was the call correct?
 */

import type { BuyDecision } from "@/domain/acquisition";
import type { WishlistStatus } from "@/domain/shopping/types";
import {
  computeRecommendationAccuracy,
  isAccuracyHit,
} from "@/domain/shopping/recommendationAccuracy";
import { ACCEPTABLE_MAX_COST_PER_WEAR } from "@/domain/shopping/v2/constants";
import type {
  RecommendationAccuracyCase,
  RecommendationAccuracyReport,
} from "@/domain/shopping/v2/types";

export interface AccuracyDecisionInput {
  decisionId: string;
  itemName: string;
  decision: BuyDecision;
  /** Wishlist status matched by name, if any. */
  outcome: WishlistStatus | null;
  wears: number;
  costPerWear: number | null;
}

/**
 * Deep hit for a buy: purchased, worn at least once, and ROI acceptable when
 * CPW is known. Skip deep hit: dismissed (and not purchased).
 */
export function isDeepAccuracyHit(input: AccuracyDecisionInput): boolean | null {
  const { decision, outcome, wears, costPerWear } = input;
  if (decision === "consider") return null;
  if (!outcome || (outcome !== "purchased" && outcome !== "dismissed")) {
    return null;
  }

  if (decision === "buy") {
    if (outcome !== "purchased") return false;
    if (wears < 1) return false;
    if (costPerWear != null && costPerWear > ACCEPTABLE_MAX_COST_PER_WEAR) {
      return false;
    }
    return true;
  }

  // skip
  return outcome === "dismissed";
}

export function buildRecommendationAccuracyReport(
  inputs: AccuracyDecisionInput[],
): RecommendationAccuracyReport {
  const shallow = computeRecommendationAccuracy(
    inputs.map((i) => ({ decision: i.decision, outcome: i.outcome })),
  );

  let deepSampleSize = 0;
  let deepHits = 0;
  const cases: RecommendationAccuracyCase[] = inputs.map((input) => {
    const bought = input.outcome === "purchased";
    const worn = input.wears >= 1;
    const deepCorrect = isDeepAccuracyHit(input);

    let correct: boolean | null = null;
    if (
      input.outcome &&
      (input.outcome === "purchased" || input.outcome === "dismissed") &&
      input.decision !== "consider"
    ) {
      correct = isAccuracyHit(input.decision, input.outcome);
    }

    if (deepCorrect !== null) {
      deepSampleSize += 1;
      if (deepCorrect) deepHits += 1;
    }

    return {
      decisionId: input.decisionId,
      itemName: input.itemName,
      decision: input.decision,
      bought,
      worn,
      costPerWear: input.costPerWear,
      correct,
      deepCorrect,
    };
  });

  return {
    sampleSize: shallow.sampleSize,
    hits: shallow.hits,
    accuracyPercent: shallow.accuracyPercent,
    deepSampleSize,
    deepHits,
    deepAccuracyPercent:
      deepSampleSize === 0
        ? null
        : Math.round((deepHits / deepSampleSize) * 100),
    cases,
  };
}
