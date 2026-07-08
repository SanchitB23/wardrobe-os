/**
 * Lifestyle domain (RFC-006) — deterministic trip planning that composes the
 * existing engines across a time horizon via the Intelligence Orchestrator.
 * The engine plans; the engines decide; AI only explains.
 */

export { planLifestyle } from "@/domain/lifestyle/LifestyleEngine";
export { expandTripDays, eachDateInclusive } from "@/domain/lifestyle/TripPlanner";
export { planCapsule, coverageByItem, type Capsule } from "@/domain/lifestyle/CapsulePlanner";
export { planPacking, type PackingResult } from "@/domain/lifestyle/PackingPlanner";
export { planLaundry } from "@/domain/lifestyle/LaundryPlanner";
export { detectMissingItems, buildShoppingPlan } from "@/domain/lifestyle/ShoppingPlanner";
export { toWeatherSnapshot, weatherForDate, fallbackDay } from "@/domain/lifestyle/WeatherPlanner";
export {
  STRATEGY_PROFILES,
  DEFAULT_STRATEGY,
  strategyProfile,
  type StrategyProfile,
} from "@/domain/lifestyle/PlanningStrategy";
export { LIFESTYLE_ENGINE_VERSION } from "@/domain/lifestyle/constants";
export type {
  TravelStyle,
  PlanningStrategy,
  LuggageConstraint,
  LaundryAvailability,
  TripEvent,
  Trip,
  TripDay,
  WeatherSource,
  WeatherForecast,
  WeatherForecastDay,
  LifestyleInput,
  LifestyleOptions,
  OrchestrateFn,
  DailyOutfit,
  PackingList,
  LaundrySchedule,
  MissingItem,
  ProspectiveNeed,
  TripPlan,
  PackingPlan,
  LaundryPlan,
  ShoppingPlan,
  LifestylePlan,
} from "@/domain/lifestyle/types";
