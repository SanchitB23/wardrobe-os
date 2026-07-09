/**
 * Recommendation Context Builder — deterministically assembles a
 * {@link RecommendationContext} from already-fetched domain data.
 *
 * Pure TypeScript: no React, no Supabase, no fetching, no recommendation logic.
 * It receives raw domain inputs (items, wear logs, purchases, analytics
 * outputs, and optional preference/weather/commute/outfit data) and normalizes
 * them into snapshots. All time math is relative to an injected `generatedAt`
 * so output is fully deterministic.
 */

import { colorFamilyFor } from "@/domain/analytics/WardrobeHealthEngine";
import { deriveStyleDNA } from "@/domain/style-dna";
import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import type { UsageAnalytics } from "@/domain/analytics/UsageAnalyticsEngine";
import type {
  FormalityEnum,
  ItemStatus,
  PurchaseAnalytics,
  UsageFrequency,
} from "@/types/wardrobe";
import {
  DEFAULT_COMMUTE,
  DEFAULT_PREFERENCES,
  type CommuteSnapshot,
  type HealthSnapshot,
  type ItemUsageSnapshot,
  type PreferenceSnapshot,
  type PurchaseSnapshot,
  type RecommendationContext,
  type SavedOutfit,
  type SavedOutfitSnapshot,
  type UsageSnapshot,
  type WardrobeItemSnapshot,
  type WardrobeSnapshot,
  type WeatherSnapshot,
} from "@/domain/recommendation/RecommendationContext";
import { seasonalFallbackSnapshot } from "@/domain/weather";

// ---------------------------------------------------------------------------
// Raw inputs
// ---------------------------------------------------------------------------

export interface WardrobeItemInput {
  id: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  color?: string | null;
  brand?: string | null;
  formality?: FormalityEnum | null;
  usage?: UsageFrequency | null;
  rating?: number | null;
  status?: ItemStatus | null;
  seasons?: readonly string[];
  styles?: readonly string[];
  tags?: readonly string[];
}

export interface WearLogInput {
  itemId: string;
  /** ISO date the item was worn (YYYY-MM-DD or full ISO). */
  wornOn: string;
}

export interface PurchaseInput {
  itemId: string;
  price: number | null;
}

export interface SavedOutfitInput {
  id: string;
  name: string;
  itemIds: readonly string[];
  score?: number | null;
  favorite?: boolean;
  lastWornOn?: string | null;
}

export interface RecommendationContextInput {
  wardrobeItems?: readonly WardrobeItemInput[];
  wearLogs?: readonly WearLogInput[];
  purchases?: readonly PurchaseInput[];
  /** Required domain analytics — the health report. */
  health: WardrobeHealth;
  usageAnalytics?: UsageAnalytics | null;
  purchaseAnalytics?: PurchaseAnalytics | null;
  preferences?: Partial<PreferenceSnapshot>;
  weather?: Partial<WeatherSnapshot>;
  commute?: Partial<CommuteSnapshot>;
  savedOutfits?: readonly SavedOutfitInput[];
  /** RFC-004: owner-pinned items to keep (never flagged for removal). */
  protectedItemIds?: readonly string[];
  /** RFC-004: owner-avoided items (excluded from recommendations). */
  avoidedItemIds?: readonly string[];
}

export interface BuildOptions {
  /** ISO timestamp; injected for deterministic output. Defaults to now. */
  generatedAt?: string;
}

const STALE_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isActive(status: ItemStatus | null): boolean {
  return status === "active" || status === null;
}

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id.localeCompare(b.id);
}

function distinctSorted(values: readonly (string | null)[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value && value.trim()))),
  ).sort((a, b) => a.localeCompare(b));
}

