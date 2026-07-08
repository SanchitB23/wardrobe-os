/**
 * ShoppingPlanner (RFC-006) — finds needs the wardrobe can't cover for the trip
 * and turns each into a Buy vs Skip suggestion. The buy/skip evaluation is
 * INJECTED (the engine routes it through the Acquisition capability of the
 * Intelligence Orchestrator) — this planner never calls an engine directly. Pure.
 */

import type { BuyVsSkipAnalysis } from "@/domain/acquisition";
import type {
  DailyOutfit,
  MissingItem,
  ProspectiveNeed,
  ShoppingPlan,
  TripDay,
} from "@/domain/lifestyle/types";

/** Detect trip needs the wardrobe couldn't satisfy (uncovered days), merged by need. */
export function detectMissingItems(
  days: TripDay[],
  dailyOutfits: DailyOutfit[],
): MissingItem[] {
  const byNeed = new Map<string, MissingItem>();
  for (const outfit of dailyOutfits) {
    if (!outfit.uncovered) continue;
    const day = days.find((d) => d.date === outfit.date);
    const need = `${outfit.occasion} outfit`;
    const existing = byNeed.get(need);
    if (existing) {
      existing.forDates.push(outfit.date);
    } else {
      byNeed.set(need, {
        need,
        forDates: [outfit.date],
        reason: `No wardrobe outfit for ${outfit.occasion}${
          day ? ` in ${day.weather.condition} weather` : ""
        }.`,
      });
    }
  }
  return [...byNeed.values()].sort((a, b) => a.need.localeCompare(b.need));
}

/**
 * Build the shopping plan by evaluating each missing need. `evaluate` is
 * supplied by the engine and routes through the Acquisition capability; it
 * returns null when no verdict could be produced.
 */
export function buildShoppingPlan(
  missing: MissingItem[],
  evaluate: (need: ProspectiveNeed) => BuyVsSkipAnalysis | null,
): ShoppingPlan {
  const shoppingSuggestions: ShoppingPlan["shoppingSuggestions"] = [];
  for (const item of missing) {
    const analysis = evaluate({ need: item.need, forDates: item.forDates });
    if (analysis) shoppingSuggestions.push({ need: item.need, analysis });
  }
  return { missingItems: missing, shoppingSuggestions };
}
