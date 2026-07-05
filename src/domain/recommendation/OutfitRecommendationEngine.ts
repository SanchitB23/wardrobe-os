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
// Hard eligibility — context constraints applied BEFORE scoring.
// ---------------------------------------------------------------------------

export type OccasionKey = "gym" | "office" | "wedding" | "travel";
type Verdict = "allowed" | "disallowed" | "optional";

const OPTIONAL_SLOTS = new Set<OutfitSlot>(["fragrance", "accessory", "watch", "belt"]);
const REQUIRED_SLOTS: OutfitSlot[] = ["top", "bottom", "footwear"];

const SMART_STYLES = ["smart casual", "business casual", "minimal", "classic", "modern"];
const GYM_SIGNALS = ["gym", "athleisure", "performance", "sport", "sports", "active", "running", "training"];

const KW = {
  tshirt: ["t-shirt", "tshirt", "tee"],
  activeTop: ["tank", "jersey", "active", "performance", "compression"],
  polo: ["polo"],
  chino: ["chino"],
  trouser: ["trouser", "slack", "dress pant"],
  jeans: ["jean", "denim"],
  shorts: ["short"],
  jogger: ["jogger", "sweatpant", "track pant", "trackpant", "track suit"],
  blazer: ["blazer"],
  tux: ["tuxedo", "tux"],
  suit: ["suit"],
  pajama: ["pajama", "pyjama", "lounge", "sleep"],
  dressShoe: ["oxford", "derby", "brogue", "loafer", "monk", "dress shoe", "formal shoe"],
  athleticShoe: ["running", "trainer", "training", "court", "tennis", "basketball", "cleat"],
  sneaker: ["sneaker", "plimsoll", "canvas", "574", "air force", "af1"],
  sandal: ["sandal", "slide", "flip"],
  fragile: ["white", "suede", "canvas", "air force", "af1", "574"],
} as const;

function haystack(item: WardrobeItemSnapshot): string {
  return normalize(`${item.name} ${item.subcategory ?? ""} ${item.category ?? ""}`);
}
function hasKeyword(item: WardrobeItemSnapshot, keywords: readonly string[]): boolean {
  const h = haystack(item);
  return keywords.some((keyword) => h.includes(keyword));
}
function tagStyleSet(item: WardrobeItemSnapshot): string[] {
  return [...item.tags, ...item.styles].map(normalize);
}
function hasGymSignal(item: WardrobeItemSnapshot): boolean {
  const set = tagStyleSet(item);
  return GYM_SIGNALS.some((signal) => set.includes(signal));
}
function isSmartCasualEnough(item: WardrobeItemSnapshot): boolean {
  const set = tagStyleSet(item);
  return (
    item.formality === "smart_casual" ||
    item.formality === "business_casual" ||
    SMART_STYLES.some((style) => set.includes(style))
  );
}
function isTshirt(item: WardrobeItemSnapshot): boolean {
  return hasKeyword(item, KW.tshirt);
}
function formalRank(item: WardrobeItemSnapshot): number {
  return (item.formality ? getFormalityRank(item.formality) : null) ?? -1;
}
const BUSINESS_FORMAL_RANK = getFormalityRank("business_formal") ?? 3;
const SMART_CASUAL_RANK = getFormalityRank("smart_casual") ?? 1;

function classifyGym(item: WardrobeItemSnapshot): Verdict {
  const slot = resolveSlot(item);
  if (OPTIONAL_SLOTS.has(slot)) return "optional";
  const gym = hasGymSignal(item);
  if (slot === "footwear") {
    if (hasKeyword(item, KW.athleticShoe) || gym) return "allowed";
    if (hasKeyword(item, KW.dressShoe) || hasKeyword(item, KW.sandal)) return "disallowed";
    if (hasKeyword(item, KW.sneaker)) return "allowed";
    return "disallowed";
  }
  if (slot === "top") {
    if (hasKeyword(item, KW.activeTop) || gym) return "allowed";
    return "disallowed"; // shirts, polos, plain tees, sweaters
  }
  if (slot === "bottom") {
    if (hasKeyword(item, KW.shorts) || hasKeyword(item, KW.jogger) || gym) return "allowed";
    return "disallowed"; // chinos, trousers, jeans
  }
  return gym ? "allowed" : "disallowed"; // outerwear
}

