/**
 * Unified Outfit Recommendation Engine — returns the best outfits regardless of
 * source, merging saved-outfit recommendations with freshly generated combos.
 *
 * No React, no Supabase, no AI. It runs the saved-outfit engine
 * ({@link generateOutfitRecommendations}) and the generation engine
 * ({@link generateOutfits}), re-scores every candidate on one shared scale so
 * the two sources are directly comparable, merges and de-duplicates them, and
 * returns the top N. Deterministic.
 */

import { generateOutfits } from "@/domain/generation/OutfitGenerationEngine";
import {
  generateOutfitRecommendations,
  type OutfitRecommendation,
  type RecommendedOutfitItem,
} from "@/domain/recommendation/OutfitRecommendationEngine";
import type {
  RecommendationContext,
  WardrobeItemSnapshot,
} from "@/domain/recommendation/RecommendationContext";
import type { OutfitAnalysis } from "@/domain/outfit";
import type { OccasionKey as StyleOccasionKey } from "@/domain/style-dna";

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface UnifiedOutfitRecommendation {
  id: string;
  source: "saved_outfit" | "generated_combo";
  savedOutfitId?: string;
  name: string;
  items: RecommendedOutfitItem[];
  score: number;
  confidence: number;
  analysis: OutfitAnalysis;
  reason: string;
  strengths: string[];
  tradeoffs: string[];
  suggestions: string[];
  debug?: {
    savedOutfitScore?: number;
    generatedScore?: number;
    sourceRank: number;
    rejectionReasons?: string[];
    penalties?: string[];
    boosts?: string[];
  };
  metadata: {
    generatedAt: string;
    engineVersion: string;
  };
}

export interface UnifiedOptions {
  occasion?: string | null;
  limit?: number;
  /**
   * Opt-in (RFC-004): when true, outfits aligned with the learned preferences in
   * `context.preferences` (styles / formality) get a small score bonus. Off by
   * default so existing behaviour is unchanged unless a caller passes a derived
   * profile in.
   */
  usePreferences?: boolean;
}

export const UNIFIED_OUTFIT_ENGINE_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Tunables — one shared scoring model for both sources.
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 5;
/** How many candidates to pull from each sub-engine before merging. */
const PER_SOURCE_LIMIT = 10;
/** Shared score = base analysis × 0.7 + context fit × 0.3, plus saved-only extras. */
const BASE_WEIGHT = 0.7;
const CONTEXT_WEIGHT = 0.3;
/** When two duplicate candidates score within this, prefer the saved one. */
const CLOSE_SCORE = 0.75;
/** Max bonus (on the 0–10 scale) for alignment with learned preferences (RFC-004). */
const PREFERENCE_BONUS = 0.6;

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

const CORE_SLOTS = ["top", "bottom", "footwear", "outerwear"];

/** Context fit (0–10) from the StyleDNA of the outfit's core items. */
function contextFit(
  items: readonly RecommendedOutfitItem[],
  context: RecommendationContext,
  styleOccasion: StyleOccasionKey | null,
  byId: Map<string, WardrobeItemSnapshot>,
): number {
  const core = items
    .map((item) => byId.get(item.itemId))
    .filter((snap): snap is WardrobeItemSnapshot => Boolean(snap))
    .filter((snap) => CORE_SLOTS.includes(snap.styleDNA.slot));
  if (core.length === 0) return 5;

  const seasonKey = context.weather.season;
  const seasonFit = mean(core.map((s) => s.styleDNA.weather.suitability[seasonKey]));
  const occasionFit = styleOccasion
    ? mean(core.map((s) => s.styleDNA.occasion.suitability[styleOccasion]))
    : seasonFit;
  const commuteFit =
    context.commute.mode === "wfh"
      ? 7
      : mean(core.map((s) => s.styleDNA.compatibility.commuteFriendliness));
  return mean([occasionFit, seasonFit, commuteFit]);
}

/**
 * Alignment (0–1) of an outfit's core items with the learned style/formality
 * preferences in `context.preferences` (RFC-004). Pure; returns 0 when there is
 * nothing to match against.
 */
