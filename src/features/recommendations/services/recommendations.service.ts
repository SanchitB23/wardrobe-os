import {
  buildRecommendationContext,
  recommendUnifiedOutfits,
  type CommuteMode,
  type RecommendedOutfitItem,
  type SeasonLabel,
  type UnifiedOutfitRecommendation,
  type WardrobeItemInput,
  type WeatherCondition,
  type WeatherSnapshot,
} from "@/domain/recommendation";
import { generateInsights } from "@/domain/analytics/InsightEngine";
import { toPreferenceSnapshot } from "@/domain/personalization";
import { weatherRuntime } from "@/runtime/weather";
import { getPreferenceProfile } from "@/features/personalization/services/personalization.service";
import {
  fetchUsageAnalytics,
  fetchWardrobeHealth,
} from "@/features/analytics/services/analytics.service";
import { fetchPurchaseAnalytics } from "@/features/purchases/services/purchases.service";
import { buildExplainSharedContext } from "@/features/recommendations/ai/explanation-input";
import type { ExplainSharedContext } from "@/features/recommendations/ai/explanation.types";
import { selectPrimaryImageUrls } from "@/features/inventory/repositories/images.repository";
import { fetchOutfitItemLinks } from "@/features/outfits/repositories/outfits.repository";
import { createOutfit } from "@/features/outfits/services/outfits.service";
import { insertWearLogs } from "@/features/wear-logs/repositories/wear-logs.repository";
import {
  selectRecommendationData,
  type RecoItemRow,
} from "@/features/recommendations/repositories/recommendations.repository";
import { toError } from "@/shared/utils/data-result";

export type RecommendationFilters = {
  occasion?: string | null;
  season?: SeasonLabel | null;
  weather?: WeatherCondition | null;
  commute?: CommuteMode | null;
  favoritesOnly?: boolean;
};

/** Lightweight per-item view data for rendering outfit previews. */
export type ItemPreview = {
  itemId: string;
  name: string;
  color: string | null;
  category: string | null;
  imageUrl: string | null;
};

/** The resolved context the engine actually scored against (for debug display). */
export type RecommendationContextSummary = {
  occasion: string | null;
  season: SeasonLabel;
  weather: WeatherCondition;
  commute: CommuteMode;
  favoritesOnly: boolean;
};

export type RecommendationCenterData = {
  recommendations: UnifiedOutfitRecommendation[];
  previews: Record<string, ItemPreview>;
  context: RecommendationContextSummary;
  /**
   * Curated, wardrobe-free summaries shared by every card, used to assemble the
   * AI explanation input on the client. See src/features/recommendations/ai.
   */
  explainContext: ExplainSharedContext;
};

function relatedNames<K extends string>(
  rows: { [key in K]: { name: string } | null }[] | null | undefined,
  key: K,
): string[] {
  return (rows ?? [])
    .map((row) => row[key]?.name ?? null)
    .filter((name): name is string => Boolean(name && name.trim()));
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
    seasons: relatedNames(row.item_seasons, "seasons"),
    styles: relatedNames(row.item_styles, "styles"),
    tags: relatedNames(row.item_tags, "tags"),
  };
}

function weatherOverride(
  filters: RecommendationFilters,
): Partial<WeatherSnapshot> | undefined {
  const override: Partial<WeatherSnapshot> = {};
  if (filters.season) override.season = filters.season;
  if (filters.weather) override.condition = filters.weather;
  return Object.keys(override).length > 0 ? override : undefined;
}

/**
 * RFC-011: resolve the weather the recommendation context should use.
 *   1. explicit filter override (manual) wins;
 *   2. else, if a home location is configured, fetch a live snapshot via the
 *      Weather Runtime (cached, never throws);
 *   3. else `undefined` → the builder applies a deterministic seasonal fallback.
 */
async function resolveWeatherSnapshot(
  filters: RecommendationFilters,
  generatedAt: string,
): Promise<Partial<WeatherSnapshot> | undefined> {
  const override = weatherOverride(filters);
  if (override) return override;

  const home = process.env.WEATHER_HOME_LOCATION;
  if (!home) return undefined;

  const day = generatedAt.slice(0, 10);
  const { snapshot } = await weatherRuntime.getSnapshot({
    location: home,
    startDate: day,
    endDate: day,
    at: day,
  });
  return snapshot;
}

