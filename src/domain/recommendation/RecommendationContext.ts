/**
 * Recommendation Context — the single, unified input every recommendation
 * engine will consume.
 *
 * No React, no Supabase, no recommendation logic. This module only defines the
 * shape of the context and its snapshots. A {@link RecommendationContextBuilder}
 * assembles it deterministically from already-fetched domain data, so future
 * engines depend on nothing but the {@link RecommendationContext}.
 */

import type { WardrobeHealth } from "@/domain/analytics/WardrobeHealthEngine";
import type { UsageAnalytics } from "@/domain/analytics/UsageAnalyticsEngine";
// RFC-011: WeatherSnapshot now lives in the weather domain (type-only import,
// no runtime cycle) and is re-exported below for existing consumers.
import type { WeatherSnapshot, WeatherSnapshotSource } from "@/domain/weather/WeatherSnapshot";
import type { StyleDNA } from "@/domain/style-dna";
import type {
  FormalityEnum,
  ItemStatus,
  PurchaseAnalytics,
  UsageFrequency,
} from "@/types/wardrobe";

// ---------------------------------------------------------------------------
// Wardrobe
// ---------------------------------------------------------------------------

/** A single wardrobe item, normalized for recommendation engines. */
export interface WardrobeItemSnapshot {
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  color: string | null;
  /** Coarse colour family (e.g. "navy", "grey"), derived from `color`. */
  colorFamily: string | null;
  brand: string | null;
  formality: FormalityEnum | null;
  usage: UsageFrequency | null;
  rating: number | null;
  status: ItemStatus | null;
  seasons: string[];
  styles: string[];
  tags: string[];
  /** Derived style profile — the lens downstream engines score against. */
  styleDNA: StyleDNA;
}

export interface WardrobeSnapshot {
  /** Every item, sorted by id. */
  items: WardrobeItemSnapshot[];
  /** Active items only (status active/null), sorted by id. */
  activeItems: WardrobeItemSnapshot[];
  totalCount: number;
  activeCount: number;
  /** Distinct active categories / colour families / brands, sorted. */
  categories: string[];
  colorFamilies: string[];
  brands: string[];
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

export interface ItemUsageSnapshot {
  itemId: string;
  wearCount: number;
  lastWornOn: string | null;
  daysSinceLastWorn: number | null;
}

export interface UsageSnapshot {
  totalWears: number;
  /** One entry per wardrobe item, sorted by itemId. */
  perItem: ItemUsageSnapshot[];
  wearCountByItem: Record<string, number>;
  /** Active items with zero wears, sorted by id. */
  neverWornItemIds: string[];
  /** Active items last worn 90+ days ago, sorted by id. */
  staleItemIds: string[];
  /** The full usage analytics report, when available. */
  analytics: UsageAnalytics | null;
}

// ---------------------------------------------------------------------------
// Purchase
// ---------------------------------------------------------------------------

export interface PurchaseSnapshot {
  /** Highest recorded price per item. */
  priceByItem: Record<string, number>;
  totalTrackedValue: number;
  trackedItemIds: string[];
  analytics: PurchaseAnalytics | null;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthSnapshot {
  overallScore: number;
  categoryScores: WardrobeHealth["categoryScores"];
  occasions: WardrobeHealth["occasions"];
  seasons: WardrobeHealth["seasons"];
  gaps: WardrobeHealth["gaps"];
  duplicates: WardrobeHealth["duplicates"];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export type LifestyleProfile = "wfh" | "hybrid" | "office" | "field";

export interface PreferenceSnapshot {
  preferredStyles: string[];
  avoidedColors: string[];
  preferredFormality: FormalityEnum[];
  lifestyle: LifestyleProfile;
  /** Free-form climate tag, e.g. "delhi-ncr". */
  climate: string;
  monthlyBudget: number | null;
}

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

export type SeasonLabel = "summer" | "monsoon" | "autumn" | "winter" | "spring";
export type WeatherCondition =
  | "hot"
  | "warm"
  | "mild"
  | "cool"
  | "cold"
  | "rainy";

// RFC-011: WeatherSnapshot is defined in `@/domain/weather` (enriched with
// feelsLike/rainRisk/wind/uv/labels/confidence/source). Re-exported here so
// existing `@/domain/recommendation` consumers are unaffected.
export type { WeatherSnapshot, WeatherSnapshotSource };

// ---------------------------------------------------------------------------
// Commute
// ---------------------------------------------------------------------------

export type CommuteMode = "wfh" | "metro" | "car" | "walk" | "mixed";

export interface CommuteSnapshot {
  mode: CommuteMode;
  officeDaysPerWeek: number;
  durationMinutes: number | null;
}

// ---------------------------------------------------------------------------
// Saved outfits
// ---------------------------------------------------------------------------

export interface SavedOutfit {
  id: string;
  name: string;
  itemIds: string[];
  score: number | null;
  favorite: boolean;
  lastWornOn: string | null;
}

export interface SavedOutfitSnapshot {
  outfits: SavedOutfit[];
  count: number;
}

// ---------------------------------------------------------------------------
// Personalization (RFC-013) — how recommendation should consume the profile.
// Kept structural (no cross-domain import) so RecommendationContext stays stable.
// ---------------------------------------------------------------------------

export type ExploreExploitMode = "explore" | "balanced" | "exploit";

export interface RecommendationPersonalization {
  /** The owner's explore/exploit setting (default "balanced"). */
  exploreExploit: ExploreExploitMode;
  /** Deterministic weight adjustments derived from the mode (RFC-013). */
  weights?: {
    preferenceFit: number;
    wardrobeHealthContribution: number;
    diversityBias: number;
  };
  /** `dimension:value` (lowercased) → lifecycle, for anti-overfitting nudges. */
  lifecycleByValue?: Record<string, "core" | "emerging" | "declining" | "avoided">;
  /** Net-negative preference values the owner steers away from. */
  avoidedValues?: { dimension: string; value: string }[];
}

// ---------------------------------------------------------------------------
// The context
// ---------------------------------------------------------------------------

export interface RecommendationContext {
  /** ISO timestamp the context was assembled at; drives all time math. */
  generatedAt: string;
  wardrobe: WardrobeSnapshot;
  usage: UsageSnapshot;
  purchase: PurchaseSnapshot;
  health: HealthSnapshot;
  preferences: PreferenceSnapshot;
  weather: WeatherSnapshot;
  commute: CommuteSnapshot;
  savedOutfits: SavedOutfitSnapshot;
  /** RFC-004: items the owner pinned to keep. Never flagged for removal. */
  protectedItemIds: string[];
  /** RFC-004: items the owner wants to avoid. Excluded from recommendations. */
  avoidedItemIds: string[];
  /** RFC-013: optional personalization directives (lifecycle + explore/exploit). */
  personalization?: RecommendationPersonalization;
}

// ---------------------------------------------------------------------------
// Defaults — calibrated to the owner's Delhi NCR smart-casual profile.
// ---------------------------------------------------------------------------

export const DEFAULT_PREFERENCES: PreferenceSnapshot = {
  preferredStyles: [
    "Smart Casual",
    "Modern",
    "Everyday Casual",
    "Classic",
    "Minimal",
  ],
  avoidedColors: [],
  preferredFormality: ["smart_casual", "business_casual", "casual"],
  lifestyle: "hybrid",
  climate: "delhi-ncr",
  monthlyBudget: null,
};

export const DEFAULT_COMMUTE: CommuteSnapshot = {
  mode: "metro",
  officeDaysPerWeek: 2,
  durationMinutes: 45,
};