function preferenceAlignment(
  items: readonly RecommendedOutfitItem[],
  context: RecommendationContext,
  byId: Map<string, WardrobeItemSnapshot>,
): number {
  const styles = new Set(context.preferences.preferredStyles.map(normalize));
  const formality = new Set(context.preferences.preferredFormality.map(normalize));
  if (styles.size === 0 && formality.size === 0) return 0;

  const core = items
    .map((item) => byId.get(item.itemId))
    .filter((snap): snap is WardrobeItemSnapshot => Boolean(snap))
    .filter((snap) => CORE_SLOTS.includes(snap.styleDNA.slot));
  if (core.length === 0) return 0;

  const matches = core.filter((snap) => {
    const styleMatch =
      styles.has(normalize(snap.styleDNA.primaryStyle)) ||
      styles.has(normalize(snap.styleDNA.secondaryStyle));
    const formalityMatch = formality.has(normalize(snap.styleDNA.formality));
    return styleMatch || formalityMatch;
  });
  return matches.length / core.length;
}

// ---------------------------------------------------------------------------
// Merge candidates
// ---------------------------------------------------------------------------

type Candidate = {
  id: string;
  source: "saved_outfit" | "generated_combo";
  savedOutfitId?: string;
  name: string;
  items: RecommendedOutfitItem[];
  analysis: OutfitAnalysis;
  confidence: number;
  reason: string;
  strengths: string[];
  tradeoffs: string[];
  suggestions: string[];
  unifiedScore: number;
  savedScore?: number;
  generatedScore?: number;
  boosts: string[];
  penalties: string[];
};

/** Extra saved-only adjustments (favorite boost + recent-wear penalty) pulled
 *  from the saved engine's transparent debug adjustments. */
function savedExtras(rec: OutfitRecommendation): number {
  let extra = 0;
  for (const adj of rec.debug.adjustments) {
    const label = normalize(adj.label);
    if (label.includes("favorite") || label.includes("worn ")) {
      extra += adj.delta;
    }
  }
  return extra;
}

function coreSignature(items: readonly RecommendedOutfitItem[]): string {
  const slot = (name: string) =>
    items.find((item) => item.slot === name)?.itemId ?? "";
  return `${slot("top")}|${slot("bottom")}|${slot("footwear")}`;
}

/**
 * Produces up to `limit` unified recommendations, merging saved and generated
 * outfits on one comparable score. Deterministic.
 */