/**
 * Orchestrates the Recommendation Center: fetches raw domain data + the health,
 * usage, and purchase analytics, assembles a RecommendationContext, and runs
 * the pure OutfitRecommendationEngine. Filters bias the context (occasion,
 * season, weather, commute) or restrict candidates (favorites only).
 */
export async function fetchOutfitRecommendations(
  filters: RecommendationFilters = {},
): Promise<{ data: RecommendationCenterData | null; error: Error | null }> {
  const [dataResult, healthResult, usageResult, purchaseResult, preferenceResult] =
    await Promise.all([
      selectRecommendationData(),
      fetchWardrobeHealth(),
      fetchUsageAnalytics(),
      fetchPurchaseAnalytics(),
      // Best-effort (RFC-004): learned preferences supersede DEFAULT_PREFERENCES.
      getPreferenceProfile().catch(() => ({ data: null, error: null })),
    ]);

  if (dataResult.error) return { data: null, error: dataResult.error };
  if (healthResult.error) return { data: null, error: healthResult.error };
  if (!dataResult.data || !healthResult.data) {
    return { data: null, error: toError("Recommendation data unavailable.") };
  }

  const raw = dataResult.data;
  const wardrobeItems = raw.items.map(toItemInput);

  // Best-effort primary images (blocked by RLS today → falls back to swatches).
  const imageResult = await selectPrimaryImageUrls(wardrobeItems.map((item) => item.id));
  const imageByItem = new Map(
    (imageResult.data ?? []).map((row) => [row.item_id, row.image_url]),
  );

  const previews: Record<string, ItemPreview> = {};
  for (const item of wardrobeItems) {
    previews[item.id] = {
      itemId: item.id,
      name: item.name,
      color: item.color ?? null,
      category: item.category ?? null,
      imageUrl: imageByItem.get(item.id) ?? null,
    };
  }

  const wearLogs = raw.wearLogs
    .filter((row): row is typeof row & { item_id: string } => Boolean(row.item_id))
    .map((row) => ({ itemId: row.item_id, wornOn: row.worn_on }));

  const lastWornByOutfit = new Map<string, string>();
  for (const row of raw.wearLogs) {
    if (!row.outfit_id) continue;
    const current = lastWornByOutfit.get(row.outfit_id);
    if (!current || row.worn_on > current) {
      lastWornByOutfit.set(row.outfit_id, row.worn_on);
    }
  }

  const itemIdsByOutfit = new Map<string, string[]>();
  for (const link of raw.outfitItems) {
    const list = itemIdsByOutfit.get(link.outfit_id) ?? [];
    list.push(link.item_id);
    itemIdsByOutfit.set(link.outfit_id, list);
  }

  let savedOutfits = raw.outfits.map((outfit) => ({
    id: outfit.id,
    name: outfit.name,
    itemIds: itemIdsByOutfit.get(outfit.id) ?? [],
    favorite: Boolean(outfit.favorite),
    score: outfit.rating,
    lastWornOn: lastWornByOutfit.get(outfit.id) ?? null,
  }));
  if (filters.favoritesOnly) {
    savedOutfits = savedOutfits.filter((outfit) => outfit.favorite);
  }

  // Learned preferences (RFC-004) supersede the static defaults when available.
  const learnedPreferences = preferenceResult.data
    ? toPreferenceSnapshot(preferenceResult.data.profile)
    : undefined;
  // RFC-004: owner-pinned/avoided items flow into scoring + insights.
  const protectedItemIds = preferenceResult.data?.profile.protectedItemIds ?? [];
  const avoidedItemIds = preferenceResult.data?.profile.avoidedItemIds ?? [];

  const generatedAt = new Date().toISOString();

  // RFC-011: weather comes from the Weather Runtime as a WeatherSnapshot. A manual
  // filter override wins; otherwise, if a home location is configured, fetch live
  // weather; otherwise the builder uses a deterministic seasonal fallback (which
  // the AI explains as an estimate). The engine never fetches weather.
  const weather = await resolveWeatherSnapshot(filters, generatedAt);

  const context = buildRecommendationContext(
    {
      health: healthResult.data.health,
      usageAnalytics: usageResult.error ? null : usageResult.data,
      purchaseAnalytics:
        purchaseResult.error || !purchaseResult.data ? null : purchaseResult.data,
      wardrobeItems,
      wearLogs,
      purchases: raw.purchases.map((p) => ({ itemId: p.item_id, price: p.price })),
      savedOutfits,
      preferences: learnedPreferences,
      weather,
      commute: filters.commute ? { mode: filters.commute } : undefined,
      protectedItemIds,
      avoidedItemIds,
    },
    { generatedAt },
  );

  const unified = recommendUnifiedOutfits(context, {
    occasion: filters.occasion ?? null,
    limit: 12,
    usePreferences: Boolean(learnedPreferences),
  });
  const recommendations = filters.favoritesOnly
    ? unified.filter((rec) => rec.source === "saved_outfit")
    : unified;

  const contextSummary: RecommendationContextSummary = {
    occasion: filters.occasion ?? null,
    season: context.weather.season,
    weather: context.weather.condition,
    commute: context.commute.mode,
    favoritesOnly: Boolean(filters.favoritesOnly),
  };

  // Curated, wardrobe-free summaries for AI explanations. Insights are derived
  // from the same health/usage/purchase analytics already fetched above; if
  // usage analytics are unavailable we fall back to the health headline.
  const insightSummary =
    usageResult.error || !usageResult.data
      ? {
          overallSummary: healthResult.data.health.strengths[0] ?? "",
          topActions: healthResult.data.health.recommendations.slice(0, 3),
        }
      : (() => {
          const report = generateInsights(
            {
              wardrobeHealth: healthResult.data.health,
              usageAnalytics: usageResult.data,
              purchaseAnalytics:
                purchaseResult.error || !purchaseResult.data
                  ? undefined
                  : purchaseResult.data,
            },
            { generatedAt: context.generatedAt, protectedItemIds },
          );
          return {
            overallSummary: report.overallSummary,
            topActions: report.topActions.map((action) => action.title),
          };
        })();
  const explainContext = buildExplainSharedContext({
    wardrobeHealth: healthResult.data.health,
    insights: insightSummary,
    weather: context.weather,
    commute: context.commute,
  });

  return {
    data: { recommendations, previews, context: contextSummary, explainContext },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function itemSetSignature(itemIds: readonly string[]): string {
  return Array.from(new Set(itemIds))
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

/**
 * Saves a generated outfit: creates the `outfits` row and its `outfit_items`.
 * Default name is "Generated Outfit - YYYY-MM-DD". If an outfit with the exact
 * same item set already exists, returns it with `duplicate: true` instead of
 * creating a second copy.
 */
export async function saveGeneratedOutfit(
  items: readonly RecommendedOutfitItem[],
  name?: string,
): Promise<{ data: { id: string; duplicate: boolean } | null; error: Error | null }> {
  if (items.length === 0) {
    return { data: null, error: toError("Cannot save an empty outfit.") };
  }

  const newSignature = itemSetSignature(items.map((item) => item.itemId));

  // Duplicate prevention — bail out if the same item set is already saved.
  const linksResult = await fetchOutfitItemLinks();
  if (!linksResult.error && linksResult.data) {
    const itemsByOutfit = new Map<string, string[]>();
    for (const link of linksResult.data) {
      const list = itemsByOutfit.get(link.outfit_id) ?? [];
      list.push(link.item_id);
      itemsByOutfit.set(link.outfit_id, list);
    }
    for (const [outfitId, itemIds] of itemsByOutfit) {
      if (itemSetSignature(itemIds) === newSignature) {
        return { data: { id: outfitId, duplicate: true }, error: null };
      }
    }
  }

  const result = await createOutfit({
    name: name?.trim() || `Generated Outfit - ${todayIso()}`,
    items: items.map((item) => ({ item_id: item.itemId, slot: item.slot })),
  });
  if (result.error || !result.data) {
    return { data: null, error: result.error ?? toError("Failed to save outfit.") };
  }
  return { data: { id: result.data.id, duplicate: false }, error: null };
}

/**
 * Logs a wear for each item today. `outfitId` is optional so generated combos
 * can be worn without first being saved.
 */
export async function wearOutfitToday(
  itemIds: readonly string[],
  outfitId?: string | null,
): Promise<{ error: Error | null }> {
  const ids = itemIds.filter(Boolean);
  if (ids.length === 0) {
    return { error: toError("Cannot log a wear with no items.") };
  }
  const wornOn = todayIso();
  const result = await insertWearLogs(
    ids.map((itemId) => ({ item_id: itemId, worn_on: wornOn, outfit_id: outfitId ?? null })),
  );
  return { error: result.error };
}
