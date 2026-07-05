/**
 * Outfit Generation Engine — builds entirely new outfits from wardrobe items.
 *
 * No React, no Supabase, no AI. Given a {@link RecommendationContext} it filters
 * the wardrobe by context, generates candidate slot combinations, rejects
 * impossible ones (e.g. formal shirt + gym shorts), scores the rest with the
 * rule-based {@link evaluateOutfit} engine, removes near-duplicates, and returns
 * the top N. Deterministic and bounded for performance (<500ms for 200 items).
 */

import {
  evaluateOutfit,
  type OutfitAnalysis,
  type OutfitEngineItem,
  type WeatherContext,
} from "@/domain/outfit";
import type { FormalityEnum, OutfitSlot } from "@/types/wardrobe";
import type { OccasionKey as StyleOccasionKey } from "@/domain/style-dna";
import type {
  RecommendationContext,
  WardrobeItemSnapshot,
  WeatherSnapshot,
} from "@/domain/recommendation/RecommendationContext";

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface GeneratedItemRef {
  itemId: string;
  name: string;
  slot: OutfitSlot;
  category: string | null;
}

export interface GeneratedOutfitItems {
  top: GeneratedItemRef;
  bottom: GeneratedItemRef;
  footwear: GeneratedItemRef;
  outerwear?: GeneratedItemRef;
  watch?: GeneratedItemRef;
  belt?: GeneratedItemRef;
  fragrance?: GeneratedItemRef;
  accessory?: GeneratedItemRef;
}

export interface GeneratedOutfit {
  items: GeneratedOutfitItems;
  analysis: OutfitAnalysis;
  score: number;
  confidence: number;
  source: "generated";
  reasoning: string[];
  rejectedAlternatives: string[];
}

export interface GenerateOutfitsOptions {
  /** Requested occasion to build for (e.g. "Office", "Gym"). */
  occasion?: string | null;
  /** Max outfits to return. */
  limit?: number;
}

export const OUTFIT_GENERATION_ENGINE_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Tunables (bounded for the <500ms / 200-item performance target)
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 10;
/** Highest-ranked items kept per slot before combining. */
const POOL_LIMIT = 6;
/** Hard cap on combinations scored with evaluateOutfit. */
const MAX_SCORED = 400;
/** Formality spread (0–4 ranks) at or above which a combination is impossible. */
const IMPOSSIBLE_FORMALITY_SPREAD = 3;
/** StyleDNA occasion suitability below this excludes an item for that occasion. */
const ELIGIBILITY_FLOOR = 1;
const MAX_REJECTED_SHOWN = 8;

const FORMALITY_RANK: Record<FormalityEnum, number> = {
  casual: 0,
  smart_casual: 1,
  business_casual: 2,
  business_formal: 3,
  formal: 4,
};

const HARD_STYLE_OCCASIONS = new Set<StyleOccasionKey>([
  "gym",
  "office",
  "wedding",
  "social",
]);

function clamp0To10(value: number): number {
  return Math.max(0, Math.min(10, value));
}
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}
function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function slotOf(item: WardrobeItemSnapshot): OutfitSlot {
  return item.styleDNA.slot;
}
function formalityRank(item: WardrobeItemSnapshot): number {
  return item.formality ? FORMALITY_RANK[item.formality] : 1;
}

