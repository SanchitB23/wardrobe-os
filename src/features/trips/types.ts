/**
 * Trip Planner feature types (RFC-017). `TripRecord` is the persisted trip
 * (the pure `TripSpec` + identity/timestamps); `TripPlanView` is the derived
 * view = the deterministic `LifestylePlan` (RFC-006) plus the pure projections
 * (timeline + packing checklist) and weather provenance.
 */

import type { LifestylePlan, WeatherSource } from "@/domain/lifestyle";
import type { PackingChecklist, TripSpec, TripTimelineDay } from "@/domain/trips";

/** A persisted trip. A template is a `TripRecord` with `isTemplate: true`. */
export interface TripRecord extends TripSpec {
  id: string;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Create/update payload — the editable spec, with an optional id for updates. */
export type SaveTripInput = TripSpec & { id?: string; isTemplate?: boolean };

/** Lightweight list row with a packing-progress summary. */
export interface TripListItem {
  trip: TripRecord;
  packing: { packed: number; total: number };
}

/** The derived Trip Plan — recomputed on demand; never persisted. */
export interface TripPlanView {
  trip: TripRecord;
  plan: LifestylePlan;
  /** id → display name, for rendering outfit / packing item names. */
  itemNames: Record<string, string>;
  timeline: TripTimelineDay[];
  packingChecklist: PackingChecklist;
  weather: {
    source: WeatherSource;
    refreshedAt: string;
    /** True when the trip starts beyond the live-forecast horizon (~16 days) —
     *  refreshing cannot produce live data yet. */
    beyondForecastHorizon: boolean;
  };
}
