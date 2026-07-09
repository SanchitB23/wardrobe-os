/**
 * Lifestyle Engine types (RFC-006).
 *
 * Pure type definitions — no React, no Supabase, no AI, no I/O. The Lifestyle
 * Engine COMPOSES existing engines across a trip horizon; it adds no scoring or
 * taste of its own. It requests recommendations through the Intelligence
 * Orchestrator (RFC-005), never by calling the recommendation engine directly.
 */

import type { BuyVsSkipAnalysis } from "@/domain/acquisition";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import type { UsageAnalytics } from "@/domain/analytics/UsageAnalyticsEngine";
import type {
  CapabilityRequest,
  ExecutionContext,
  ExecutionReport,
} from "@/domain/orchestrator";
import type { UserPreferenceProfile } from "@/domain/personalization";
import type {
  RecommendationContext,
  SeasonLabel,
  WeatherCondition,
} from "@/domain/recommendation";
import type {
  WeatherForecast,
  WeatherForecastDay,
  WeatherSource,
} from "@/domain/weather";
import type { StyleDNAItem } from "@/domain/style-dna";
import type { PurchaseAnalytics } from "@/types/wardrobe";

// ---------------------------------------------------------------------------
// Trip inputs
// ---------------------------------------------------------------------------

export type TravelStyle = "minimal" | "standard" | "overpacker";

/**
 * Higher-level optimisation strategy. Tunes capsule minimality, packing
 * generosity, and formality bias. Distinct from {@link TravelStyle}.
 */
export type PlanningStrategy = "minimal" | "balanced" | "luxury" | "business";

export interface LuggageConstraint {
  kind: "carry_on" | "checked" | "unbounded";
  maxItems?: number | null;
}

export interface LaundryAvailability {
  available: boolean;
  /** Turnaround in days when available (e.g. hotel same-day = 1). */
  turnaroundDays?: number | null;
}

export interface TripEvent {
  /** ISO date (YYYY-MM-DD) within the trip. */
  date: string;
  occasion: string;
  formalityHint?: string | null;
}

export interface Trip {
  destination: string;
  startDate: string; // ISO date
  endDate: string; // ISO date (inclusive) → duration
  events: TripEvent[];
  travelStyle: TravelStyle;
  laundry: LaundryAvailability;
  luggage: LuggageConstraint;
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

// RFC-011: the forecast types now live in the weather domain; re-exported here
// (and imported above for local use) so `@/domain/lifestyle` consumers are unaffected.
export type { WeatherForecast, WeatherForecastDay, WeatherSource };

// ---------------------------------------------------------------------------
// Engine input
// ---------------------------------------------------------------------------

/** A day of the trip, with its occasion and forecast attached. */
export interface TripDay {
  date: string;
  /** Primary occasion for the day (from an event, or a travel-style default). */
  occasion: string;
  weather: WeatherForecastDay;
}

export interface LifestyleInput {
  trip: Trip;
  forecast: WeatherForecast;
  /** Base recommendation context; per-day weather is overridden by the engine. */
  recommendation: RecommendationContext;
  /** Active wardrobe, for capsule/packing item lookups + acquisition scoring. */
  wardrobe: StyleDNAItem[];
  preferences?: UserPreferenceProfile | null;
  health?: WardrobeHealth | null;
  usage?: UsageAnalytics | null;
  purchase?: PurchaseAnalytics | null;
}

/** The orchestrator entry point, injected so the engine never calls engines directly. */
export type OrchestrateFn = (
  request: CapabilityRequest,
  context: ExecutionContext,
  options?: { clock?: () => number },
) => ExecutionReport;

export interface LifestyleOptions {
  /** Required: the single instant the plan is generated at. No wall-clock
   *  fallback — callers must inject it so plans are deterministic (RFC-008/H3). */
  generatedAt: string;
  strategy?: PlanningStrategy;
  /** Injected orchestrator (defaults to the real one). Tests pass a spy. */
  orchestrate?: OrchestrateFn;
  /** Timing clock forwarded to the orchestrator (metadata only). */
  clock?: () => number;
}

// ---------------------------------------------------------------------------
// Plan outputs (four sub-plans + envelope)
// ---------------------------------------------------------------------------

export interface DailyOutfit {
  date: string;
  occasion: string;
  weather: { condition: WeatherCondition; season: SeasonLabel };
  itemIds: string[];
  /** Recommendation score (0–10) from the recommendation capability. */
  score: number;
  reason: string;
  /** True when no suitable outfit could be produced for the day. */
  uncovered: boolean;
}

export interface PackingList {
  itemIds: string[];
  bySlot: Record<string, string[]>;
  count: number;
  withinLuggage: boolean;
}

export interface LaundrySchedule {
  needed: boolean;
  /** ISO dates on which a wash is required to keep clean clothes. */
  washOn: string[];
  reWears: { itemId: string; dates: string[] }[];
}

export interface MissingItem {
  need: string;
  forDates: string[];
  reason: string;
}

/** A need handed to the (injected) buy/skip evaluator. */
export interface ProspectiveNeed {
  need: string;
  forDates: string[];
}

export interface TripPlan {
  days: TripDay[];
  dailyOutfits: DailyOutfit[];
  capsule: { itemCount: number; dayCount: number };
}

export interface PackingPlan {
  packingList: PackingList;
  /** 0–1: how well the packed set covers the trip. Separate from planScore. */
  packingConfidence: number;
}

export interface LaundryPlan {
  schedule: LaundrySchedule;
}

export interface ShoppingPlan {
  missingItems: MissingItem[];
  shoppingSuggestions: { need: string; analysis: BuyVsSkipAnalysis }[];
}

export interface LifestylePlan {
  tripPlan: TripPlan;
  packingPlan: PackingPlan;
  laundryPlan: LaundryPlan;
  shoppingPlan: ShoppingPlan;
  warnings: string[];
  /** Human-readable, decision-free trade-offs the plan made. */
  tradeoffs: string[];
  /** 0–100 overall plan quality. */
  planScore: number;
  /** 0–1 overall confidence in the inputs/data (distinct from planScore). */
  confidence: number;
  metadata: {
    engineVersion: string;
    generatedAt: string;
    destination: string;
    days: number;
    strategy: PlanningStrategy;
    weatherSource: WeatherSource;
  };
}
