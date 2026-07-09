/**
 * Recommendation Engine v2 (RFC-012) — Scoring.
 *
 * A weighted, multi-objective model over named dimensions (each a pure function
 * of the candidate + context), plus real additive boosts/penalties. Every score
 * carries a full {@link ScoreBreakdown}. Weather- and personalization-aware, and
 * parameterized by a weight map so quality metrics can run counterfactuals.
 * Pure and deterministic — no AI, no ML, no randomness.
 */

import { resolveStyleOccasion } from "@/domain/outfit";
import type { FormalityEnum, OutfitSlot } from "@/types/wardrobe";
import type {
  RecommendationContext,
  WardrobeItemSnapshot,
} from "@/domain/recommendation/RecommendationContext";
import type {
  OutfitCandidate,
  ReasonCode,
  ScoreAdjustment,
  ScoreBreakdown,
  ScoreDimension,
  ScoreDimensionId,
} from "@/domain/recommendation/v2/types";
import {
  ADJUSTMENTS,
  DIMENSION_WEIGHTS,
  OVER_ROTATION_MULTIPLE,
  REASON_THRESHOLDS,
  RECENT_WEAR_DAYS,
  SOFT_RECENT_DAYS,
  type RecommendationWeights,
} from "@/domain/recommendation/v2/RecommendationWeights";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const CORE_SLOTS: OutfitSlot[] = ["top", "bottom", "footwear", "outerwear"];

const FORMALITY_RANK: Record<FormalityEnum, number> = {
  casual: 0,
  smart_casual: 1,
  business_casual: 2,
  business_formal: 3,
  formal: 4,
};

