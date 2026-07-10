/**
 * Trip cloning (RFC-017) — shift a saved trip to a new start date, preserving
 * its duration and the relative offsets of city legs and events. Pure.
 */

import { addDays, daysBetween } from "@/domain/trips/dates";
import type { TripSpec } from "@/domain/trips/types";

/**
 * Clone a trip spec anchored at `newStartDate`. Every date (end, city legs,
 * events) is shifted by the same delta, so the shape of the itinerary is kept
 * intact. The name gets a "(copy)" suffix; templates never carry over as
 * templates (the caller decides `is_template`).
 */
export function cloneTripSpec(spec: TripSpec, newStartDate: string): TripSpec {
  const delta = daysBetween(spec.startDate, newStartDate);
  const shift = (date: string) => addDays(date, delta);

  return {
    ...spec,
    name: spec.name ? `${spec.name} (copy)` : null,
    startDate: newStartDate,
    endDate: shift(spec.endDate),
    cities: spec.cities.map((c) => ({
      ...c,
      startDate: shift(c.startDate),
      endDate: shift(c.endDate),
    })),
    events: spec.events.map((e) => ({ ...e, date: shift(e.date) })),
  };
}