function resolveStyleOccasion(
  occasion: string | null | undefined,
): StyleOccasionKey | null {
  const value = normalize(occasion);
  if (!value) return null;
  if (["gym", "workout", "fitness"].includes(value)) return "gym";
  if (["office", "work"].includes(value)) return "office";
  if (["wedding", "formal"].includes(value)) return "wedding";
  if (["dinner", "date", "brewery", "party", "social"].includes(value)) return "social";
  if (["travel", "vacation"].includes(value)) return "travel";
  if (["smart casual", "smartcasual"].includes(value)) return "smartCasual";
  if (["home", "loungewear"].includes(value)) return "home";
  if (["casual", "everyday"].includes(value)) return "casual";
  return null;
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
function toRef(item: WardrobeItemSnapshot): GeneratedItemRef {
  return { itemId: item.id, name: item.name, slot: slotOf(item), category: item.category };
}
function toWeatherContext(weather: WeatherSnapshot): WeatherContext {
  return {
    temperatureC: weather.temperatureC ?? 25,
    precipitation: weather.condition === "rainy" ? "heavy" : "none",
    wind: "calm",
  };
}

/** Coarse footwear class for near-duplicate detection (two casual sneakers of
 *  different brands read as the same). */
function footwearClass(item: WardrobeItemSnapshot): string {
  const h = normalize(`${item.name} ${item.subcategory ?? ""}`);
  if (["oxford", "derby", "brogue", "loafer", "monk", "dress"].some((k) => h.includes(k)))
    return "dress";
  if (["sneaker", "trainer", "running", "court", "canvas", "air force", "af1", "574"].some((k) => h.includes(k)))
    return "sneaker";
  if (["boot", "chukka", "chelsea"].some((k) => h.includes(k))) return "boot";
  if (["sandal", "slide", "flip"].some((k) => h.includes(k))) return "sandal";
  return `f-${item.formality ?? "na"}`;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

type Combo = {
  top: WardrobeItemSnapshot;
  bottom: WardrobeItemSnapshot;
  footwear: WardrobeItemSnapshot;
  outerwear?: WardrobeItemSnapshot;
};

/** Ranks a slot's items by context fit (occasion suitability + versatility +
 *  rating) and keeps the strongest `POOL_LIMIT`. */
function rankPool(
  items: WardrobeItemSnapshot[],
  styleOccasion: StyleOccasionKey | null,
): WardrobeItemSnapshot[] {
  const value = (item: WardrobeItemSnapshot): number => {
    const occ = styleOccasion ? item.styleDNA.occasion.suitability[styleOccasion] : 5;
    return occ + item.styleDNA.compatibility.versatility + (item.rating ?? 0);
  };
  return [...items]
    .sort((a, b) => value(b) - value(a) || a.id.localeCompare(b.id))
    .slice(0, POOL_LIMIT);
}

/** Cross-item impossibility: an extreme formality spread across core pieces. */
function comboRejectionReason(combo: Combo): string | null {
  const core = [combo.top, combo.bottom, combo.footwear];
  if (combo.outerwear) core.push(combo.outerwear);
  const ranks = core.map(formalityRank);
  const spread = Math.max(...ranks) - Math.min(...ranks);
  if (spread >= IMPOSSIBLE_FORMALITY_SPREAD) {
    return `${combo.top.name} + ${combo.bottom.name} + ${combo.footwear.name} — formality clash`;
  }
  return null;
}

function comboItems(combo: Combo): WardrobeItemSnapshot[] {
  const items = [combo.top, combo.bottom, combo.footwear];
  if (combo.outerwear) items.push(combo.outerwear);
  return items;
}

function contextScore(
  combo: Combo,
  context: RecommendationContext,
  styleOccasion: StyleOccasionKey | null,
): number {
  const items = comboItems(combo);
  const seasonKey = context.weather.season;
  const seasonFit = mean(items.map((i) => i.styleDNA.weather.suitability[seasonKey]));
  const occasionFit = styleOccasion
    ? mean(items.map((i) => i.styleDNA.occasion.suitability[styleOccasion]))
    : seasonFit;
  const commuteFit =
    context.commute.mode === "wfh"
      ? 7
      : mean(items.map((i) => i.styleDNA.compatibility.commuteFriendliness));
  return mean([occasionFit, seasonFit, commuteFit]);
}

function buildReasoning(
  analysis: OutfitAnalysis,
  combo: Combo,
  context: RecommendationContext,
  styleOccasion: StyleOccasionKey | null,
  options: GenerateOutfitsOptions,
): string[] {
  const reasoning: string[] = [];
  const label = options.occasion ? options.occasion.toLowerCase() : "everyday";
  reasoning.push(`Fresh ${label} pairing generated from your wardrobe.`);

  if (styleOccasion) {
    const occFit = mean(
      comboItems(combo).map((i) => i.styleDNA.occasion.suitability[styleOccasion]),
    );
    if (occFit >= 7) reasoning.push(`Well suited to ${options.occasion}.`);
  }
  const seasonFit = mean(
    comboItems(combo).map((i) => i.styleDNA.weather.suitability[context.weather.season]),
  );
  if (seasonFit >= 7) reasoning.push(`Season-appropriate for ${context.weather.season}.`);

  for (const strength of analysis.strengths.slice(0, 2)) reasoning.push(strength);
  return reasoning;
}

/**
 * Generates up to `limit` new outfits from the wardrobe in the context.
 * Deterministic; bounded per-slot pools keep it well under the 500ms budget.
 */
export function generateOutfits(
  context: RecommendationContext,
  options: GenerateOutfitsOptions = {},
): GeneratedOutfit[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const styleOccasion = resolveStyleOccasion(options.occasion);
  const generatedAt = context.generatedAt;

  // 1. Filter wardrobe by context (occasion eligibility for hard occasions).
  const eligible = context.wardrobe.activeItems.filter((item) => {
    if (!styleOccasion || !HARD_STYLE_OCCASIONS.has(styleOccasion)) return true;
    return item.styleDNA.occasion.suitability[styleOccasion] >= ELIGIBILITY_FLOOR;
  });

  const tops = rankPool(eligible.filter((i) => slotOf(i) === "top"), styleOccasion);
  const bottoms = rankPool(eligible.filter((i) => slotOf(i) === "bottom"), styleOccasion);
  const footwear = rankPool(eligible.filter((i) => slotOf(i) === "footwear"), styleOccasion);
  if (tops.length === 0 || bottoms.length === 0 || footwear.length === 0) {
    return [];
  }

  const wantsOuter =
    context.weather.season === "winter" ||
    context.weather.condition === "cold" ||
    context.weather.condition === "cool";
  const outerwearOptions: (WardrobeItemSnapshot | undefined)[] = [undefined];
  if (wantsOuter) {
    const outer = rankPool(eligible.filter((i) => slotOf(i) === "outerwear"), styleOccasion);
    if (outer[0]) outerwearOptions.push(outer[0]);
  }

  // 2. Generate candidate combinations; 3. reject impossible ones.
  const combos: Combo[] = [];
  const rejected: string[] = [];
  for (const top of tops) {
    for (const bottom of bottoms) {
      for (const shoe of footwear) {
        for (const outerwear of outerwearOptions) {
          const combo: Combo = { top, bottom, footwear: shoe, outerwear };
          const reason = comboRejectionReason(combo);
          if (reason) {
            rejected.push(reason);
            continue;
          }
          combos.push(combo);
        }
      }
    }
  }

  // Cap the number scored (cheap pre-rank by context fit) to stay within budget.
  const capped = combos
    .map((combo) => ({ combo, pre: contextScore(combo, context, styleOccasion) }))
    .sort((a, b) => b.pre - a.pre)
    .slice(0, MAX_SCORED);

  // 4. Score the survivors with the rule-based engine + context fit.
  const scored = capped.map(({ combo }) => {
    const analysis = evaluateOutfit(
      {
        items: comboItems(combo).map(toEngineItem),
        context: {
          targetOccasion: options.occasion ?? null,
          targetSeason: context.weather.season,
          weather: toWeatherContext(context.weather),
        },
      },
      { generatedAt },
    );
    const score = round1(
      clamp0To10(analysis.overallScore * 0.65 + contextScore(combo, context, styleOccasion) * 0.035 * 10),
    );
    return { combo, analysis, score };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.analysis.confidence - a.analysis.confidence ||
      a.combo.top.id.localeCompare(b.combo.top.id),
  );

  // 6. Remove near-duplicates (same top + bottom + footwear class).
  const seen = new Set<string>();
  const rejectedAlternatives = Array.from(new Set(rejected))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, MAX_REJECTED_SHOWN);

  const results: GeneratedOutfit[] = [];
  for (const { combo, analysis, score } of scored) {
    const signature = `${combo.top.id}|${combo.bottom.id}|${footwearClass(combo.footwear)}`;
    if (seen.has(signature)) continue;
    seen.add(signature);

    const items: GeneratedOutfitItems = {
      top: toRef(combo.top),
      bottom: toRef(combo.bottom),
      footwear: toRef(combo.footwear),
    };
    if (combo.outerwear) items.outerwear = toRef(combo.outerwear);

    results.push({
      items,
      analysis,
      score,
      confidence: analysis.confidence,
      source: "generated",
      reasoning: buildReasoning(analysis, combo, context, styleOccasion, options),
      rejectedAlternatives,
    });
    if (results.length >= limit) break;
  }

  return results;
}
