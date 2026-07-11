/**
 * StrategyEvolution (RFC-018B) — pure.
 * Dynamic shopping strategy rules from outcomes — distinct from RFC-018's
 * static top-N queue steps.
 */

import type {
  DynamicShoppingStrategy,
  NeedTimeline,
  OpportunityQueue,
  RecommendationAccuracyReport,
  RoiTimeline,
  ShoppingStrategyRule,
} from "@/domain/shopping/v2/types";

export interface StrategyEvolutionInput {
  accuracy: RecommendationAccuracyReport;
  roiTimeline: RoiTimeline;
  needTimeline: NeedTimeline;
  opportunityQueue: OpportunityQueue;
  generatedAt: string;
}

export function buildDynamicStrategy(
  input: StrategyEvolutionInput,
): DynamicShoppingStrategy {
  const rules: ShoppingStrategyRule[] = [];

  if (
    input.accuracy.deepSampleSize >= 3 &&
    input.accuracy.deepAccuracyPercent != null &&
    input.accuracy.deepAccuracyPercent < 50
  ) {
    rules.push({
      code: "CALIBRATE_BUY_CALLS",
      message:
        "Deep recommendation accuracy is low — pause aggressive buys until more wears prove ROI.",
      severity: "warn",
      evidence: [
        `deepAccuracy=${input.accuracy.deepAccuracyPercent}%`,
        `deepSample=${input.accuracy.deepSampleSize}`,
      ],
    });
  } else if (
    input.accuracy.sampleSize >= 3 &&
    input.accuracy.accuracyPercent != null &&
    input.accuracy.accuracyPercent >= 70
  ) {
    rules.push({
      code: "TRUST_VERDICTS",
      message:
        "Shallow recommendation accuracy is strong — keep trusting Buy vs Skip outcomes.",
      severity: "info",
      evidence: [
        `accuracy=${input.accuracy.accuracyPercent}%`,
        `sample=${input.accuracy.sampleSize}`,
      ],
    });
  }

  const worst = input.roiTimeline.worstCategories[0];
  if (worst && worst.score < 40) {
    rules.push({
      code: "STOP_CATEGORY",
      message: `Stop repeating low-ROI purchases in ${worst.category}.`,
      severity: "warn",
      evidence: [`categoryScore=${worst.score}`, `category=${worst.category}`],
    });
  }

  const best = input.roiTimeline.bestCategories[0];
  if (best && best.score >= 70) {
    rules.push({
      code: "LEAN_INTO_CATEGORY",
      message: `${best.category} purchases are working — prefer similar fills when needed.`,
      severity: "info",
      evidence: [`categoryScore=${best.score}`, `category=${best.category}`],
    });
  }

  const highNeed = [...input.needTimeline.points]
    .filter((p) => p.needScore >= 65)
    .sort((a, b) => b.needScore - a.needScore)[0];
  if (highNeed?.category) {
    rules.push({
      code: "FOCUS_GAP",
      message: `Focus acquisitions on the open gap: ${highNeed.category}.`,
      severity: "info",
      evidence: [
        `needScore=${highNeed.needScore}`,
        `category=${highNeed.category}`,
      ],
    });
  }

  const lowImpact = input.opportunityQueue.filter(
    (o) => o.opportunityScore < 40 && o.fromPriority < 50,
  );
  if (lowImpact.length >= 2) {
    rules.push({
      code: "DELAY_LOW_IMPACT",
      message:
        "Delay low-opportunity wishlist items — several sit below useful priority.",
      severity: "warn",
      evidence: lowImpact.slice(0, 3).map((o) => `${o.name}:${o.opportunityScore}`),
    });
  }

  const top = input.opportunityQueue[0];
  if (top && top.opportunityScore >= 70) {
    rules.push({
      code: "PURSUE_TOP_OPPORTUNITY",
      message: `Next learned opportunity: ${top.name}.`,
      severity: "info",
      evidence: [
        `opportunity=${top.opportunityScore}`,
        `fromPriority=${top.fromPriority}`,
        ...top.reasons.slice(0, 2),
      ],
    });
  }

  if (rules.length === 0) {
    rules.push({
      code: "GATHER_OUTCOMES",
      message:
        "Not enough purchase outcomes yet — keep logging buys and wears to learn strategy.",
      severity: "info",
      evidence: [
        `accuracySample=${input.accuracy.sampleSize}`,
        `roiPoints=${input.roiTimeline.points.length}`,
      ],
    });
  }

  return { rules, generatedAt: input.generatedAt };
}
