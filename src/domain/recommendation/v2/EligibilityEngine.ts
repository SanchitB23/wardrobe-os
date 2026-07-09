/**
 * Recommendation Engine v2 (RFC-012) — Eligibility (hard constraints).
 *
 * Rejects genuinely-wrong outfits BEFORE scoring, so an ineligible candidate can
 * never outrank an eligible one. Each rejection records the failed constraint(s)
 * and a human reason for the trace / debug UI. Pure and deterministic — reads
 * only the candidate's item snapshots and the context (incl. its WeatherSnapshot).
 */

import { resolveStyleOccasion } from "@/domain/outfit";
import type { FormalityEnum, OutfitSlot } from "@/types/wardrobe";
import type { OccasionKey as StyleOccasionKey } from "@/domain/style-dna";
import type {
  RecommendationContext,
  WardrobeItemSnapshot,
} from "@/domain/recommendation/RecommendationContext";
import type {
  EligibilityVerdict,
  HardConstraint,
  OutfitCandidate,
} from "@/domain/recommendation/v2/types";
import { CONSTRAINTS } from "@/domain/recommendation/v2/RecommendationWeights";

const FORMALITY_RANK: Record<FormalityEnum, number> = {
  casual: 0,
  smart_casual: 1,
  business_casual: 2,
  business_formal: 3,
  formal: 4,
};

/** Occasions with hard eligibility rules (travel/home stay soft = scored only). */
const HARD_OCCASIONS = new Set<StyleOccasionKey>(["gym", "office", "wedding", "social"]);

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formalityRank(item: WardrobeItemSnapshot): number {
  return item.formality ? FORMALITY_RANK[item.formality] : 1;
}

const CORE_SLOTS: OutfitSlot[] = ["top", "bottom", "footwear", "outerwear"];

function coreItems(items: readonly WardrobeItemSnapshot[]): WardrobeItemSnapshot[] {
  return items.filter((item) => CORE_SLOTS.includes(item.styleDNA.slot));
}

/** Coarse footwear class — an "open" shoe (sandal/slide) is unsafe in heavy rain. */
function isOpenFootwear(item: WardrobeItemSnapshot): boolean {
  const h = normalize(`${item.name} ${item.subcategory ?? ""}`);
  return ["sandal", "slide", "flip", "flop"].some((k) => h.includes(k));
}

/**
 * Assesses one candidate against every hard constraint. Returns the passed +
 * failed constraints with reasons. `eligible` is true only when nothing failed.
 */
export function assessEligibility(
  candidate: OutfitCandidate,
  context: RecommendationContext,
): EligibilityVerdict {
  const passed: HardConstraint[] = [];
  const failed: HardConstraint[] = [];
  const reasons: string[] = [];
  const disallowedItems: string[] = [];

  const items = candidate.snapshots;
  const avoided = new Set(context.avoidedItemIds);

  // 1. Avoided items — never appear.
  const avoidedHits = items.filter((i) => avoided.has(i.id));
  if (avoidedHits.length > 0) {
    failed.push("no_avoided_items");
    for (const i of avoidedHits) {
      reasons.push(`contains avoided item ${i.name}`);
      disallowedItems.push(i.name);
    }
  } else {
    passed.push("no_avoided_items");
  }

  // 2. Retired items — never appear.
  const retiredHits = items.filter((i) => i.status === "retired");
  if (retiredHits.length > 0) {
    failed.push("no_retired_items");
    for (const i of retiredHits) {
      reasons.push(`contains retired item ${i.name}`);
      disallowedItems.push(i.name);
    }
  } else {
    passed.push("no_retired_items");
  }

  // 3. Required slots present.
  const slots = new Set(items.map((i) => i.styleDNA.slot));
  const missing = CONSTRAINTS.requiredSlots.filter((slot) => !slots.has(slot));
  if (missing.length > 0) {
    failed.push("required_slots_present");
    reasons.push(`missing ${missing.join(", ")}`);
  } else {
    passed.push("required_slots_present");
  }

  // 4. Valid category combination — no extreme formality clash across core pieces.
  const core = coreItems(items);
  if (core.length > 0) {
    const ranks = core.map(formalityRank);
    const spread = Math.max(...ranks) - Math.min(...ranks);
    if (spread >= CONSTRAINTS.invalidFormalitySpread) {
      failed.push("valid_category_combination");
      reasons.push("formality clash between pieces");
    } else {
      passed.push("valid_category_combination");
    }
  } else {
    passed.push("valid_category_combination");
  }

  // (Occasion compatibility is checked in `assessCandidateEligibility`, which has
  //  the requested occasion — it lives in the caller's options, not the context.)

  // 6. Weather compatibility (severe mismatch only, and only when confident).
  const weather = context.weather;
  const canRejectWeather = weather.confidence >= CONSTRAINTS.weatherRejectMinConfidence;
  if (canRejectWeather && core.length > 0) {
    const seasonFit = mean(core.map((i) => i.styleDNA.weather.suitability[weather.season]));
    const rainy =
      weather.condition === "rainy" ||
      weather.labels.includes("RAINY") ||
      (weather.rainRisk ?? 0) >= 0.5;
    const openShoeInRain =
      rainy && items.some((i) => i.styleDNA.slot === "footwear" && isOpenFootwear(i));
    if (seasonFit <= CONSTRAINTS.severeWeatherFloor) {
      failed.push("weather_compatible");
      reasons.push(`severe weather mismatch for ${weather.season}`);
    } else if (openShoeInRain) {
      failed.push("weather_compatible");
      reasons.push("open footwear in heavy rain");
    } else {
      passed.push("weather_compatible");
    }
  } else {
    // Low-confidence weather (e.g. seasonal fallback) never rejects — it only
    // penalizes during scoring, so the engine degrades gracefully.
    passed.push("weather_compatible");
  }

  return {
    eligible: failed.length === 0,
    passed,
    failed,
    reasons,
    disallowedItems,
  };
}

/**
 * Assesses eligibility including the requested occasion (which lives in the
 * caller's options, not the context). This is the entry point the engine uses.
 */
export function assessCandidateEligibility(
  candidate: OutfitCandidate,
  context: RecommendationContext,
  occasion: string | null,
): EligibilityVerdict {
  const verdict = assessEligibility(candidate, context);

  const styleOccasion = resolveStyleOccasion(occasion);
  if (styleOccasion && HARD_OCCASIONS.has(styleOccasion)) {
    const core = coreItems(candidate.snapshots);
    const bad = core.filter(
      (i) => i.styleDNA.occasion.suitability[styleOccasion] < CONSTRAINTS.occasionFloor,
    );
    if (bad.length > 0) {
      verdict.failed.push("occasion_compatible");
      for (const i of bad) {
        verdict.reasons.push(`${i.name} not suitable for ${styleOccasion}`);
        verdict.disallowedItems.push(i.name);
      }
      verdict.eligible = false;
      return verdict;
    }
  }
  verdict.passed.push("occasion_compatible");
  return verdict;
}
