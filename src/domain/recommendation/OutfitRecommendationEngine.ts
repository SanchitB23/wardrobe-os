/**
 * Outfit Recommendation Engine — ranks outfit recommendations from a
 * {@link RecommendationContext}.
 *
 * No React, no Supabase, no AI. It scores saved outfits with the existing
 * rule-based {@link evaluateOutfit} engine, then layers deterministic
 * context adjustments (recency, staleness, favorites, occasion, weather,
 * commute). When there aren't enough saved outfits, it fills the list with
 * generated combinations from the active wardrobe. Fully deterministic — all
 * time math and metadata derive from `context.generatedAt`.
 */

import {
  evaluateOutfit,
  getFormalityRank,
  OUTFIT_SLOT_DEFINITIONS,
  categoryMatchesOutfitSlot,
  type OutfitAnalysis,
  type OutfitEngineItem,
  type WeatherContext,
} from "@/domain/outfit";
import type { FormalityEnum, OutfitSlot } from "@/types/wardrobe";
import type {
  RecommendationContext,
  WardrobeItemSnapshot,
  WeatherSnapshot,
} from "@/domain/recommendation/RecommendationContext";

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface RecommendedOutfitItem {
  itemId: string;
  name: string;
  slot: OutfitSlot;
  category: string | null;
}

export interface OutfitRecommendation {
  outfitId?: string;
  name: string;
  items: RecommendedOutfitItem[];
  score: number;
  confidence: number;
  analysis: OutfitAnalysis;
  reason: string;
  strengths: string[];
  tradeoffs: string[];
  suggestions: string[];
  metadata: {
    generatedAt: string;
    engineVersion: string;
    source: "saved_outfit" | "generated_combo";
  };
}

export interface RecommendOutfitsOptions {
  /** Requested occasion to bias toward (e.g. "Office", "Dinner"). */
  occasion?: string | null;
  /** Max recommendations to return. */
  limit?: number;
}

