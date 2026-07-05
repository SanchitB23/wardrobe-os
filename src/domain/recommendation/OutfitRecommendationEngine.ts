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
  type OutfitAnalysis,
  type OutfitEngineItem,
  type WeatherContext,
} from "@/domain/outfit";
import type { OutfitSlot } from "@/types/wardrobe";
import type { OccasionKey as StyleOccasionKey, SeasonKey } from "@/domain/style-dna";
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

/** An outfit excluded before scoring because it failed context eligibility. */
export interface RejectedOutfit {
  outfitId?: string;
  name: string;
  source: "saved_outfit" | "generated_combo";
  reasons: string[];
}

export interface OutfitRecommendationResult {
  recommendations: OutfitRecommendation[];
  /** Candidates rejected by hard eligibility, with reasons (debug/explain). */
  rejected: RejectedOutfit[];
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
/** Capped so a favorite can nudge, but never override a context mismatch (Rule 6). */
const FAVORITE_BOOST = 0.75;
const OCCASION_MATCH_BOOST = 1.2;
/** Eligible-but-untagged for the requested occasion → medium mismatch penalty (Rule 7). */
const OCCASION_MISMATCH_PENALTY = 1.5;
const SEASON_MATCH_BOOST = 0.8;
const WEATHER_FIT_BOOST = 0.5;
/** Fragile footwear (e.g. white/suede sneakers) in rough weather while travelling. */
const FRAGILE_TRAVEL_PENALTY = 1;
const TRAVEL_COMFORT_BOOST = 0.6;
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
// Item → engine mapping. The slot comes from the item's derived StyleDNA.
// ---------------------------------------------------------------------------

function slotOf(item: WardrobeItemSnapshot): OutfitSlot {
  return item.styleDNA.slot;
}

function toEngineItem(item: WardrobeItemSnapshot): OutfitEngineItem {
  return {
    slot: slotOf(item),
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
    slot: slotOf(item),
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
// Hard eligibility — context constraints applied BEFORE scoring, read entirely
// from each item's derived StyleDNA (its occasion suitability + slot).
// ---------------------------------------------------------------------------

export type OccasionKey = "gym" | "office" | "wedding" | "travel";

const REQUIRED_SLOTS: OutfitSlot[] = ["top", "bottom", "footwear"];
/** Occasions with hard rules; travel stays soft (prioritized in scoring). */
const HARD_OCCASIONS = new Set<OccasionKey>(["gym", "office", "wedding"]);
/** StyleDNA occasion suitability below this reads as "not suitable". */
const ELIGIBILITY_FLOOR = 1;

function resolveOccasionKey(occasion: string | null | undefined): OccasionKey | null {
  const value = normalize(occasion);
  if (!value) return null;
  if (value === "gym" || value === "workout" || value === "fitness") return "gym";
  if (value === "office" || value === "work") return "office";
  if (value === "wedding" || value === "formal") return "wedding";
  if (value === "travel" || value === "vacation") return "travel";
  return null;
}

type Eligibility = { rejected: boolean; reasons: string[] };

/** A candidate must be a complete outfit (top + bottom + footwear) and, for a
 *  hard occasion, contain no item whose StyleDNA rates it unsuitable. */
function assessEligibility(
  items: readonly WardrobeItemSnapshot[],
  occasionKey: OccasionKey | null,
): Eligibility {
  const reasons: string[] = [];

  const slotsPresent = new Set(items.map(slotOf));
  for (const slot of REQUIRED_SLOTS) {
    if (!slotsPresent.has(slot)) reasons.push(`missing ${slot}`);
  }

  if (occasionKey && HARD_OCCASIONS.has(occasionKey)) {
    for (const item of items) {
      if (item.styleDNA.occasion.suitability[occasionKey] < ELIGIBILITY_FLOOR) {
        reasons.push(`contains ${item.name} — not suitable for ${occasionKey}`);
      }
    }
  }

  return { rejected: reasons.length > 0, reasons };
}

function isEligibleItem(
  item: WardrobeItemSnapshot,
  occasionKey: OccasionKey | null,
): boolean {
  if (!occasionKey || !HARD_OCCASIONS.has(occasionKey)) return true;
  return item.styleDNA.occasion.suitability[occasionKey] >= ELIGIBILITY_FLOOR;
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

/** Bounded, deterministic combos from the highest-rated active items per slot.
 *  Items disallowed for the requested occasion are excluded from the pools, so
 *  generated combos are always context-appropriate. */
function generatedCandidates(
  context: RecommendationContext,
  occasionKey: OccasionKey | null,
): Candidate[] {
  const active = context.wardrobe.activeItems.filter((item) =>
    isEligibleItem(item, occasionKey),
  );
  const rank = (items: WardrobeItemSnapshot[]) =>
    [...items]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.id.localeCompare(b.id))
      .slice(0, COMBO_TOP_K);

  const tops = rank(active.filter((i) => slotOf(i) === "top"));
  const bottoms = rank(active.filter((i) => slotOf(i) === "bottom"));
  const footwear = rank(active.filter((i) => slotOf(i) === "footwear"));
  if (tops.length === 0 || bottoms.length === 0 || footwear.length === 0) {
    return [];
  }

  const wantsOuter =
    context.weather.season === "winter" ||
    context.weather.condition === "cold" ||
    context.weather.condition === "cool";
  const outerwear = wantsOuter
    ? rank(active.filter((i) => slotOf(i) === "outerwear")).slice(0, 1)
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

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Maps a requested occasion label to the StyleDNA occasion key used for scoring. */
function resolveStyleOccasion(
  occasion: string | null | undefined,
): StyleOccasionKey | null {
  const value = normalize(occasion);
  if (!value) return null;
  if (["gym", "workout", "fitness"].includes(value)) return "gym";
  if (["office", "work"].includes(value)) return "office";
  if (["wedding", "formal"].includes(value)) return "wedding";
  if (["travel", "vacation"].includes(value)) return "travel";
  if (["dinner", "date", "brewery", "party", "brunch", "social"].includes(value)) return "social";
  if (["home", "loungewear"].includes(value)) return "home";
  if (["smart casual", "smartcasual"].includes(value)) return "smartCasual";
  if (["casual", "everyday"].includes(value)) return "casual";
  return null;
}

function scoreCandidate(
  candidate: Candidate,
  context: RecommendationContext,
  options: RecommendOutfitsOptions,
  asOf: Date,
  occasionKey: OccasionKey | null,
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

  // Rule 6 / 7 — occasion fit, read from each item's StyleDNA suitability.
  const styleOccasion = resolveStyleOccasion(options.occasion);
  if (styleOccasion) {
    const core = candidate.items.filter((i) =>
      ["top", "bottom", "footwear", "outerwear"].includes(i.styleDNA.slot),
    );
    const suitability = mean(
      (core.length > 0 ? core : candidate.items).map(
        (i) => i.styleDNA.occasion.suitability[styleOccasion],
      ),
    );
    if (suitability >= 7) {
      boosts.push({
        label: `Matches ${options.occasion} occasion`,
        delta: round1(OCCASION_MATCH_BOOST * (suitability / 10)),
      });
    } else if (occasionKey && occasionKey !== "travel" && suitability < 4) {
      penalties.push({
        label: `Weak fit for ${options.occasion}`,
        delta: -OCCASION_MISMATCH_PENALTY,
      });
    }
  }

  // Rule 4 (travel) — StyleDNA travel-friendliness; avoid fragile shoes in
  // rough weather.
  if (occasionKey === "travel") {
    const travelFit = mean(
      candidate.items.map((i) => i.styleDNA.compatibility.travelFriendliness),
    );
    if (travelFit >= 6) {
      boosts.push({ label: "Travel-friendly & comfortable", delta: TRAVEL_COMFORT_BOOST });
    }
    const roughWeather =
      context.weather.condition === "rainy" || context.weather.condition === "cold";
    const fragileShoe = candidate.items.some(
      (i) => i.styleDNA.slot === "footwear" && i.styleDNA.compatibility.travelFriendliness <= 3,
    );
    if (roughWeather && fragileShoe) {
      penalties.push({
        label: "Fragile footwear for rough travel weather",
        delta: -FRAGILE_TRAVEL_PENALTY,
      });
    }
  }

  // Rule 7 — season / weather compatibility, from StyleDNA weather suitability.
  const seasonKey = context.weather.season as SeasonKey;
  const seasonFit = mean(
    candidate.items.map((i) => i.styleDNA.weather.suitability[seasonKey]),
  );
  if (candidate.items.length > 0 && seasonFit >= 6) {
    boosts.push({
      label: `Suited to ${context.weather.season}`,
      delta: round1(SEASON_MATCH_BOOST * (seasonFit / 10)),
    });
  }
  if ((analysis.breakdown.weather?.score ?? 0) >= 7) {
    boosts.push({ label: "Weather-appropriate", delta: WEATHER_FIT_BOOST });
  }

  // Rule 8 — commute compatibility, from StyleDNA commute-friendliness.
  if (context.commute.mode !== "wfh") {
    const commuteFit = mean(
      candidate.items.map((i) => i.styleDNA.compatibility.commuteFriendliness),
    );
    if (commuteFit >= 6) {
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
 * Produces ranked recommendations plus the candidates rejected by hard
 * eligibility (with reasons, for debug/explanation). Candidates that fail
 * eligibility — incomplete outfits, or items disallowed for the requested
 * occasion — are excluded before scoring, so a favorite can never rescue a
 * context mismatch. Saved outfits are considered first (Rule 1); generated
 * combos only fill remaining slots. Deterministic given the same input.
 */
export function generateOutfitRecommendations(
  context: RecommendationContext,
  options: RecommendOutfitsOptions = {},
): OutfitRecommendationResult {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const asOf = parseDate(context.generatedAt) ?? new Date(0);
  const occasionKey = resolveOccasionKey(options.occasion);

  const rejected: RejectedOutfit[] = [];
  const accept = (candidate: Candidate): OutfitRecommendation | null => {
    const eligibility = assessEligibility(candidate.items, occasionKey);
    if (eligibility.rejected) {
      rejected.push({
        outfitId: candidate.outfitId,
        name: candidate.name,
        source: candidate.source,
        reasons: eligibility.reasons.map((reason) => `Rejected: ${reason}`),
      });
      return null;
    }
    return scoreCandidate(candidate, context, options, asOf, occasionKey);
  };

  const saved = savedCandidates(context)
    .map(accept)
    .filter((rec): rec is OutfitRecommendation => rec !== null)
    .sort(compareRecommendations);

  const fillers: OutfitRecommendation[] = [];
  if (saved.length < limit) {
    const generated = generatedCandidates(context, occasionKey)
      .map(accept)
      .filter((rec): rec is OutfitRecommendation => rec !== null)
      .sort(compareRecommendations);

    // De-duplicate generated combos that share the exact item set.
    const seen = new Set<string>();
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
  }

  return {
    recommendations: [...saved, ...fillers].slice(0, limit),
    rejected,
  };
}

/**
 * Convenience wrapper returning only the ranked recommendations. Use
 * {@link generateOutfitRecommendations} when you also need the rejection
 * reasons (debug mode).
 */
export function recommendOutfits(
  context: RecommendationContext,
  options: RecommendOutfitsOptions = {},
): OutfitRecommendation[] {
  return generateOutfitRecommendations(context, options).recommendations;
}