function classifyOffice(item: WardrobeItemSnapshot): Verdict {
  const slot = resolveSlot(item);
  if (OPTIONAL_SLOTS.has(slot)) return "optional";
  if (hasKeyword(item, KW.pajama)) return "disallowed";
  if (slot === "footwear") {
    if (hasKeyword(item, KW.dressShoe) || hasKeyword(item, KW.sneaker)) return "allowed";
    if (hasKeyword(item, KW.athleticShoe) && !isSmartCasualEnough(item)) return "disallowed";
    if (hasKeyword(item, KW.sandal)) return "disallowed";
    return "allowed";
  }
  if (slot === "top") {
    if (hasKeyword(item, KW.activeTop) || (hasGymSignal(item) && !isSmartCasualEnough(item)))
      return "disallowed";
    if (isTshirt(item)) return isSmartCasualEnough(item) ? "allowed" : "disallowed";
    return "allowed"; // shirts, polos, knit polos, sweaters
  }
  if (slot === "bottom") {
    if (hasKeyword(item, KW.shorts) || hasKeyword(item, KW.jogger)) return "disallowed";
    if (hasGymSignal(item)) return "disallowed";
    if (hasKeyword(item, KW.jeans)) return isSmartCasualEnough(item) ? "allowed" : "disallowed";
    return "allowed"; // chinos, trousers
  }
  if (slot === "outerwear") return hasKeyword(item, KW.tux) ? "disallowed" : "allowed";
  return "optional";
}

function classifyWedding(item: WardrobeItemSnapshot): Verdict {
  const slot = resolveSlot(item);
  if (OPTIONAL_SLOTS.has(slot)) return "optional";
  if (slot === "footwear") {
    return hasKeyword(item, KW.dressShoe) ? "allowed" : "disallowed";
  }
  // Core apparel must be dressy enough for a wedding.
  const dressy = formalRank(item) >= BUSINESS_FORMAL_RANK;
  if (slot === "top") {
    if (isTshirt(item) || hasKeyword(item, KW.polo) || hasKeyword(item, KW.activeTop))
      return "disallowed";
    return dressy || hasKeyword(item, ["shirt"]) ? "allowed" : "disallowed";
  }
  if (slot === "bottom") {
    if (hasKeyword(item, KW.trouser) || dressy) return "allowed";
    return "disallowed"; // chinos, jeans, shorts, joggers
  }
  if (slot === "outerwear") {
    return hasKeyword(item, KW.blazer) || hasKeyword(item, KW.tux) || hasKeyword(item, KW.suit)
      ? "allowed"
      : "disallowed";
  }
  return "optional";
}

const CLASSIFIERS: Record<OccasionKey, ((item: WardrobeItemSnapshot) => Verdict) | null> = {
  gym: classifyGym,
  office: classifyOffice,
  wedding: classifyWedding,
  travel: null, // Travel is soft: prioritized in scoring, never hard-rejected.
};

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

/** Applies hard context constraints. A candidate must be a complete outfit
 *  (top + bottom + footwear) and contain no items disallowed for the occasion. */
function assessEligibility(
  items: readonly WardrobeItemSnapshot[],
  occasionKey: OccasionKey | null,
): Eligibility {
  const reasons: string[] = [];

  const slotsPresent = new Set(items.map(resolveSlot));
  for (const slot of REQUIRED_SLOTS) {
    if (!slotsPresent.has(slot)) reasons.push(`missing ${slot}`);
  }

  const classifier = occasionKey ? CLASSIFIERS[occasionKey] : null;
  if (classifier) {
    for (const item of items) {
      if (classifier(item) === "disallowed") {
        reasons.push(`contains ${item.name} — not suitable for ${occasionKey}`);
      }
    }
  }

  return { rejected: reasons.length > 0, reasons };
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
  const classifier = occasionKey ? CLASSIFIERS[occasionKey] : null;
  const eligible = (item: WardrobeItemSnapshot) =>
    !classifier || classifier(item) !== "disallowed";
  const active = context.wardrobe.activeItems.filter(eligible);
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

  // Rule 6 / 7 — requested occasion match (boost) or soft mismatch (penalty).
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
    } else if (occasionKey && occasionKey !== "travel") {
      // Eligible (passed hard filter) but nothing explicitly tagged for it.
      penalties.push({
        label: `Not tagged for ${options.occasion}`,
        delta: -OCCASION_MISMATCH_PENALTY,
      });
    }
  }

  // Rule 4 (travel) — prioritize comfort & repeatability; avoid fragile shoes
  // when the weather is rough.
  if (occasionKey === "travel") {
    const travelReady = candidate.items.filter((i) =>
      i.tags.some((tag) => ["travel", "vacation"].includes(normalize(tag))),
    ).length;
    const comfortable = candidate.items.every(
      (i) => formalRank(i) <= SMART_CASUAL_RANK,
    );
    if (travelReady > 0 || comfortable) {
      boosts.push({ label: "Travel-friendly & comfortable", delta: TRAVEL_COMFORT_BOOST });
    }
    const roughWeather =
      context.weather.condition === "rainy" || context.weather.condition === "cold";
    const fragileShoe = candidate.items.some(
      (i) => resolveSlot(i) === "footwear" && hasKeyword(i, KW.fragile),
    );
    if (roughWeather && fragileShoe) {
      penalties.push({
        label: "Fragile footwear for rough travel weather",
        delta: -FRAGILE_TRAVEL_PENALTY,
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
