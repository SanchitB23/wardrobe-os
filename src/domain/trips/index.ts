/**
 * Trip Planner domain (RFC-017) — pure helpers that make a trip *reusable* and
 * *projectable*: templates, cloning, multi-city day resolution, the packing
 * checklist, and the timeline. The Lifestyle Engine (RFC-006) still does the
 * planning; nothing here scores, ranks, or decides.
 */

export { parseUtc, addDays, daysBetween, durationDays } from "@/domain/trips/dates";
export {
  TRIP_TEMPLATES,
  getTemplate,
  expandTemplate,
  type TripTemplate,
  type TripTemplateId,
} from "@/domain/trips/templates";
export { cloneTripSpec } from "@/domain/trips/clone";
export { cityForDate } from "@/domain/trips/multi-city";
export { buildPackingChecklist } from "@/domain/trips/packing";
export { buildTimeline } from "@/domain/trips/timeline";
export type {
  TripCityLeg,
  TripSpec,
  TripTimelineDay,
  PackingChecklistEntry,
  PackingChecklist,
} from "@/domain/trips/types";
