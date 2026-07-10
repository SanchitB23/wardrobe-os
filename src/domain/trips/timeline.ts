/**
 * Timeline / outfit-calendar projection (RFC-017) — pure. Maps the Lifestyle
 * Engine's per-day plan (`tripPlan.days` + `tripPlan.dailyOutfits`) into a
 * day-by-day timeline, tagging each day with its city (multi-city). Adds no
 * scoring — it only re-shapes the deterministic plan for the calendar view.
 */

import type { DailyOutfit, TripDay } from "@/domain/lifestyle";
import { cityForDate } from "@/domain/trips/multi-city";
import type { TripCityLeg, TripTimelineDay } from "@/domain/trips/types";

export function buildTimeline(
  days: TripDay[],
  dailyOutfits: DailyOutfit[],
  cities: TripCityLeg[] = [],
): TripTimelineDay[] {
  const outfitByDate = new Map(dailyOutfits.map((o) => [o.date, o] as const));

  return days.map((day) => {
    const outfit: DailyOutfit | undefined = outfitByDate.get(day.date);
    return {
      date: day.date,
      city: cityForDate(cities, day.date),
      occasion: day.occasion,
      weather: { condition: day.weather.condition, season: day.weather.season },
      outfitItemIds: outfit?.itemIds ?? [],
      score: outfit?.score ?? 0,
      uncovered: outfit?.uncovered ?? true,
    };
  });
}
