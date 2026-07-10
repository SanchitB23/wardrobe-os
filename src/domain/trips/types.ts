/**
 * Trip Planner domain types (RFC-017) — pure. A trip is *data*; the Lifestyle
 * Engine (RFC-006) is still the planner. These types describe the persistable
 * trip spec and the pure projections (timeline, packing checklist) layered over
 * the deterministic `LifestylePlan`. No React, no Supabase, no I/O.
 */

import type {
  LaundryAvailability,
  LuggageConstraint,
  PlanningStrategy,
  TravelStyle,
  TripEvent,
} from "@/domain/lifestyle";

/** One city leg of a multi-city itinerary (ordered by `sortOrder`). */
export interface TripCityLeg {
  city: string;
  startDate: string;
  endDate: string;
  sortOrder: number;
}

/**
 * The persistable core of a trip — everything the Trip Planner owns. Feeds the
 * Lifestyle Engine unchanged; a single-destination trip has `cities: []`.
 */
export interface TripSpec {
  name: string | null;
  destination: string | null;
  startDate: string;
  endDate: string;
  cities: TripCityLeg[];
  events: TripEvent[];
  travelStyle: TravelStyle;
  planningStrategy: PlanningStrategy;
  laundry: LaundryAvailability;
  luggage: LuggageConstraint;
  notes: string | null;
}

/** One day of the trip timeline / outfit calendar — projected from the plan. */
export interface TripTimelineDay {
  date: string;
  /** City for the day when multi-city, else null. */
  city: string | null;
  occasion: string;
  weather: { condition: string; season: string };
  outfitItemIds: string[];
  score: number;
  uncovered: boolean;
}

/** A single packing-list entry with its persisted packed state merged in. */
export interface PackingChecklistEntry {
  itemId: string;
  label: string;
  packed: boolean;
}

/**
 * The deterministic packing list rendered as a tickable checklist. `packed` is
 * user state layered on top; it never affects the plan.
 */
export interface PackingChecklist {
  bySlot: Record<string, PackingChecklistEntry[]>;
  packed: number;
  total: number;
}
