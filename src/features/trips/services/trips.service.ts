/**
 * TripsService (RFC-017) — orchestrates trip persistence + the pure Lifestyle
 * Engine (RFC-006, reused via `planTrip`). It owns the *trip*; the engine
 * derives the *plan*. No planning/scoring logic lives here — multi-city just
 * merges per-leg forecasts (via the Weather Runtime) into one forecast that the
 * engine plans over. Returns `{ data, error }`.
 */

import {
  eachDateInclusive,
  fallbackDay,
  type Trip,
  type WeatherForecast,
  type WeatherForecastDay,
} from "@/domain/lifestyle";
import {
  buildPackingChecklist,
  buildTimeline,
  cloneTripSpec,
  expandTemplate,
  TRIP_TEMPLATES,
  type TripTemplate,
} from "@/domain/trips";
import { planTrip } from "@/features/lifestyle/services/LifestyleService";
import {
  deleteTripRow,
  insertTrip,
  selectPackedItemIds,
  selectTrip,
  selectTrips,
  updateTrip as updateTripRow,
  upsertPackingProgress,
} from "@/features/trips/repositories/trips.repository";
import type { SaveTripInput, TripPlanView, TripRecord } from "@/features/trips/types";
import { manualForecast, weatherRuntime } from "@/runtime/weather";
import { toError } from "@/shared/utils/data-result";

type Result<T> = { data: T | null; error: Error | null };

/** Seasonal fallback covering the whole horizon (mirrors LifestyleService). */
function fallbackForecast(startDate: string, endDate: string): WeatherForecast {
  return manualForecast(eachDateInclusive(startDate, endDate).map((date) => fallbackDay(date)));
}

/**
 * Open-Meteo serves daily forecasts ~16 days out. Beyond that, "Refresh
 * weather" cannot produce live data — the UI uses this to explain the
 * seasonal estimate instead of dangling a refresh that never works.
 */
const FORECAST_HORIZON_DAYS = 16;

function beyondForecastHorizon(startDate: string, now: Date): boolean {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  if (Number.isNaN(start)) return false;
  return start - now.getTime() > FORECAST_HORIZON_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Resolve the forecast for a trip. Multi-city trips fetch one forecast per leg
 * (each cached by the Weather Runtime) and concatenate the days; single-
 * destination trips fetch once. Never throws — degrades to a neutral forecast.
 */
async function resolveTripForecast(trip: TripRecord): Promise<WeatherForecast> {
  if (trip.cities.length >= 2) {
    const legs = await Promise.all(
      trip.cities.map(async (leg) => {
        const { data } = await weatherRuntime.getForecast({
          location: leg.city,
          startDate: leg.startDate,
          endDate: leg.endDate,
        });
        return data && data.days.length > 0 ? data : null;
      }),
    );
    const days: WeatherForecastDay[] = [];
    let anyLive = false;
    for (const forecast of legs) {
      if (!forecast) continue;
      days.push(...forecast.days);
      if (forecast.source === "forecast") anyLive = true;
    }
    if (days.length > 0) {
      days.sort((a, b) => a.date.localeCompare(b.date));
      return { days, source: anyLive ? "forecast" : "manual" };
    }
    // No leg resolved — fall through to fallback below.
  }

  const location = trip.destination ?? trip.cities[0]?.city ?? "";
  const { data } = await weatherRuntime.getForecast({
    location,
    startDate: trip.startDate,
    endDate: trip.endDate,
  });
  return data && data.days.length > 0 ? data : fallbackForecast(trip.startDate, trip.endDate);
}

/** Project a persisted trip into the Lifestyle Engine's `Trip` input. */
function toLifestyleTrip(trip: TripRecord): Trip {
  return {
    destination: trip.destination ?? trip.cities[0]?.city ?? "Trip",
    startDate: trip.startDate,
    endDate: trip.endDate,
    events: trip.events,
    travelStyle: trip.travelStyle,
    laundry: trip.laundry,
    luggage: trip.luggage,
  };
}

// --- CRUD ------------------------------------------------------------------

export function listTrips(): Promise<Result<TripRecord[]>> {
  return selectTrips();
}

export function getTrip(id: string): Promise<Result<TripRecord>> {
  return selectTrip(id);
}

export function createTrip(input: SaveTripInput): Promise<Result<TripRecord>> {
  return insertTrip(input);
}

export function updateTrip(id: string, input: SaveTripInput): Promise<Result<TripRecord>> {
  return updateTripRow(id, input);
}

export function deleteTrip(id: string): Promise<Result<void>> {
  return deleteTripRow(id);
}

/** Built-in templates (pure). Save-any-trip-as-template is a future extension. */
export function listTemplates(): TripTemplate[] {
  return TRIP_TEMPLATES;
}

/** Instantiate a built-in template into a saved (draft) trip. */
export async function createTripFromTemplate(
  templateId: string,
  opts: { startDate: string; destination?: string | null },
): Promise<Result<TripRecord>> {
  const spec = expandTemplate(templateId, opts);
  if (!spec) return { data: null, error: toError("Unknown trip template.") };
  return insertTrip(spec);
}

/** Clone an existing trip (dates shifted to `newStartDate`, offsets preserved). */
export async function cloneTrip(id: string, newStartDate: string): Promise<Result<TripRecord>> {
  const source = await selectTrip(id);
  if (source.error || !source.data) {
    return { data: null, error: source.error ?? toError("Trip not found.") };
  }
  return insertTrip({ ...cloneTripSpec(source.data, newStartDate), isTemplate: false });
}

// --- Planning + packing ----------------------------------------------------

/**
 * Build the derived Trip Plan view for a saved trip. Re-running this (the UI's
 * "Refresh weather" invalidates the query) re-plans against the latest forecast
 * the Weather Runtime holds (fresh once its 60-min cache expires). The plan is
 * deterministic given the resolved forecast + wardrobe.
 */
export async function getTripPlan(id: string): Promise<Result<TripPlanView>> {
  const tripRes = await selectTrip(id);
  if (tripRes.error || !tripRes.data) {
    return { data: null, error: tripRes.error ?? toError("Trip not found.") };
  }
  const trip = tripRes.data;

  const [forecast, packedRes] = await Promise.all([
    resolveTripForecast(trip),
    selectPackedItemIds(id),
  ]);

  const planRes = await planTrip({
    trip: toLifestyleTrip(trip),
    strategy: trip.planningStrategy,
    weather: { mode: "forecast", forecast },
  });
  if (planRes.error || !planRes.data) {
    return { data: null, error: planRes.error ?? toError("Couldn't build the plan.") };
  }

  const { plan, itemNames } = planRes.data;
  const nameOf = (itemId: string) => itemNames[itemId] ?? itemId;
  const packedItemIds = packedRes.data ?? [];

  return {
    data: {
      trip,
      plan,
      itemNames,
      timeline: buildTimeline(plan.tripPlan.days, plan.tripPlan.dailyOutfits, trip.cities),
      packingChecklist: buildPackingChecklist(plan.packingPlan.packingList.bySlot, packedItemIds, nameOf),
      weather: {
        source: plan.metadata.weatherSource,
        refreshedAt: plan.metadata.generatedAt,
        beyondForecastHorizon: beyondForecastHorizon(trip.startDate, new Date()),
      },
    },
    error: null,
  };
}

export function setPackingProgress(
  tripId: string,
  itemId: string,
  packed: boolean,
): Promise<Result<void>> {
  return upsertPackingProgress(tripId, itemId, packed);
}
