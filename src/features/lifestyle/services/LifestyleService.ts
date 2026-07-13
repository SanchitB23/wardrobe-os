/**
 * LifestyleService (RFC-006) — assembles the trip context from repositories +
 * a weather forecast and runs the pure Lifestyle Engine, returning
 * `{ data, error }`. The engine plans deterministically (routing recommendation
 * + acquisition through the Orchestrator); this layer only does I/O.
 */

import {
  eachDateInclusive,
  planLifestyle,
  type LifestylePlan,
  type PlanningStrategy,
  type Trip,
  type WeatherForecast,
  type WeatherForecastDay,
} from "@/domain/lifestyle";
import { buildRecommendationContext } from "@/domain/recommendation";
import { toPreferenceSnapshot } from "@/domain/personalization";
import {
  fetchUsageAnalytics,
  fetchWardrobeHealth,
} from "@/features/analytics/services/analytics.service";
import { fetchPurchaseAnalytics } from "@/features/purchases/services/purchases.service";
import { getPreferenceProfile } from "@/features/personalization/services/personalization.service";
import { selectRecommendationData } from "@/features/recommendations/repositories/recommendations.repository";
import {
  isActive,
  toItemInput,
  toStyleItem,
} from "@/features/recommendations/repositories/reco-item-mappers";
import { manualForecast, weatherRuntime } from "@/runtime/weather";
import { toError } from "@/shared/utils/data-result";

export interface PlanTripRequest {
  trip: Trip;
  strategy?: PlanningStrategy;
  /**
   * Weather: fetched automatically (default), entered manually, or supplied
   * pre-resolved. The `forecast` mode lets a caller (e.g. the Trip Planner's
   * multi-city merge, RFC-017) inject an already-built forecast — preserving its
   * real `source` — without re-fetching here.
   */
  weather?:
    | { mode: "auto" }
    | { mode: "manual"; days: WeatherForecastDay[] }
    | { mode: "forecast"; forecast: WeatherForecast };
}

export interface LifestyleResult {
  plan: LifestylePlan;
  /** id → display name, for rendering outfit/packing item names. */
  itemNames: Record<string, string>;
}

/** Neutral fallback forecast when live fetch is unavailable. */
function fallbackForecast(trip: Trip): WeatherForecast {
  return manualForecast(
    eachDateInclusive(trip.startDate, trip.endDate).map((date) => ({
      date,
      season: "summer",
      condition: "mild",
      highC: null,
      lowC: null,
      rainRisk: null,
    })),
  );
}

async function resolveForecast(request: PlanTripRequest): Promise<WeatherForecast> {
  // RFC-011: weather comes from the shared Weather Runtime — never a direct
  // provider call. The runtime never throws (returns { data, error }); on failure
  // we degrade to a neutral seasonal forecast.
  if (request.weather?.mode === "forecast") return request.weather.forecast;
  if (request.weather?.mode === "manual") return manualForecast(request.weather.days);
  const { data } = await weatherRuntime.getForecast({
    location: request.trip.destination,
    startDate: request.trip.startDate,
    endDate: request.trip.endDate,
  });
  return data && data.days.length > 0 ? data : fallbackForecast(request.trip);
}

export async function planTrip(
  request: PlanTripRequest,
): Promise<{ data: LifestyleResult | null; error: Error | null }> {
  // One instant for the whole request — every engine call shares it (RFC-008/H3).
  const generatedAt = new Date().toISOString();
  const [forecast, dataResult, healthResult, usageResult, purchaseResult, preferenceResult] =
    await Promise.all([
      resolveForecast(request),
      selectRecommendationData(),
      fetchWardrobeHealth(),
      fetchUsageAnalytics(),
      fetchPurchaseAnalytics(),
      getPreferenceProfile({ generatedAt }).catch(() => ({ data: null, error: null })),
    ]);

  if (dataResult.error) return { data: null, error: dataResult.error };
  if (healthResult.error) return { data: null, error: healthResult.error };
  if (!dataResult.data || !healthResult.data) {
    return { data: null, error: toError("Wardrobe data unavailable.") };
  }

  const raw = dataResult.data;
  const health = healthResult.data.health;
  const usage = usageResult.error ? null : (usageResult.data ?? null);
  const purchase = purchaseResult.error ? null : (purchaseResult.data ?? null);
  const learnedPreferences = preferenceResult.data
    ? toPreferenceSnapshot(preferenceResult.data.profile)
    : undefined;

  const itemsByOutfit = new Map<string, string[]>();
  for (const link of raw.outfitItems) {
    const list = itemsByOutfit.get(link.outfit_id) ?? [];
    list.push(link.item_id);
    itemsByOutfit.set(link.outfit_id, list);
  }

  const recommendation = buildRecommendationContext(
    {
      health,
      usageAnalytics: usage,
      purchaseAnalytics: purchase,
      wardrobeItems: raw.items.map(toItemInput),
      wearLogs: raw.wearLogs
        .filter((r): r is typeof r & { item_id: string } => Boolean(r.item_id))
        .map((r) => ({ itemId: r.item_id, wornOn: r.worn_on })),
      purchases: raw.purchases.map((p) => ({ itemId: p.item_id, price: p.price })),
      savedOutfits: raw.outfits.map((o) => ({
        id: o.id,
        name: o.name,
        itemIds: itemsByOutfit.get(o.id) ?? [],
        favorite: Boolean(o.favorite),
        score: o.rating,
        lastWornOn: null,
      })),
      preferences: learnedPreferences,
      protectedItemIds: preferenceResult.data?.profile.protectedItemIds ?? [],
      avoidedItemIds: preferenceResult.data?.profile.avoidedItemIds ?? [],
    },
    { generatedAt },
  );

  const plan = planLifestyle(
    {
      trip: request.trip,
      forecast,
      recommendation,
      wardrobe: raw.items.filter(isActive).map(toStyleItem),
      preferences: preferenceResult.data?.profile ?? null,
      health,
      usage,
      purchase,
    },
    { strategy: request.strategy, generatedAt },
  );

  return {
    data: { plan, itemNames: Object.fromEntries(raw.items.map((i) => [i.id, i.name])) },
    error: null,
  };
}
