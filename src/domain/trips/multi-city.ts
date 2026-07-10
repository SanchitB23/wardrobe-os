/**
 * Multi-city helpers (RFC-017) — pure. A trip may carry ordered city legs; the
 * planner runs the Lifestyle Engine over the merged horizon (each day tagged
 * with its city's forecast). These helpers resolve which leg owns a given day.
 */

import { parseUtc } from "@/domain/trips/dates";
import type { TripCityLeg } from "@/domain/trips/types";

/**
 * The city whose leg covers `date`, or null when there are no legs (single-
 * destination) or the date falls outside every leg. Legs are matched in
 * `sortOrder`; the first covering leg wins on overlap (e.g. a travel day).
 */
export function cityForDate(cities: TripCityLeg[], date: string): string | null {
  const t = parseUtc(date);
  if (Number.isNaN(t)) return null;

  const legs = [...cities].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const leg of legs) {
    const start = parseUtc(leg.startDate);
    const end = parseUtc(leg.endDate);
    if (!Number.isNaN(start) && !Number.isNaN(end) && t >= start && t <= end) {
      return leg.city;
    }
  }
  return null;
}
