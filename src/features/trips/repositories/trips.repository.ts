/**
 * Trips repository (RFC-017) — the only code that touches the `trips`,
 * `trip_cities`, `trip_events`, and `trip_packing_progress` tables. Reads/writes
 * via the Supabase anon client (anon RLS). No domain or planning logic here; it
 * maps rows ⇄ the pure `TripSpec` shape. Child tables are fetched separately and
 * joined in code (no typed nested selects).
 */

import { createClient } from "@/lib/supabase/client";
import { toError } from "@/shared/utils/data-result";
import type {
  LuggageConstraint,
  PlanningStrategy,
  TravelStyle,
  TripEvent,
} from "@/domain/lifestyle";
import type { TripCityLeg } from "@/domain/trips";
import type { SaveTripInput, TripRecord } from "@/features/trips/types";

type Result<T> = { data: T | null; error: Error | null };

type TripRow = {
  id: string;
  name: string | null;
  destination: string | null;
  start_date: string;
  end_date: string;
  travel_style: string;
  planning_strategy: string;
  laundry_available: boolean;
  luggage_kind: string;
  luggage_max_items: number | null;
  notes: string | null;
  is_template: boolean;
  created_at: string;
  updated_at: string;
};
type CityRow = {
  trip_id: string;
  city: string;
  start_date: string;
  end_date: string;
  sort_order: number;
};
type EventRow = {
  trip_id: string;
  event_date: string;
  occasion: string;
  formality_hint: string | null;
};

function toRecord(row: TripRow, cities: CityRow[], events: EventRow[]): TripRecord {
  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    cities: cities
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map<TripCityLeg>((c) => ({
        city: c.city,
        startDate: c.start_date,
        endDate: c.end_date,
        sortOrder: c.sort_order,
      })),
    events: events.map<TripEvent>((e) => ({
      date: e.event_date,
      occasion: e.occasion,
      formalityHint: e.formality_hint,
    })),
    travelStyle: row.travel_style as TravelStyle,
    planningStrategy: row.planning_strategy as PlanningStrategy,
    laundry: { available: row.laundry_available },
    luggage: { kind: row.luggage_kind as LuggageConstraint["kind"], maxItems: row.luggage_max_items },
    notes: row.notes,
    isTemplate: row.is_template,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function tripToRow(input: SaveTripInput) {
  return {
    name: input.name,
    destination: input.destination,
    start_date: input.startDate,
    end_date: input.endDate,
    travel_style: input.travelStyle,
    planning_strategy: input.planningStrategy,
    laundry_available: input.laundry.available,
    luggage_kind: input.luggage.kind,
    luggage_max_items: input.luggage.maxItems ?? null,
    notes: input.notes,
    is_template: input.isTemplate ?? false,
  };
}

async function loadChildren(tripIds: string[]) {
  const supabase = createClient();
  if (tripIds.length === 0)
    return { cities: [] as CityRow[], events: [] as EventRow[], error: null as Error | null };
  const [citiesRes, eventsRes] = await Promise.all([
    supabase.from("trip_cities").select("trip_id, city, start_date, end_date, sort_order").in("trip_id", tripIds),
    supabase.from("trip_events").select("trip_id, event_date, occasion, formality_hint").in("trip_id", tripIds),
  ]);
  // Surface child-read failures instead of pretending the trip has no
  // events/cities — a silently empty edit form would wipe them on save.
  const error = citiesRes.error ?? eventsRes.error;
  return {
    cities: (citiesRes.data ?? []) as CityRow[],
    events: (eventsRes.data ?? []) as EventRow[],
    error: error ? toError(error.message) : null,
  };
}

/** All non-template trips, most-recent departure first. */
export async function selectTrips(): Promise<Result<TripRecord[]>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("is_template", false)
    .order("start_date", { ascending: false });
  if (error) return { data: null, error: toError(error.message) };

  const rows = (data ?? []) as TripRow[];
  const children = await loadChildren(rows.map((r) => r.id));
  if (children.error) return { data: null, error: children.error };
  const { cities, events } = children;
  const byTrip = <T extends { trip_id: string }>(list: T[], id: string) =>
    list.filter((x) => x.trip_id === id);
  return {
    data: rows.map((r) => toRecord(r, byTrip(cities, r.id), byTrip(events, r.id))),
    error: null,
  };
}