export const OUTFIT_RECOMMENDATION_ENGINE_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Tunables (all adjustments are in 0–10 score space)
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 5;
const RECENT_WEAR_DAYS = 7;
const SOFT_RECENT_DAYS = 21;
const HARD_RECENT_PENALTY = 1.5;
const SOFT_RECENT_PENALTY = 0.6;
const STALE_ITEM_PENALTY_EACH = 0.4;
const STALE_PENALTY_CAP = 1.5;
const RETIRED_ITEM_PENALTY = 3;
const FAVORITE_BOOST = 1;
const OCCASION_MATCH_BOOST = 1.2;
const SEASON_MATCH_BOOST = 0.8;
const WEATHER_FIT_BOOST = 0.5;
const COMMUTE_BOOST = 0.6;
/** Top-K items per slot considered when generating fallback combos. */
const COMBO_TOP_K = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp0To10(value: number): number {
  return Math.max(0, Math.min(10, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function parseDate(value: string): Date | null {
  const raw = value.length === 10 ? `${value}T00:00:00Z` : value;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

// ---------------------------------------------------------------------------
// Item → engine mapping
// ---------------------------------------------------------------------------

function resolveSlot(item: WardrobeItemSnapshot): OutfitSlot {
  const haystack = `${item.category ?? ""} ${item.subcategory ?? ""}`;
  for (const definition of OUTFIT_SLOT_DEFINITIONS) {
    if (
      categoryMatchesOutfitSlot(item.category, definition.slot) ||
      categoryMatchesOutfitSlot(haystack, definition.slot)
    ) {
      return definition.slot;
    }
  }
  return "accessory";
}

function toEngineItem(item: WardrobeItemSnapshot): OutfitEngineItem {
  return {
    slot: resolveSlot(item),
    name: item.name,
    formality: item.formality,
    colorHex: null,
    colorName: item.color,
    seasonTags: item.seasons,
    occasionTags: item.tags,
    material: null,
    rating: item.rating,
  };
}

function toRecommendedItem(item: WardrobeItemSnapshot): RecommendedOutfitItem {
  return {
    itemId: item.id,
    name: item.name,
    slot: resolveSlot(item),
    category: item.category,
  };
}

function toWeatherContext(weather: WeatherSnapshot): WeatherContext {
  return {
    temperatureC: weather.temperatureC ?? 25,
    precipitation: weather.condition === "rainy" ? "heavy" : "none",
    wind: "calm",
  };
}

// ---------------------------------------------------------------------------
// Candidate assembly
// ---------------------------------------------------------------------------

type Candidate = {
  source: "saved_outfit" | "generated_combo";
  outfitId?: string;
  name: string;
  items: WardrobeItemSnapshot[];
  favorite: boolean;
  lastWornOn: string | null;
};

function savedCandidates(context: RecommendationContext): Candidate[] {
  const byId = new Map(context.wardrobe.items.map((item) => [item.id, item]));
  return context.savedOutfits.outfits
    .map((outfit) => {
      const items = outfit.itemIds
        .map((id) => byId.get(id))
        .filter((item): item is WardrobeItemSnapshot => Boolean(item));
      return {
        source: "saved_outfit" as const,
        outfitId: outfit.id,
        name: outfit.name,
        items,
        favorite: outfit.favorite,
        lastWornOn: outfit.lastWornOn,
      };
    })
    .filter((candidate) => candidate.items.length > 0);
}

/** Bounded, deterministic combos from the highest-rated active items per slot. */
function generatedCandidates(context: RecommendationContext): Candidate[] {
  const active = context.wardrobe.activeItems;
  const rank = (items: WardrobeItemSnapshot[]) =>
    [...items]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.id.localeCompare(b.id))
      .slice(0, COMBO_TOP_K);

  const tops = rank(active.filter((i) => resolveSlot(i) === "top"));
  const bottoms = rank(active.filter((i) => resolveSlot(i) === "bottom"));
  const footwear = rank(active.filter((i) => resolveSlot(i) === "footwear"));
  if (tops.length === 0 || bottoms.length === 0 || footwear.length === 0) {
    return [];
  }

  const wantsOuter =
    context.weather.season === "winter" ||
    context.weather.condition === "cold" ||
    context.weather.condition === "cool";
  const outerwear = wantsOuter
    ? rank(active.filter((i) => resolveSlot(i) === "outerwear")).slice(0, 1)
    : [];

  const candidates: Candidate[] = [];
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of footwear) {
        const items = [top, bottom, shoe, ...outerwear];
        candidates.push({
          source: "generated_combo",
          name: `Fresh combo: ${top.name} + ${bottom.name}`,
          items,
          favorite: false,
          lastWornOn: null,
        });
      }
    }
  }
  return candidates;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

type Adjustment = { label: string; delta: number };

const COMMUTE_FRIENDLY_MAX_RANK = getFormalityRank("business_casual") ?? 2;

function scoreCandidate(
  candidate: Candidate,
  context: RecommendationContext,
  options: RecommendOutfitsOptions,
  asOf: Date,
): OutfitRecommendation {
  const generatedAt = context.generatedAt;
  const analysis = evaluateOutfit(
    {
      items: candidate.items.map(toEngineItem),
      context: {
        targetOccasion: options.occasion ?? null,
        targetSeason: context.weather.season,
        weather: toWeatherContext(context.weather),
      },
    },
    { generatedAt },
  );

  const boosts: Adjustment[] = [];
  const penalties: Adjustment[] = [];
  const staleSet = new Set(context.usage.staleItemIds);

  // Rule 3 — recently worn (saved outfits carry a wear date).
  if (candidate.lastWornOn) {
    const wornDate = parseDate(candidate.lastWornOn);
    if (wornDate) {
      const days = daysBetween(wornDate, asOf);
      if (days <= RECENT_WEAR_DAYS) {
        penalties.push({ label: `Worn ${days} days ago`, delta: -HARD_RECENT_PENALTY });
      } else if (days <= SOFT_RECENT_DAYS) {
        penalties.push({ label: `Worn ${days} days ago`, delta: -SOFT_RECENT_PENALTY });
      }
    }
  }

  // Rule 4 — stale / retired items.
  const retiredCount = candidate.items.filter((i) => i.status === "retired").length;
  if (retiredCount > 0) {
    penalties.push({
      label: `${retiredCount} retired item${retiredCount === 1 ? "" : "s"}`,
      delta: -RETIRED_ITEM_PENALTY,
    });
  }
  const staleCount = candidate.items.filter((i) => staleSet.has(i.id)).length;
  if (staleCount > 0) {
    penalties.push({
      label: `${staleCount} stale item${staleCount === 1 ? "" : "s"}`,
      delta: -Math.min(STALE_PENALTY_CAP, staleCount * STALE_ITEM_PENALTY_EACH),
    });
  }

  // Rule 5 — favorite outfits.
  if (candidate.favorite) {
    boosts.push({ label: "Favorite outfit", delta: FAVORITE_BOOST });
  }

  // Rule 6 — requested occasion match.
  const occasion = normalize(options.occasion);
  if (occasion) {
    const matching = candidate.items.filter((i) =>
      i.tags.some((tag) => normalize(tag) === occasion),
    ).length;
    if (matching > 0) {
      const share = matching / candidate.items.length;
      boosts.push({
        label: `Matches ${options.occasion} occasion`,
        delta: round1(OCCASION_MATCH_BOOST * Math.min(1, share + 0.4)),
      });
    }
  }

  // Rule 7 — season / weather compatibility.
  const season = normalize(context.weather.season);
  const seasonMatches = candidate.items.filter((i) =>
    i.seasons.some((s) => {
      const n = normalize(s);
      return n === season || n === "year round" || n === "all season";
    }),
  ).length;
  if (candidate.items.length > 0 && seasonMatches > 0) {
    const share = seasonMatches / candidate.items.length;
    boosts.push({
      label: `Suited to ${context.weather.season}`,
      delta: round1(SEASON_MATCH_BOOST * share),
    });
  }
  if ((analysis.breakdown.weather?.score ?? 0) >= 7) {
    boosts.push({ label: "Weather-appropriate", delta: WEATHER_FIT_BOOST });
  }

  // Rule 8 — commute compatibility.
  if (context.commute.mode !== "wfh") {
    const maxRank = candidate.items.reduce((peak, item) => {
      const rank = item.formality ? getFormalityRank(item.formality) : null;
      return rank !== null && rank !== undefined ? Math.max(peak, rank) : peak;
    }, 0);
    if (maxRank > 0 && maxRank <= COMMUTE_FRIENDLY_MAX_RANK) {
      boosts.push({
        label: `Comfortable for ${context.commute.mode} commute`,
        delta: COMMUTE_BOOST,
      });
    }
  }

  const totalDelta =
    boosts.reduce((sum, b) => sum + b.delta, 0) +
    penalties.reduce((sum, p) => sum + p.delta, 0);
  const score = round1(clamp0To10(analysis.overallScore + totalDelta));
  const confidence =
    candidate.source === "generated_combo"
      ? round1(analysis.confidence * 0.9)
      : analysis.confidence;

  const strengths = [
    ...boosts.map((b) => b.label),
    ...analysis.strengths.slice(0, 2),
  ];
  const tradeoffs = [
    ...penalties.map((p) => p.label),
    ...analysis.weaknesses.slice(0, 2),
  ];
  const suggestions = analysis.suggestions.slice(0, 3);

  const topBoost = [...boosts].sort((a, b) => b.delta - a.delta)[0];
  const topPenalty = [...penalties].sort((a, b) => a.delta - b.delta)[0];
  const primary =
    topBoost?.label ??
    (candidate.source === "generated_combo"
      ? "a fresh pairing from your wardrobe"
      : "a solid all-round match");
  const caveat = topPenalty ? `, though ${topPenalty.label.toLowerCase()}` : "";
  const reason = `Scored ${score.toFixed(1)}/10 — ${primary}${caveat}.`;

  return {
    outfitId: candidate.outfitId,
    name: candidate.name,
    items: candidate.items.map(toRecommendedItem),
    score,
    confidence,
    analysis,
    reason,
    strengths,
    tradeoffs,
    suggestions,
    metadata: {
      generatedAt,
      engineVersion: OUTFIT_RECOMMENDATION_ENGINE_VERSION,
      source: candidate.source,
    },
  };
}

function compareRecommendations(
  a: OutfitRecommendation,
  b: OutfitRecommendation,
): number {
  // Saved outfits win ties over generated combos.
  const sourceRank = (r: OutfitRecommendation) =>
    r.metadata.source === "saved_outfit" ? 0 : 1;
  return (
    b.score - a.score ||
    b.confidence - a.confidence ||
    sourceRank(a) - sourceRank(b) ||
    a.name.localeCompare(b.name)
  );
}

/**
 * Produces up to `limit` ranked {@link OutfitRecommendation}s from the context.
 * Saved outfits are considered first (Rule 1); generated combos only fill the
 * remaining slots. Deterministic given the same context and options.
 */
export function recommendOutfits(
  context: RecommendationContext,
  options: RecommendOutfitsOptions = {},
): OutfitRecommendation[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const asOf = parseDate(context.generatedAt) ?? new Date(0);

  const saved = savedCandidates(context)
    .map((candidate) => scoreCandidate(candidate, context, options, asOf))
    .sort(compareRecommendations);

  if (saved.length >= limit) {
    return saved.slice(0, limit);
  }

  const generated = generatedCandidates(context)
    .map((candidate) => scoreCandidate(candidate, context, options, asOf))
    .sort(compareRecommendations);

  // De-duplicate generated combos that share the exact item set.
  const seen = new Set<string>();
  const fillers: OutfitRecommendation[] = [];
  for (const rec of generated) {
    const key = rec.items
      .map((item) => item.itemId)
      .sort((a, b) => a.localeCompare(b))
      .join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    fillers.push(rec);
    if (saved.length + fillers.length >= limit) break;
  }

  return [...saved, ...fillers].slice(0, limit);
}
