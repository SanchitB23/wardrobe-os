/**
 * LaundryPlanner (RFC-006) — decides whether a trip outlasts the packed clothes
 * and, if laundry is available, schedules wash points and records re-wears. Pure.
 */

import { coverageByItem } from "@/domain/lifestyle/CapsulePlanner";
import type { StrategyProfile } from "@/domain/lifestyle/PlanningStrategy";
import type { DailyOutfit, LaundrySchedule, Trip } from "@/domain/lifestyle/types";

export function planLaundry(
  trip: Trip,
  dailyOutfits: DailyOutfit[],
  packedCount: number,
  strategy: StrategyProfile,
): LaundrySchedule {
  const duration = dailyOutfits.length;

  // Re-wears: any item worn on more than one day.
  const reWears = [...coverageByItem(dailyOutfits).entries()]
    .filter(([, dates]) => dates.length > 1)
    .map(([itemId, dates]) => ({ itemId, dates: [...dates].sort() }))
    .sort((a, b) => a.itemId.localeCompare(b.itemId));

  // Clean-days ≈ how many wearing-days the packed clothes last before a wash.
  const cleanDays = Math.max(1, Math.floor(packedCount / Math.max(0.5, strategy.itemsPerDay)));
  const needed = duration > cleanDays;

  const washOn: string[] = [];
  if (needed && trip.laundry.available) {
    const turnaround = Math.max(1, trip.laundry.turnaroundDays ?? 1);
    // Schedule a wash every `cleanDays`, allowing `turnaround` before re-wearing.
    for (let i = cleanDays; i < duration; i += cleanDays + turnaround - 1) {
      const day = dailyOutfits[i];
      if (day) washOn.push(day.date);
    }
  }

  return { needed, washOn, reWears };
}
