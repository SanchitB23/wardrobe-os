/**
 * CapsulePlanner (RFC-006) — the minimal item set the daily outfits draw from.
 * Since each day's outfit is already the recommendation engine's top pick, the
 * capsule is the deduplicated union of those items; `coverageByItem` exposes how
 * many days each item pulls double-duty (the reuse the packing/laundry planners
 * and the score consume). Pure and deterministic.
 */

import type { DailyOutfit } from "@/domain/lifestyle/types";

export interface Capsule {
  itemIds: string[];
  itemCount: number;
  dayCount: number;
}

/** Deduplicated, sorted union of every day's outfit items. */
export function planCapsule(dailyOutfits: DailyOutfit[]): Capsule {
  const set = new Set<string>();
  for (const outfit of dailyOutfits) {
    for (const id of outfit.itemIds) set.add(id);
  }
  const itemIds = [...set].sort();
  return { itemIds, itemCount: itemIds.length, dayCount: dailyOutfits.length };
}

/** Map of itemId → the dates it is worn (for reuse + laundry). Deterministic. */
export function coverageByItem(dailyOutfits: DailyOutfit[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const outfit of dailyOutfits) {
    for (const id of outfit.itemIds) {
      const dates = map.get(id) ?? [];
      if (!dates.includes(outfit.date)) dates.push(outfit.date);
      map.set(id, dates);
    }
  }
  return map;
}