function clamp0To10(v: number): number {
  return Math.max(0, Math.min(10, v));
}
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function normalize(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}
function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
function parseDate(value: string): Date | null {
  const raw = value.length === 10 ? `${value}T00:00:00Z` : value;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function coreOf(items: readonly WardrobeItemSnapshot[]): WardrobeItemSnapshot[] {
  const core = items.filter((i) => CORE_SLOTS.includes(i.styleDNA.slot));
  return core.length > 0 ? core : [...items];
}

// ---------------------------------------------------------------------------
// Dimensions — each returns a 0–10 raw, independent of the weight map.
// ---------------------------------------------------------------------------

function weatherRaw(candidate: OutfitCandidate, context: RecommendationContext): number {
  const core = coreOf(candidate.snapshots);
  const weather = context.weather;
  const base = mean(core.map((i) => i.styleDNA.weather.suitability[weather.season]));
  const labels = weather.labels;
  const hasOuter = core.some((i) => i.styleDNA.slot === "outerwear");
  const heavyCount = core.filter((i) => i.styleDNA.texture.fabricWeight === "heavy").length;
  const footwear = core.filter((i) => i.styleDNA.slot === "footwear");
  const openShoe = footwear.some((i) =>
    ["sandal", "slide", "flip"].some((k) => normalize(`${i.name} ${i.subcategory ?? ""}`).includes(k)),
  );

  let adj = 0;
  if (labels.includes("RAINY")) adj -= openShoe ? 3 : 0.5;
  if (labels.includes("LAYER_REQUIRED")) adj += hasOuter ? 1.5 : -2;
  if (labels.includes("HOT") || labels.includes("LIGHTWEIGHT")) {
    adj -= Math.min(3, heavyCount * 1.5);
  }
  const weatherFit = clamp0To10(base + adj);
  // Pull toward neutral by (1 − confidence): low-confidence (fallback) weather
  // moves the ranking less. Deterministic.
  return clamp0To10(5 + (weatherFit - 5) * weather.confidence);
}

function occasionRaw(
  candidate: OutfitCandidate,
  occasion: string | null,
): number {
  const styleOccasion = resolveStyleOccasion(occasion);
  if (!styleOccasion) return 6; // no concrete occasion → mildly positive/neutral
  const core = coreOf(candidate.snapshots);
  return mean(core.map((i) => i.styleDNA.occasion.suitability[styleOccasion]));
}

function formalityRaw(candidate: OutfitCandidate, context: RecommendationContext): number {
  const core = coreOf(candidate.snapshots);
  const ranks = core.map((i) => (i.formality ? FORMALITY_RANK[i.formality] : 1));
  const spread = ranks.length > 0 ? Math.max(...ranks) - Math.min(...ranks) : 0;
  const preferred = new Set(context.preferences.preferredFormality.map(normalize));
  const matchFraction =
    core.length > 0
      ? core.filter((i) => preferred.has(normalize(i.formality))).length / core.length
      : 0;
  return clamp0To10(8 - spread * 1.5 + matchFraction * 2);
}

function preferenceRaw(candidate: OutfitCandidate, context: RecommendationContext): number {
  const styles = new Set(context.preferences.preferredStyles.map(normalize));
  const formality = new Set(context.preferences.preferredFormality.map(normalize));
  const avoidedColors = new Set(context.preferences.avoidedColors.map(normalize));
  if (styles.size === 0 && formality.size === 0 && avoidedColors.size === 0) return 5;

  const core = coreOf(candidate.snapshots);
  if (core.length === 0) return 5;

  const matches = core.filter((i) => {
    const styleMatch =
      styles.has(normalize(i.styleDNA.primaryStyle)) ||
      styles.has(normalize(i.styleDNA.secondaryStyle));
    const formalityMatch = formality.has(normalize(i.formality));
    return styleMatch || formalityMatch;
  }).length;
  const avoided = core.filter((i) => avoidedColors.has(normalize(i.colorFamily))).length;

  const matchFraction = matches / core.length;
  const avoidedFraction = avoided / core.length;
  return clamp0To10(3 + 7 * matchFraction - 5 * avoidedFraction);
}

function commuteRaw(candidate: OutfitCandidate, context: RecommendationContext): number {
  if (context.commute.mode === "wfh") return 7;
  const core = coreOf(candidate.snapshots);
  return mean(core.map((i) => i.styleDNA.compatibility.commuteFriendliness));
}

function healthRaw(candidate: OutfitCandidate, context: RecommendationContext): number {
  const protectedSet = new Set(context.protectedItemIds);
  const neglected = new Set([
    ...context.usage.neverWornItemIds,
    ...context.usage.staleItemIds,
  ]);
  const core = coreOf(candidate.snapshots);
  const surfaced = core.filter((i) => !protectedSet.has(i.id) && neglected.has(i.id)).length;
  return clamp0To10(5 + (surfaced > 0 ? Math.min(5, surfaced * 2.5) : 0));
}

/** All nine dimension raws (0–10), independent of the weight map. */
export function scoreDimensions(
  candidate: OutfitCandidate,
  context: RecommendationContext,
  occasion: string | null,
): Record<ScoreDimensionId, number> {
  return {
    outfitAnalysis: clamp0To10(candidate.analysis.overallScore),
    weatherSuitability: weatherRaw(candidate, context),
    occasionSuitability: occasionRaw(candidate, occasion),
    personalPreferenceFit: preferenceRaw(candidate, context),
    formalityAlignment: formalityRaw(candidate, context),
    colorHarmony: clamp0To10(candidate.analysis.breakdown.color?.score ?? 5),
    textureCompatibility: clamp0To10(candidate.analysis.breakdown.texture?.score ?? 5),
    comfortCommuteFit: commuteRaw(candidate, context),
    wardrobeHealthContribution: healthRaw(candidate, context),
  };
}

// ---------------------------------------------------------------------------
// Real additive adjustments (independent of the weight map).
// ---------------------------------------------------------------------------

function computeAdjustments(
  candidate: OutfitCandidate,
  context: RecommendationContext,
): { boosts: ScoreAdjustment[]; penalties: ScoreAdjustment[] } {
  const boosts: ScoreAdjustment[] = [];
  const penalties: ScoreAdjustment[] = [];
  const protectedSet = new Set(context.protectedItemIds);
  const asOf = parseDate(context.generatedAt);

  // Favorite saved outfit.
  if (candidate.favorite) {
    boosts.push({ code: "favorite_outfit", label: "Favorite outfit", delta: ADJUSTMENTS.favoriteBoost });
  }

  // Recent wear (protected items exempt). Worst signal wins — no stacking.
  let recentDays: number | null = null;
  if (candidate.lastWornOn) {
    const worn = parseDate(candidate.lastWornOn);
    if (worn && asOf) recentDays = Math.floor((asOf.getTime() - worn.getTime()) / MS_PER_DAY);
  }
  const perItem = new Map(context.usage.perItem.map((u) => [u.itemId, u.daysSinceLastWorn]));
  for (const item of candidate.snapshots) {
    if (protectedSet.has(item.id)) continue;
    const days = perItem.get(item.id);
    if (days != null && (recentDays == null || days < recentDays)) recentDays = days;
  }
  if (recentDays != null) {
    if (recentDays <= RECENT_WEAR_DAYS) {
      penalties.push({ code: "recent_wear", label: `Worn ${recentDays}d ago`, delta: -ADJUSTMENTS.recentWearPenalty });
    } else if (recentDays <= SOFT_RECENT_DAYS) {
      penalties.push({ code: "recent_wear", label: `Worn ${recentDays}d ago`, delta: -ADJUSTMENTS.softRecentWearPenalty });
    }
  }

  // Over-rotation (protected items exempt).
  const counts = context.usage.wearCountByItem;
  const activeCounts = context.wardrobe.activeItems.map((i) => counts[i.id] ?? 0);
  const activeMean = mean(activeCounts);
  if (activeMean > 0) {
    const over = candidate.snapshots.filter(
      (i) => !protectedSet.has(i.id) && (counts[i.id] ?? 0) >= activeMean * OVER_ROTATION_MULTIPLE,
    ).length;
    if (over > 0) {
      penalties.push({
        code: "over_rotation",
        label: `${over} over-worn item${over === 1 ? "" : "s"}`,
        delta: -Math.min(ADJUSTMENTS.overRotationPenaltyCap, over * ADJUSTMENTS.overRotationPenaltyEach),
      });
    }
  }

  return { boosts, penalties };
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

export interface ScoredCandidate {
  candidate: OutfitCandidate;
  breakdown: ScoreBreakdown;
  score: number;
  confidence: number;
  reasonCodes: ReasonCode[];
}

function deriveReasonCodes(
  raws: Record<ScoreDimensionId, number>,
  occasion: string | null,
  boosts: ScoreAdjustment[],
  penalties: ScoreAdjustment[],
): ReasonCode[] {
  const codes = new Set<ReasonCode>();
  if (raws.weatherSuitability >= REASON_THRESHOLDS.weatherAppropriate) codes.add("weather_appropriate");
  else if (raws.weatherSuitability <= REASON_THRESHOLDS.weatherMismatch) codes.add("mild_weather_mismatch");
  if (resolveStyleOccasion(occasion) && raws.occasionSuitability >= REASON_THRESHOLDS.occasionIdeal) {
    codes.add("occasion_ideal");
  }
  if (raws.personalPreferenceFit >= REASON_THRESHOLDS.preferenceMatch) codes.add("matches_preferences");
  if (raws.formalityAlignment <= REASON_THRESHOLDS.formalityDrift) codes.add("formality_drift");
  if (raws.colorHarmony <= REASON_THRESHOLDS.weakColorHarmony) codes.add("weak_color_harmony");
  if (raws.wardrobeHealthContribution >= REASON_THRESHOLDS.improvesRotation) codes.add("improves_rotation");
  for (const b of boosts) codes.add(b.code);
  for (const p of penalties) codes.add(p.code);
  return [...codes];
}

/** Scores one candidate with the given weight map. Pure. */
export function scoreCandidate(
  candidate: OutfitCandidate,
  context: RecommendationContext,
  occasion: string | null,
  weights: RecommendationWeights = DIMENSION_WEIGHTS,
): ScoredCandidate {
  const raws = scoreDimensions(candidate, context, occasion);
  const dimensions: ScoreDimension[] = (Object.keys(raws) as ScoreDimensionId[]).map((id) => ({
    dimension: id,
    raw: round1(raws[id]),
    weight: weights[id],
    weighted: round2(weights[id] * raws[id]),
  }));
  const subtotal = dimensions.reduce((sum, d) => sum + d.weight * raws[d.dimension], 0);

  const { boosts, penalties } = computeAdjustments(candidate, context);
  const adjTotal =
    boosts.reduce((s, b) => s + b.delta, 0) + penalties.reduce((s, p) => s + p.delta, 0);
  const total = round1(clamp0To10(subtotal + adjTotal));

  const confidence = round2(clamp01(candidate.confidence * (0.85 + 0.15 * context.weather.confidence)));
  const reasonCodes = deriveReasonCodes(raws, occasion, boosts, penalties);

  return {
    candidate,
    breakdown: { dimensions, boosts, penalties, subtotal: round1(subtotal), total },
    score: total,
    confidence,
    reasonCodes,
  };
}

/** Scores every candidate with the given weight map. Pure. */
export function scoreCandidates(
  candidates: readonly OutfitCandidate[],
  context: RecommendationContext,
  occasion: string | null,
  weights: RecommendationWeights = DIMENSION_WEIGHTS,
): ScoredCandidate[] {
  return candidates.map((c) => scoreCandidate(c, context, occasion, weights));
}

/** Deterministic ranking comparator (score, confidence, saved-before-generated, id). */
export function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  const sourceRank = (s: ScoredCandidate) => (s.candidate.source === "saved_outfit" ? 0 : 1);
  return (
    b.score - a.score ||
    b.confidence - a.confidence ||
    sourceRank(a) - sourceRank(b) ||
    a.candidate.id.localeCompare(b.candidate.id)
  );
}
