import {
  buildRecommendationContext,
  generateOutfitRecommendations,
  type CommuteMode,
  type OutfitRecommendation,
  type RejectedOutfit,
  type SeasonLabel,
  type WardrobeItemInput,
  type WeatherCondition,
  type WeatherSnapshot,
} from "@/domain/recommendation";
import {
  fetchUsageAnalytics,
  fetchWardrobeHealth,
} from "@/features/analytics/services/analytics.service";
import { fetchPurchaseAnalytics } from "@/features/purchases/services/purchases.service";
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
  recommendations: OutfitRecommendation[];
  rejected: RejectedOutfit[];
  previews: Record<string, ItemPreview>;
  context: RecommendationContextSummary;
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
 * Orchestrates the Recommendation Center: fetches raw domain data + the health,
 * usage, and purchase analytics, assembles a RecommendationContext, and runs
 * the pure OutfitRecommendationEngine. Filters bias the context (occasion,
 * season, weather, commute) or restrict candidates (favorites only).
 */
export async function fetchOutfitRecommendations(
  filters: RecommendationFilters = {},
): Promise<{ data: RecommendationCenterData | null; error: Error | null }> {
  const [dataResult, healthResult, usageResult, purchaseResult] =
    await Promise.all([
      selectRecommendationData(),
      fetchWardrobeHealth(),
      fetchUsageAnalytics(),
      fetchPurchaseAnalytics(),
    ]);

  if (dataResult.error) return { data: null, error: dataResult.error };
  if (healthResult.error) return { data: null, error: healthResult.error };
  if (!dataResult.data || !healthResult.data) {
    return { data: null, error: toError("Recommendation data unavailable.") };
  }

  const raw = dataResult.data;
  const wardrobeItems = raw.items.map(toItemInput);

  const previews: Record<string, ItemPreview> = {};
  for (const item of wardrobeItems) {
    previews[item.id] = {
      itemId: item.id,
      name: item.name,
      color: item.color ?? null,
      category: item.category ?? null,
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
      weather: weatherOverride(filters),
      commute: filters.commute ? { mode: filters.commute } : undefined,
    },
    { generatedAt: new Date().toISOString() },
  );

  const result = generateOutfitRecommendations(context, {
    occasion: filters.occasion ?? null,
    limit: 8,
  });
  const recommendations = filters.favoritesOnly
    ? result.recommendations.filter((rec) => rec.metadata.source === "saved_outfit")
    : result.recommendations;

  const contextSummary: RecommendationContextSummary = {
    occasion: filters.occasion ?? null,
    season: context.weather.season,
    weather: context.weather.condition,
    commute: context.commute.mode,
    favoritesOnly: Boolean(filters.favoritesOnly),
  };

  return {
    data: { recommendations, rejected: result.rejected, previews, context: contextSummary },
    error: null,
  };
}
