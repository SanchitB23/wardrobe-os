/**
 * Trip templates (RFC-017) — reusable starting points. `expandTemplate` is a
 * pure function of the template + a start date; it never touches I/O or the
 * wall clock. Templates produce a draft `TripSpec`; the engine still plans.
 */

import type { TripEvent } from "@/domain/lifestyle";
import { addDays } from "@/domain/trips/dates";
import type { TripSpec } from "@/domain/trips/types";

export type TripTemplateId = "weekend_city" | "week_beach" | "business_3day";

export interface TripTemplate {
  id: TripTemplateId;
  name: string;
  description: string;
  /** Inclusive trip length in days. */
  durationDays: number;
  travelStyle: TripSpec["travelStyle"];
  planningStrategy: TripSpec["planningStrategy"];
  laundryAvailable: boolean;
  luggageKind: TripSpec["luggage"]["kind"];
  /** Events positioned by day index (0-based) from the start date. */
  events: { dayOffset: number; occasion: string; formalityHint?: string | null }[];
}

export const TRIP_TEMPLATES: TripTemplate[] = [
  {
    id: "weekend_city",
    name: "Weekend city break",
    description: "Two nights, carry-on, smart-casual with one evening out.",
    durationDays: 3,
    travelStyle: "minimal",
    planningStrategy: "minimal",
    laundryAvailable: false,
    luggageKind: "carry_on",
    events: [{ dayOffset: 1, occasion: "Dinner out", formalityHint: "smart casual" }],
  },
  {
    id: "week_beach",
    name: "Week-long beach",
    description: "Seven days, checked bag, relaxed — laundry available mid-trip.",
    durationDays: 7,
    travelStyle: "standard",
    planningStrategy: "balanced",
    laundryAvailable: true,
    luggageKind: "checked",
    events: [],
  },
  {
    id: "business_3day",
    name: "Business 3-day",
    description: "Three days, carry-on, business-formal meetings with laundry.",
    durationDays: 3,
    travelStyle: "minimal",
    planningStrategy: "business",
    laundryAvailable: true,
    luggageKind: "carry_on",
    events: [
      { dayOffset: 0, occasion: "Meetings", formalityHint: "business formal" },
      { dayOffset: 1, occasion: "Meetings", formalityHint: "business formal" },
    ],
  },
];

export function getTemplate(id: string): TripTemplate | null {
  return TRIP_TEMPLATES.find((t) => t.id === id) ?? null;
}

/**
 * Expand a template into a draft `TripSpec` anchored at `startDate`. Returns
 * null for an unknown template id. Pure and deterministic.
 */
export function expandTemplate(
  id: string,
  opts: { startDate: string; destination?: string | null },
): TripSpec | null {
  const template = getTemplate(id);
  if (!template) return null;

  const events: TripEvent[] = template.events.map((e) => ({
    date: addDays(opts.startDate, e.dayOffset),
    occasion: e.occasion,
    formalityHint: e.formalityHint ?? null,
  }));

  return {
    name: template.name,
    destination: opts.destination ?? null,
    startDate: opts.startDate,
    endDate: addDays(opts.startDate, template.durationDays - 1),
    cities: [],
    events,
    travelStyle: template.travelStyle,
    planningStrategy: template.planningStrategy,
    laundry: { available: template.laundryAvailable },
    luggage: { kind: template.luggageKind, maxItems: null },
    notes: null,
  };
}
