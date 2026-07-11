/**
 * OpportunityEngine (RFC-018B) — pure.
 * Ranks what to pursue next from RFC-018 priority + lifecycle urgency + need.
 * Never re-runs Buy vs Skip or PriorityEngine scoring.
 */

import type { ShoppingDashboard } from "@/domain/shopping/types";
import {
  LIFECYCLE_URGENCY,
  OPPORTUNITY_WEIGHTS,
} from "@/domain/shopping/v2/constants";
import type {
  OpportunityItem,
  OpportunityQueue,
  PurchaseLifecycle,
  PurchaseLifecycleState,
} from "@/domain/shopping/v2/types";

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export interface OpportunityEngineInput {
  dashboard: ShoppingDashboard;
  lifecycle: PurchaseLifecycle;
}

export function scoreOpportunities(
  input: OpportunityEngineInput,
): OpportunityQueue {
  const stateById = new Map(
    input.lifecycle.subjects.map((s) => [s.id, s.state] as const),
  );

  const queue: OpportunityItem[] = input.dashboard.priority.map((rec) => {
    const lifecycleState: PurchaseLifecycleState =
      stateById.get(rec.id) ?? "wishlist";
    const lifecycleUrgency = LIFECYCLE_URGENCY[lifecycleState];
    const needScore = rec.scores.need;
    const fromPriority = rec.scores.priority;

    const opportunityScore = clamp100(
      fromPriority * OPPORTUNITY_WEIGHTS.priority +
        needScore * OPPORTUNITY_WEIGHTS.need +
        lifecycleUrgency * OPPORTUNITY_WEIGHTS.lifecycle,
    );

    const reasons: string[] = [];
    if (fromPriority >= 70) reasons.push("HIGH_018_PRIORITY");
    if (needScore >= 70) reasons.push("NEED_HIGH");
    if (lifecycleState === "analyzed") reasons.push("ANALYZED_READY");
    if (lifecycleState === "wishlist") reasons.push("STILL_ON_WISHLIST");
    if (rec.analysis.decision === "buy") reasons.push("BUY_VERDICT");
    if (rec.analysis.decision === "skip") reasons.push("SKIP_VERDICT");
    if (reasons.length === 0) reasons.push("BASELINE");

    return {
      id: rec.id,
      name: rec.item.name,
      opportunityScore,
      reasons,
      fromPriority,
      lifecycleState,
      needScore,
      lifecycleUrgency,
    };
  });

  return queue.sort(
    (a, b) =>
      b.opportunityScore - a.opportunityScore ||
      b.fromPriority - a.fromPriority ||
      a.name.localeCompare(b.name),
  );
}