export async function selectTrip(id: string): Promise<Result<TripRecord>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("trips").select("*").eq("id", id).maybeSingle();
  if (error) return { data: null, error: toError(error.message) };
  if (!data) return { data: null, error: toError("Trip not found.") };

  const row = data as TripRow;
  const children = await loadChildren([id]);
  if (children.error) return { data: null, error: children.error };
  return { data: toRecord(row, children.cities, children.events), error: null };
}

async function replaceChildren(tripId: string, input: SaveTripInput): Promise<Error | null> {
  const supabase = createClient();
  await Promise.all([
    supabase.from("trip_cities").delete().eq("trip_id", tripId),
    supabase.from("trip_events").delete().eq("trip_id", tripId),
  ]);

  if (input.cities.length > 0) {
    const { error } = await supabase.from("trip_cities").insert(
      input.cities.map((c) => ({
        trip_id: tripId,
        city: c.city,
        start_date: c.startDate,
        end_date: c.endDate,
        sort_order: c.sortOrder,
      })),
    );
    if (error) return toError(error.message);
  }
  if (input.events.length > 0) {
    const { error } = await supabase.from("trip_events").insert(
      input.events.map((e) => ({
        trip_id: tripId,
        event_date: e.date,
        occasion: e.occasion,
        formality_hint: e.formalityHint ?? null,
      })),
    );
    if (error) return toError(error.message);
  }
  return null;
}

export async function insertTrip(input: SaveTripInput): Promise<Result<TripRecord>> {
  const supabase = createClient();
  const { data, error } = await supabase.from("trips").insert(tripToRow(input)).select("id").single();
  if (error || !data) return { data: null, error: toError(error?.message ?? "Failed to save trip.") };

  const childErr = await replaceChildren(data.id, input);
  if (childErr) {
    // Compensate: don't leave a half-created trip (parent row without its
    // events/cities) behind when a child insert fails.
    await supabase.from("trips").delete().eq("id", data.id);
    return { data: null, error: childErr };
  }
  return selectTrip(data.id);
}

export async function updateTrip(id: string, input: SaveTripInput): Promise<Result<TripRecord>> {
  const supabase = createClient();
  const { error } = await supabase
    .from("trips")
    .update({ ...tripToRow(input), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { data: null, error: toError(error.message) };

  const childErr = await replaceChildren(id, input);
  if (childErr) return { data: null, error: childErr };
  return selectTrip(id);
}

export async function deleteTripRow(id: string): Promise<Result<void>> {
  const supabase = createClient();
  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) return { data: null, error: toError(error.message) };
  return { data: undefined as unknown as void, error: null };
}

/** Ids of items marked packed for a trip. */
export async function selectPackedItemIds(tripId: string): Promise<Result<string[]>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("trip_packing_progress")
    .select("item_id, packed")
    .eq("trip_id", tripId)
    .eq("packed", true);
  if (error) return { data: null, error: toError(error.message) };
  return { data: (data ?? []).map((r) => r.item_id), error: null };
}

export async function upsertPackingProgress(
  tripId: string,
  itemId: string,
  packed: boolean,
): Promise<Result<void>> {
  const supabase = createClient();
  const { error } = await supabase
    .from("trip_packing_progress")
    .upsert(
      { trip_id: tripId, item_id: itemId, packed, updated_at: new Date().toISOString() },
      { onConflict: "trip_id,item_id" },
    );
  if (error) return { data: null, error: toError(error.message) };
  return { data: undefined as unknown as void, error: null };
}
