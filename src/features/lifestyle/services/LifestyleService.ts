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
import type { WardrobeItemInput } from "@/domain/recommendation";
import { toPreferenceSnapshot } from "@/domain/personalization";
import type { StyleDNAItem } from "@/domain/style-dna";
import {
  fetchUsageAnalytics,
  fetchWardrobeHealth,
} from "@/features/analytics/services/analytics.service";
import { fetchPurchaseAnalytics } from "@/features/purchases/services/purchases.service";
import { getPreferenceProfile } from "@/features/personalization/services/personalization.service";
import {
  selectRecommendationData,
  type RecoItemRow,
} from "@/features/recommendations/repositories/recommendations.repository";
import { openMeteoProvider } from "@/features/weather/provider/OpenMeteoProvider";
import { manualForecast } from "@/features/weather/provider/WeatherNormalizer";
import { toError } from "@/shared/utils/data-result";

export interface PlanTripRequest {
  trip: Trip;
  strategy?: PlanningStrategy;
  /** Weather: fetched automatically (default) or entered manually. */
  weather?: { mode: "auto" } | { mode: "manual"; days: WeatherForecastDay[] };
}

export interface LifestyleResult {
  plan: LifestylePlan;
  /** id → display name, for rendering outfit/packing item names. */
  itemNames: Record<string, string>;
}

function names<K extends string>(
  rows: { [key in K]: { name: string } | null }[] | null | undefined,
  key: K,
): string[] {
  return (rows ?? [])
    .map((r) => r[key]?.name ?? null)
    .filter((n): n is string => Boolean(n && n.trim()));
}

function toItemInput(row: RecoItemRow): WardrobeItemInput {
  return {
    id: row.id,
    name: row.name,
    category: row.category?.name ?? null,
    subcategory: row.subcategory?.name ?? null,
    color: row.primary_color?.name ?? null,
    formality: row.formality,
    usage: row.usage,
    rating: row.rating,
    status: row.status,
    seasons: names(row.item_seasons, "seasons"),
    styles: names(row.item_styles, "styles"),
    tags: names(row.item_tags, "tags"),
  };
}

function toStyleItem(row: RecoItemRow): StyleDNAItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category?.name ?? null,
    subcategory: row.subcategory?.name ?? null,
    color: row.primary_color?.name ?? null,
    formality: row.formality,
    usage: row.usage,
    rating: row.rating,
    seasons: names(row.item_seasons, "seasons"),
    styles: names(row.item_styles, "styles"),
    tags: names(row.item_tags, "tags"),
  };
}

const isActive = (row: RecoItemRow) => row.status === "active" || row.status === null;

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
  if (request.weather?.mode === "manual") return manualForecast(request.weather.days);
  try {
    const f = await openMeteoProvider.forecast(
      request.trip.destination,
      request.trip.startDate,
      request.trip.endDate,
    );
    return f.days.length > 0 ? f : fallbackForecast(request.trip);
  } catch {
    return fallbackForecast(request.trip);
  }
}

export async function planTrip(
  request: PlanTripRequest,
): Promise<{ data: LifestyleResult | null; error: Error | null }> {
  const [forecast, dataResult, healthResult, usageResult, purchaseResult, preferenceResult] =
    await Promise.all([
      resolveForecast(request),
      selectRecommendationData(),
      fetchWardrobeHealth(),
      fetchUsageAnalytics(),
      fetchPurchaseAnalytics(),
      getPreferenceProfile().catch(() => ({ data: null, error: null })),
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
    },
    { generatedAt: new Date().toISOString() },
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
    { strategy: request.strategy },
  );

  return {
    data: { plan, itemNames: Object.fromEntries(raw.items.map((i) => [i.id, i.name])) },
    error: null,
  };
}
