import {
  buildRecommendationContext,
  recommendV2,
  type CommuteMode,
  type RecommendationQuality,
  type RecommendationV2,
  type RecommendedOutfitItem,
  type SeasonLabel,
  type WeatherCondition,
  type WeatherSnapshot,
} from "@/domain/recommendation";
import { generateInsights } from "@/domain/analytics/InsightEngine";
import { toPreferenceSnapshot } from "@/domain/personalization";
import type { UserPreferenceProfile } from "@/domain/personalization";
import {
  resolveExploreExploit,
  EXPLORE_EXPLOIT_DEFAULT,
  type ExploreExploitMode,
} from "@/domain/personalization/v2";
import type { RecommendationPersonalization } from "@/domain/recommendation";
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
import {
  rowToVisualStyleAttributes,
  selectAcceptedVisualAttributesByItemIds,
} from "@/features/inventory/repositories/visual-attributes.repository";
import { fetchOutfitItemLinks } from "@/features/outfits/repositories/outfits.repository";
import { createOutfit } from "@/features/outfits/services/outfits.service";
import {
  createWearLogFromOutfit,
  createWearLogFromRecommendation,
} from "@/features/wear-logs/services/wear-events.service";
import { selectRecommendationData } from "@/features/recommendations/repositories/recommendations.repository";
import { toItemInput } from "@/features/recommendations/repositories/reco-item-mappers";
import { toError } from "@/shared/utils/data-result";

export type RecommendationFilters = {
  occasion?: string | null;
  season?: SeasonLabel | null;
  weather?: WeatherCondition | null;
  commute?: CommuteMode | null;
  favoritesOnly?: boolean;
  /** RFC-013: how strongly to lean on known taste vs surface neglected items. */
  exploreExploit?: ExploreExploitMode | null;
};

/**
 * RFC-013: build the recommendation personalization directives from the derived
 * profile + the owner's explore/exploit mode. Lifecycle + avoided values let
 * Recommendation Engine v2 avoid overfitting; the mode re-weights preference fit
 * vs rotation. Pure mapping.
 */
function buildPersonalization(
  profile: UserPreferenceProfile | undefined,
  avoidedPreferences: { dimension: string; value: string }[],
  mode: ExploreExploitMode,
): RecommendationPersonalization {
  const lifecycleByValue: NonNullable<RecommendationPersonalization["lifecycleByValue"]> = {};
  if (profile) {
    const groups = [
      profile.preferredColors,
      profile.preferredBrands,
      profile.preferredFormality,
      profile.preferredFootwear,
      profile.preferredStyles,
      profile.preferredSeasons,
      profile.preferredOccasions,
      profile.preferredSilhouettes,
      profile.carePreference,
      profile.commutePreference,
    ];
    for (const group of groups) {
      for (const pref of group) {
        if (pref.lifecycle) lifecycleByValue[`${pref.dimension}:${pref.value.toLowerCase()}`] = pref.lifecycle;
      }
    }
  }
  return {
    exploreExploit: mode,
    weights: resolveExploreExploit(mode),
    lifecycleByValue,
    avoidedValues: avoidedPreferences,
  };
}

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
  recommendations: RecommendationV2[];
  previews: Record<string, ItemPreview>;
  context: RecommendationContextSummary;
  /** RFC-012: per-run recommendation quality metrics (for Developer Mode). */
  quality: RecommendationQuality;
  /**
   * Curated, wardrobe-free summaries shared by every card, used to assemble the
   * AI explanation input on the client. See src/features/recommendations/ai.
   */
  explainContext: ExplainSharedContext;
};

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

  // RFC-020: attach accepted visual attributes for StyleDNA merge (best-effort).
  const visualResult = await selectAcceptedVisualAttributesByItemIds(
    wardrobeItems.map((item) => item.id),
  );
  if (visualResult.data?.length) {
    const byItem = new Map(
      visualResult.data.map((row) => [
        row.item_id,
        rowToVisualStyleAttributes(row),
      ]),
    );
    for (const item of wardrobeItems) {
      item.acceptedVisual = byItem.get(item.id) ?? null;
    }
  }

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

  // RFC-013: personalization directives (lifecycle + explore/exploit) for v2.
  const exploreExploit = filters.exploreExploit ?? EXPLORE_EXPLOIT_DEFAULT;
  const personalization = buildPersonalization(
    preferenceResult.data?.profile,
    preferenceResult.data?.avoidedPreferences ?? [],
    exploreExploit,
  );

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
      personalization,
    },
    { generatedAt },
  );

  // RFC-012: Recommendation Engine v2 — multi-objective, weather- and
  // preference-aware, diversity-ranked, explainable. Returns quality metrics too.
  const v2 = recommendV2(context, {
    occasion: filters.occasion ?? null,
    limit: 12,
    favoritesOnly: Boolean(filters.favoritesOnly),
    personalizationApplied: Boolean(learnedPreferences),
  });
  const recommendations = v2.recommendations;
  const quality = v2.quality;

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
    data: { recommendations, previews, context: contextSummary, quality, explainContext },
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
 * Logs a wear for each item today as an event-centric wear log (RFC-023).
 * `outfitId` is optional so generated combos can be worn without being saved.
 * Source is `recommendation` when unlinked, `outfit` when linked to a saved outfit.
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
  const items = ids.map((itemId) => ({ itemId }));
  if (outfitId) {
    const result = await createWearLogFromOutfit({
      outfitId,
      items,
      wornOn,
    });
    return { error: result.error };
  }
  const result = await createWearLogFromRecommendation({
    items,
    wornOn,
    outfitId: null,
  });
  return { error: result.error };
}