function parseDate(value: string): Date | null {
  const raw = value.length === 10 ? `${value}T00:00:00Z` : value;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function toItemSnapshot(input: WardrobeItemInput): WardrobeItemSnapshot {
  const colorFamily = colorFamilyFor(input.color ?? null);
  const base = {
    id: input.id,
    name: input.name,
    category: input.category ?? null,
    subcategory: input.subcategory ?? null,
    color: input.color ?? null,
    colorFamily,
    brand: input.brand ?? null,
    formality: input.formality ?? null,
    usage: input.usage ?? null,
    rating: input.rating ?? null,
    status: input.status ?? null,
    seasons: [...(input.seasons ?? [])],
    styles: [...(input.styles ?? [])],
    tags: [...(input.tags ?? [])],
  };
  return { ...base, styleDNA: deriveStyleDNA({ ...base, colorFamily }) };
}

// ---------------------------------------------------------------------------
// Snapshot assembly
// ---------------------------------------------------------------------------

function buildWardrobe(items: readonly WardrobeItemInput[]): WardrobeSnapshot {
  const snapshots = items.map(toItemSnapshot).sort(byId);
  const activeItems = snapshots.filter((item) => isActive(item.status));
  return {
    items: snapshots,
    activeItems,
    totalCount: snapshots.length,
    activeCount: activeItems.length,
    categories: distinctSorted(activeItems.map((item) => item.category)),
    colorFamilies: distinctSorted(activeItems.map((item) => item.colorFamily)),
    brands: distinctSorted(activeItems.map((item) => item.brand)),
  };
}

function buildUsage(
  wardrobe: WardrobeSnapshot,
  wearLogs: readonly WearLogInput[],
  analytics: UsageAnalytics | null,
  asOf: Date,
): UsageSnapshot {
  const wearCountByItem: Record<string, number> = {};
  const lastWornByItem = new Map<string, Date>();
  const lastWornOnByItem = new Map<string, string>();

  for (const log of wearLogs) {
    wearCountByItem[log.itemId] = (wearCountByItem[log.itemId] ?? 0) + 1;
    const date = parseDate(log.wornOn);
    if (date) {
      const current = lastWornByItem.get(log.itemId);
      if (!current || date > current) {
        lastWornByItem.set(log.itemId, date);
        lastWornOnByItem.set(log.itemId, log.wornOn);
      }
    }
  }

  const perItem: ItemUsageSnapshot[] = wardrobe.items.map((item) => {
    const lastDate = lastWornByItem.get(item.id) ?? null;
    return {
      itemId: item.id,
      wearCount: wearCountByItem[item.id] ?? 0,
      lastWornOn: lastWornOnByItem.get(item.id) ?? null,
      daysSinceLastWorn: lastDate ? wholeDaysBetween(lastDate, asOf) : null,
    };
  });

  const byItemId = new Map(perItem.map((entry) => [entry.itemId, entry]));
  const neverWornItemIds = wardrobe.activeItems
    .filter((item) => (byItemId.get(item.id)?.wearCount ?? 0) === 0)
    .map((item) => item.id);
  const staleItemIds = wardrobe.activeItems
    .filter((item) => {
      const usage = byItemId.get(item.id);
      return (
        usage != null &&
        usage.wearCount > 0 &&
        usage.daysSinceLastWorn !== null &&
        usage.daysSinceLastWorn >= STALE_DAYS
      );
    })
    .map((item) => item.id);

  return {
    totalWears: wearLogs.length,
    perItem,
    wearCountByItem,
    neverWornItemIds,
    staleItemIds,
    analytics,
  };
}

function buildPurchase(
  purchases: readonly PurchaseInput[],
  analytics: PurchaseAnalytics | null,
): PurchaseSnapshot {
  const priceByItem: Record<string, number> = {};
  for (const purchase of purchases) {
    if (purchase.price === null || purchase.price === undefined) continue;
    const existing = priceByItem[purchase.itemId];
    if (existing === undefined || purchase.price > existing) {
      priceByItem[purchase.itemId] = purchase.price;
    }
  }
  const trackedItemIds = Object.keys(priceByItem).sort((a, b) => a.localeCompare(b));
  const totalTrackedValue = trackedItemIds.reduce(
    (sum, id) => sum + priceByItem[id],
    0,
  );
  return { priceByItem, totalTrackedValue, trackedItemIds, analytics };
}

function buildHealth(health: WardrobeHealth): HealthSnapshot {
  return {
    overallScore: health.overallScore,
    categoryScores: health.categoryScores,
    occasions: health.occasions,
    seasons: health.seasons,
    gaps: health.gaps,
    duplicates: health.duplicates,
    strengths: health.strengths,
    weaknesses: health.weaknesses,
    recommendations: health.recommendations,
  };
}

/** Delhi NCR seasonal profile derived from the month of `generatedAt`. */
/**
 * RFC-011: weather is no longer derived here. The service layer calls the
 * Weather Runtime and passes a live `WeatherSnapshot` as `input.weather`. When
 * absent (or a partial override in tests), we fall back to the deterministic
 * `seasonalFallbackSnapshot` (source: "seasonal_fallback"), merging any override
 * on top. The builder stays pure — it never fetches weather.
 */
function resolveWeather(
  asOf: Date,
  override: Partial<WeatherSnapshot> | undefined,
): WeatherSnapshot {
  const base = seasonalFallbackSnapshot(asOf);
  return override ? { ...base, ...override } : base;
}

function buildSavedOutfits(
  outfits: readonly SavedOutfitInput[],
): SavedOutfitSnapshot {
  const mapped: SavedOutfit[] = outfits
    .map((outfit) => ({
      id: outfit.id,
      name: outfit.name,
      itemIds: [...outfit.itemIds],
      score: outfit.score ?? null,
      favorite: outfit.favorite ?? false,
      lastWornOn: outfit.lastWornOn ?? null,
    }))
    .sort(byId);
  return { outfits: mapped, count: mapped.length };
}

// ---------------------------------------------------------------------------
// Public: pure function + fluent builder
// ---------------------------------------------------------------------------

/** Assembles a {@link RecommendationContext} from raw domain data. Deterministic. */
export function buildRecommendationContext(
  input: RecommendationContextInput,
  options: BuildOptions = {},
): RecommendationContext {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const asOf = parseDate(generatedAt) ?? new Date(0);

  const wardrobe = buildWardrobe(input.wardrobeItems ?? []);

  return {
    generatedAt,
    wardrobe,
    usage: buildUsage(
      wardrobe,
      input.wearLogs ?? [],
      input.usageAnalytics ?? null,
      asOf,
    ),
    purchase: buildPurchase(input.purchases ?? [], input.purchaseAnalytics ?? null),
    health: buildHealth(input.health),
    preferences: { ...DEFAULT_PREFERENCES, ...input.preferences },
    weather: resolveWeather(asOf, input.weather),
    commute: { ...DEFAULT_COMMUTE, ...input.commute },
    savedOutfits: buildSavedOutfits(input.savedOutfits ?? []),
    protectedItemIds: [...(input.protectedItemIds ?? [])],
    avoidedItemIds: [...(input.avoidedItemIds ?? [])],
  };
}

/**
 * Fluent builder over {@link buildRecommendationContext}. Every `with*` method
 * returns `this`; `build()` produces the context. Purely a convenience — it
 * holds no state beyond the accumulated input.
 */
export class RecommendationContextBuilder {
  private input: RecommendationContextInput = {
    health: {
      overallScore: 0,
      categoryScores: {
        tops: 0,
        bottoms: 0,
        footwear: 0,
        outerwear: 0,
        accessories: 0,
        fragrance: 0,
      },
      occasions: {
        officeDaily: 0,
        smartCasual: 0,
        travel: 0,
        social: 0,
        formal: 0,
        gym: 0,
        home: 0,
      },
      seasons: { summer: 0, transitional: 0, winter: 0 },
      strengths: [],
      weaknesses: [],
      recommendations: [],
      duplicates: [],
      gaps: [],
    },
  };

  withWardrobeItems(items: readonly WardrobeItemInput[]): this {
    this.input.wardrobeItems = items;
    return this;
  }

  withWearLogs(wearLogs: readonly WearLogInput[]): this {
    this.input.wearLogs = wearLogs;
    return this;
  }

  withPurchases(purchases: readonly PurchaseInput[]): this {
    this.input.purchases = purchases;
    return this;
  }

  withHealth(health: WardrobeHealth): this {
    this.input.health = health;
    return this;
  }

  withUsageAnalytics(analytics: UsageAnalytics | null): this {
    this.input.usageAnalytics = analytics;
    return this;
  }

  withPurchaseAnalytics(analytics: PurchaseAnalytics | null): this {
    this.input.purchaseAnalytics = analytics;
    return this;
  }

  withPreferences(preferences: Partial<PreferenceSnapshot>): this {
    this.input.preferences = preferences;
    return this;
  }

  withWeather(weather: Partial<WeatherSnapshot>): this {
    this.input.weather = weather;
    return this;
  }

  withCommute(commute: Partial<CommuteSnapshot>): this {
    this.input.commute = commute;
    return this;
  }

  withSavedOutfits(outfits: readonly SavedOutfitInput[]): this {
    this.input.savedOutfits = outfits;
    return this;
  }

  build(options: BuildOptions = {}): RecommendationContext {
    return buildRecommendationContext(this.input, options);
  }
}
