/**
 * TripPlanner (RFC-006) — expands a trip's dates into per-day plan units, each
 * with its occasion (from an event, or a default) and its forecast day attached.
 * Pure and deterministic.
 */

import { DEFAULT_OCCASION } from "@/domain/lifestyle/constants";
import { fallbackDay, weatherForDate } from "@/domain/lifestyle/WeatherPlanner";
import type { Trip, TripDay, WeatherForecast } from "@/domain/lifestyle/types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Inclusive list of ISO dates (YYYY-MM-DD) from start → end. Deterministic (UTC). */
export function eachDateInclusive(startDate: string, endDate: string): string[] {
  const start = Date.parse(`${startDate}T00:00:00.000Z`);
  const end = Date.parse(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  const dates: string[] = [];
  for (let t = start; t <= end; t += MS_PER_DAY) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

/** Expand the trip into `TripDay[]` (occasion + forecast per day). */
export function expandTripDays(trip: Trip, forecast: WeatherForecast): TripDay[] {
  return eachDateInclusive(trip.startDate, trip.endDate).map((date) => {
    const event = trip.events.find((e) => e.date === date);
    return {
      date,
      occasion: event?.occasion?.trim() || DEFAULT_OCCASION,
      weather: weatherForDate(forecast, date) ?? fallbackDay(date),
    };
  });
}