export function recommendUnifiedOutfits(
  context: RecommendationContext,
  options: UnifiedOptions = {},
): UnifiedOutfitRecommendation[] {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const generatedAt = context.generatedAt;
  const styleOccasion = resolveStyleOccasion(options.occasion);
  const byId = new Map(context.wardrobe.items.map((item) => [item.id, item]));

  const scoreShared = (analysis: OutfitAnalysis, items: RecommendedOutfitItem[]) =>
    BASE_WEIGHT * analysis.overallScore +
    CONTEXT_WEIGHT * contextFit(items, context, styleOccasion, byId);

  // RFC-004 (opt-in): reward outfits aligned with learned preferences.
  const preferenceExtra = (items: RecommendedOutfitItem[]): number =>
    options.usePreferences
      ? round1(PREFERENCE_BONUS * preferenceAlignment(items, context, byId))
      : 0;

  // 1. Saved outfit recommendations (only the saved ones; generation handles combos).
  const savedResult = generateOutfitRecommendations(context, {
    occasion: options.occasion ?? null,
    limit: PER_SOURCE_LIMIT,
  });
  const savedCandidates: Candidate[] = savedResult.recommendations
    .filter((rec) => rec.metadata.source === "saved_outfit")
    .map((rec) => {
      const extras = savedExtras(rec);
      const prefExtra = preferenceExtra(rec.items);
      const unifiedScore = round1(clamp0To10(scoreShared(rec.analysis, rec.items) + extras + prefExtra));
      return {
        id: `saved:${rec.outfitId ?? coreSignature(rec.items)}`,
        source: "saved_outfit" as const,
        savedOutfitId: rec.outfitId,
        name: rec.name,
        items: rec.items,
        analysis: rec.analysis,
        confidence: rec.confidence,
        reason: rec.reason,
        strengths: rec.strengths,
        tradeoffs: rec.tradeoffs,
        suggestions: rec.suggestions,
        unifiedScore,
        savedScore: rec.score,
        boosts: [
          ...rec.debug.adjustments.filter((a) => a.delta > 0).map((a) => a.label),
          ...(prefExtra > 0 ? ["Matches your preferences"] : []),
        ],
        penalties: rec.debug.adjustments.filter((a) => a.delta < 0).map((a) => a.label),
      };
    });

  // 2. Generated outfits.
  const generatedCandidates: Candidate[] = generateOutfits(context, {
    occasion: options.occasion ?? null,
    limit: PER_SOURCE_LIMIT,
  }).map((gen, index) => {
    const items: RecommendedOutfitItem[] = Object.values(gen.items).filter(
      (ref): ref is RecommendedOutfitItem => Boolean(ref),
    );
    const prefExtra = preferenceExtra(items);
    const unifiedScore = round1(clamp0To10(scoreShared(gen.analysis, items) + prefExtra));
    const [primary, ...restReasons] = gen.reasoning;
    return {
      id: `generated:${coreSignature(items)}:${index}`,
      source: "generated_combo" as const,
      name: gen.items.top.name + " + " + gen.items.bottom.name,
      items,
      analysis: gen.analysis,
      confidence: gen.confidence,
      reason: primary ?? "Fresh pairing generated from your wardrobe.",
      strengths: [...restReasons, ...gen.analysis.strengths].slice(0, 4),
      tradeoffs: gen.analysis.weaknesses.slice(0, 3),
      suggestions: gen.analysis.suggestions.slice(0, 3),
      unifiedScore,
      generatedScore: gen.score,
      boosts: prefExtra > 0 ? ["Matches your preferences"] : [],
      penalties: [],
    };
  });

  // 3/4. Merge and rank by the shared score.
  const ranked = [...savedCandidates, ...generatedCandidates].sort(
    (a, b) =>
      b.unifiedScore - a.unifiedScore ||
      b.confidence - a.confidence ||
      (a.source === "saved_outfit" ? -1 : 1) - (b.source === "saved_outfit" ? -1 : 1) ||
      a.id.localeCompare(b.id),
  );

  // 5. De-duplicate by top+bottom+footwear. Highest score is seen first; a
  // near-tied saved outfit is preferred over a generated one.
  const bySignature = new Map<string, Candidate>();
  for (const candidate of ranked) {
    const signature = coreSignature(candidate.items);
    const existing = bySignature.get(signature);
    if (!existing) {
      bySignature.set(signature, candidate);
      continue;
    }
    if (
      existing.source !== candidate.source &&
      candidate.source === "saved_outfit" &&
      existing.unifiedScore - candidate.unifiedScore <= CLOSE_SCORE
    ) {
      bySignature.set(signature, candidate); // prefer saved when close
    }
  }

  const merged = Array.from(bySignature.values()).sort(
    (a, b) =>
      b.unifiedScore - a.unifiedScore ||
      b.confidence - a.confidence ||
      (a.source === "saved_outfit" ? 0 : 1) - (b.source === "saved_outfit" ? 0 : 1) ||
      a.id.localeCompare(b.id),
  );

  return merged.slice(0, limit).map((candidate, index) => ({
    id: candidate.id,
    source: candidate.source,
    savedOutfitId: candidate.savedOutfitId,
    name: candidate.name,
    items: candidate.items,
    score: candidate.unifiedScore,
    confidence: candidate.confidence,
    analysis: candidate.analysis,
    reason: candidate.reason,
    strengths: candidate.strengths,
    tradeoffs: candidate.tradeoffs,
    suggestions: candidate.suggestions,
    debug: {
      savedOutfitScore: candidate.savedScore,
      generatedScore: candidate.generatedScore,
      sourceRank: index + 1,
      rejectionReasons:
        index === 0 && savedResult.rejected.length > 0
          ? savedResult.rejected.flatMap((r) => r.reasons)
          : undefined,
      boosts: candidate.boosts,
      penalties: candidate.penalties,
    },
    metadata: { generatedAt, engineVersion: UNIFIED_OUTFIT_ENGINE_VERSION },
  }));
}
