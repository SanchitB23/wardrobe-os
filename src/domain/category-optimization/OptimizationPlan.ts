/**
 * Category Optimization (RFC-015A) — Optimization Plan assignment (pure).
 */

import {
  HEALTH_IMPROVEMENT_PER_RETIRE,
  ROI_IMPROVEMENT_PER_ROTATE,
} from "@/domain/category-optimization/CategoryOptimizationConstants";
import {
  isHighValue,
  isLowValue,
} from "@/domain/category-optimization/CategoryOptimizationScoring";
import type {
  CategoryAnalysis,
  CategoryOptimizationReasonCode,
  ItemComparison,
  OptimizationDecision,
  OptimizationPlan,
  OptimizationPlanItem,
  ReplacementOpportunity,
} from "@/domain/category-optimization/types";

function decisionReason(
  decision: OptimizationDecision,
  row: ItemComparison,
  focusItemId?: string,
): { reason: string; reasonCodes: CategoryOptimizationReasonCode[] } {
  const codes: CategoryOptimizationReasonCode[] = [];
  if (focusItemId && row.itemId === focusItemId) codes.push("focus_item");

  switch (decision) {
    case "keep":
      codes.push("high_value");
      return {
        reason: `${row.label} is a high-value core piece — keep it.`,
        reasonCodes: codes,
      };
    case "protect":
      codes.push("over_worn", "high_value");
      return {
        reason: `${row.label} is valuable but over-worn — protect and rotate peers.`,
        reasonCodes: codes,
      };
    case "rotate":
      if (row.wearCount === 0) codes.push("never_worn");
      else codes.push("under_worn");
      return {
        reason: `${row.label} should get more outfit turns.`,
        reasonCodes: codes,
      };
    case "retire":
      codes.push("low_value", "duplicate_cluster");
      return {
        reason: `${row.label} is a retire candidate — confirm in inventory before changing status.`,
        reasonCodes: codes,
      };
    case "ignore":
      codes.push("protected_item");
      return {
        reason: `${row.label} is protected / out of scope for this plan.`,
        reasonCodes: codes,
      };
    default: {
      const _exhaustive: never = decision;
      return _exhaustive;
    }
  }
}

/**
 * Assign Keep / Protect / Rotate / Retire / Ignore.
 * Excess over ideal → half retire (floor), half rotate — conservative.
 * Does not mutate inventory.
 */
export function buildOptimizationPlan(input: {
  analysis: CategoryAnalysis;
  comparisons: ItemComparison[];
  replacementOpportunities: ReplacementOpportunity[];
  generatedAt: string;
  focusItemId?: string;
}): OptimizationPlan {
  const { analysis, comparisons, replacementOpportunities, generatedAt } =
    input;
  const focusItemId = input.focusItemId;

  const assignments = new Map<string, OptimizationDecision>();

  const ignored = comparisons.filter((c) => c.protected);
  for (const row of ignored) assignments.set(row.itemId, "ignore");

  const actionable = comparisons.filter((c) => !c.protected);

  // Protect: high-value + over-worn (counts toward ideal capacity).
  const protectCandidates = actionable.filter((c) => c.overWorn);
  for (const row of protectCandidates) {
    assignments.set(row.itemId, "protect");
  }

  const remaining = actionable.filter((c) => !assignments.has(c.itemId));
  // Already sorted by composite desc from compareCategoryItems.
  const keepSlots = Math.max(
    0,
    analysis.idealCount - protectCandidates.length,
  );
  const keep = remaining.slice(0, keepSlots);
  for (const row of keep) assignments.set(row.itemId, "keep");

  const rest = remaining.slice(keepSlots);
  const actionableCount = actionable.length;
  const excess = Math.max(0, actionableCount - analysis.idealCount);
  const retireCount = Math.min(rest.length, Math.floor(excess / 2));

  // Retire lowest composite among rest (end of list).
  const retire = rest.slice(rest.length - retireCount);
  const retireIds = new Set(retire.map((r) => r.itemId));
  for (const row of retire) assignments.set(row.itemId, "retire");

  for (const row of rest) {
    if (retireIds.has(row.itemId)) continue;
    // Low-value never-worn leftovers still rotate unless already retired.
    if (isLowValue(row.compositeValue) && row.wearCount === 0 && excess > 0) {
      // Prefer retire if we still have retire budget — already handled.
    }
    assignments.set(row.itemId, "rotate");
  }

  // Focus item: if worn-out focus was going to Keep, bump reason via focus code;
  // if low-value, prefer retire only when excess allows (already assigned).
  if (focusItemId && !assignments.has(focusItemId)) {
    const focus = comparisons.find((c) => c.itemId === focusItemId);
    if (focus) assignments.set(focusItemId, "rotate");
  }

  const items: OptimizationPlanItem[] = comparisons.map((row) => {
    const decision = assignments.get(row.itemId) ?? "ignore";
    const { reason, reasonCodes } = decisionReason(
      decision,
      row,
      focusItemId,
    );
    // Annotate keep with high_value only when truly high.
    if (decision === "keep" && !isHighValue(row.compositeValue)) {
      return {
        itemId: row.itemId,
        label: row.label,
        decision,
        reason: `${row.label} stays in the active core for now.`,
        reasonCodes: reasonCodes.filter((c) => c !== "high_value"),
      };
    }
    return {
      itemId: row.itemId,
      label: row.label,
      decision,
      reason,
      reasonCodes,
    };
  });

  // Stable order: decision priority then composite.
  const decisionOrder: Record<OptimizationDecision, number> = {
    keep: 0,
    protect: 1,
    rotate: 2,
    retire: 3,
    ignore: 4,
  };
  items.sort((a, b) => {
    const byDec = decisionOrder[a.decision] - decisionOrder[b.decision];
    if (byDec !== 0) return byDec;
    return a.label.localeCompare(b.label) || a.itemId.localeCompare(b.itemId);
  });

  const summary = {
    keep: items.filter((i) => i.decision === "keep").length,
    protect: items.filter((i) => i.decision === "protect").length,
    rotate: items.filter((i) => i.decision === "rotate").length,
    retire: items.filter((i) => i.decision === "retire").length,
    ignore: items.filter((i) => i.decision === "ignore").length,
  };

  const estimatedHealthImprovement =
    summary.retire > 0
      ? summary.retire * HEALTH_IMPROVEMENT_PER_RETIRE
      : summary.rotate > 0
        ? Math.round(summary.rotate * 1.5)
        : null;

  const estimatedRoiImprovement =
    summary.rotate > 0
      ? summary.rotate * ROI_IMPROVEMENT_PER_ROTATE
      : summary.retire > 0
        ? summary.retire * 2
        : null;

  return {
    categoryKey: analysis.categoryKey,
    summary,
    items,
    replacementOpportunities,
    estimatedHealthImprovement,
    estimatedRoiImprovement,
    generatedAt,
  };
}
