/**
 * NeedEvolution (RFC-018B) — pure.
 * Builds a Need Timeline from wardrobe health gaps + purchase events.
 * Composes existing Need scores (gap priority → 0–100); does not reimplement Health.
 */

import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import {
  NEED_BASELINE,
  NEED_BY_GAP_PRIORITY,
} from "@/domain/shopping/constants";
import type { NeedTimeline, NeedTimelinePoint } from "@/domain/shopping/v2/types";

export interface NeedEvolutionPurchaseEvent {
  date: string;
  category: string | null;
  name: string;
}

export interface NeedEvolutionInput {
  health: WardrobeHealth | null;
  purchases: NeedEvolutionPurchaseEvent[];
  /** Injected clock for current snapshot points. */
  generatedAt: string;
}

function gapNeedScore(priority: "high" | "medium" | "low"): number {
  return NEED_BY_GAP_PRIORITY[priority];
}

/**
 * Rough residual need after a category receives a purchase: step down one band.
 */
function residualAfterPurchase(current: number): number {
  if (current >= NEED_BY_GAP_PRIORITY.high) return NEED_BY_GAP_PRIORITY.medium;
  if (current >= NEED_BY_GAP_PRIORITY.medium) return NEED_BY_GAP_PRIORITY.low;
  if (current >= NEED_BY_GAP_PRIORITY.low) return NEED_BASELINE;
  return NEED_BASELINE;
}

export function buildNeedTimeline(input: NeedEvolutionInput): NeedTimeline {
  const points: NeedTimelinePoint[] = [];
  const categoryNeed = new Map<string, number>();

  if (input.health) {
    for (const gap of input.health.gaps) {
      const key = gap.label.trim().toLowerCase() || "unknown";
      const score = gapNeedScore(gap.priority);
      categoryNeed.set(key, Math.max(categoryNeed.get(key) ?? 0, score));
      points.push({
        date: input.generatedAt,
        category: gap.label,
        needScore: score,
      });
    }
  }

  const purchases = [...input.purchases]
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const purchase of purchases) {
    const key = (purchase.category ?? purchase.name).trim().toLowerCase();
    if (!key) continue;
    const before = categoryNeed.get(key) ?? NEED_BY_GAP_PRIORITY.medium;
    const after = residualAfterPurchase(before);
    categoryNeed.set(key, after);
    points.push({
      date: purchase.date,
      category: purchase.category,
      needScore: after,
    });
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return { points };
}
