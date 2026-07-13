/**
 * Lifestyle Engine (RFC-006) — deterministic trip planning by COMPOSING the
 * existing engines across a time horizon. Pure TypeScript: no React, no
 * Supabase, no AI, no I/O (the weather forecast is an input; the orchestrator is
 * injected). Identical input (+ generatedAt) ⇒ identical LifestylePlan.
 *
 * It requests recommendations and buy/skip verdicts THROUGH the Intelligence
 * Orchestrator (RFC-005) — never by calling the recommendation/acquisition
 * engines directly. The Lifestyle Engine composes; the engines decide; the
 * orchestrator coordinates; AI only explains.
 */

import type { BuyVsSkipAnalysis, ProspectiveItem } from "@/domain/acquisition";
import { createExecutionContext, orchestrate as realOrchestrate } from "@/domain/orchestrator";
import type { UnifiedOutfitRecommendation } from "@/domain/recommendation";
import { planCapsule } from "@/domain/lifestyle/CapsulePlanner";
import { planLaundry } from "@/domain/lifestyle/LaundryPlanner";
import { planPacking } from "@/domain/lifestyle/PackingPlanner";
import { buildShoppingPlan, detectMissingItems } from "@/domain/lifestyle/ShoppingPlanner";
import { expandTripDays } from "@/domain/lifestyle/TripPlanner";
import { toWeatherSnapshot } from "@/domain/lifestyle/WeatherPlanner";
import { DEFAULT_STRATEGY, strategyProfile } from "@/domain/lifestyle/PlanningStrategy";
import {
  DAILY_OUTFIT_CANDIDATES,
  LIFESTYLE_ENGINE_VERSION,
  PLAN_SCORE_WEIGHTS,
  WARNING_PENALTY,
} from "@/domain/lifestyle/constants";
import type {
  DailyOutfit,
  LifestyleInput,
  LifestyleOptions,
  LifestylePlan,
  OrchestrateFn,
  PlanningStrategy,
  ProspectiveNeed,
  TripDay,
} from "@/domain/lifestyle/types";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/** Sorted-itemIds signature identifying an outfit combination. */
const outfitSignature = (rec: UnifiedOutfitRecommendation): string =>
  rec.items
    .map((i) => i.itemId)
    .sort()
    .join("|");

/** Build the per-day recommendation via the Orchestrator (never a direct call).
 *  Requests several ranked candidates and prefers the best one not yet worn on
 *  a previous day, so the trip rotates outfits instead of repeating the single
 *  deterministic top pick. Falls back to the top pick when every candidate has
 *  already been used (small wardrobe). */
function selectDailyOutfit(
  day: TripDay,
  input: LifestyleInput,
  generatedAt: string,
  orchestrate: OrchestrateFn,
  usedSignatures: Set<string>,
  clock?: () => number,
): DailyOutfit {
  const weather = { condition: day.weather.condition, season: day.weather.season };
  const dayContext = {
    ...input.recommendation,
    generatedAt,
    weather: toWeatherSnapshot(day.weather),
  };
  const inputs = { occasion: day.occasion, limit: DAILY_OUTFIT_CANDIDATES };
  const exec = createExecutionContext({
    recommendation: dayContext,
    wardrobe: input.wardrobe,
    health: input.health ?? null,
    usage: input.usage ?? null,
    purchase: input.purchase ?? null,
    inputs,
    generatedAt,
  });
  const report = orchestrate({ capabilities: ["recommendation"], inputs }, exec, { clock });
  const outcome = report.outcomes.recommendation;
  const recs =
    outcome?.status === "executed" ? (outcome.output as UnifiedOutfitRecommendation[]) : null;
  const top =
    recs && recs.length > 0
      ? (recs.find((r) => !usedSignatures.has(outfitSignature(r))) ?? recs[0])
      : null;

  if (!top) {
    return {
      date: day.date,
      occasion: day.occasion,
      weather,
      itemIds: [],
      score: 0,
      reason: "No suitable outfit in your wardrobe for this day.",
      uncovered: true,
    };
  }
  usedSignatures.add(outfitSignature(top));
  return {
    date: day.date,
    occasion: day.occasion,
    weather,
    itemIds: top.items.map((i) => i.itemId),
    score: top.score,
    reason: top.reason,
    uncovered: false,
  };
}

/** Evaluate a missing need via the Acquisition capability (through the orchestrator). */
function makeNeedEvaluator(
  input: LifestyleInput,
  generatedAt: string,
  orchestrate: OrchestrateFn,
  clock?: () => number,
) {
  return (need: ProspectiveNeed): BuyVsSkipAnalysis | null => {
    const item: ProspectiveItem = {
      name: need.need,
      category: "Apparel",
      intendedOccasions: [need.need.replace(/ outfit$/i, "")],
    };
    const exec = createExecutionContext({
      recommendation: { ...input.recommendation, generatedAt },
      wardrobe: input.wardrobe,
      health: input.health ?? null,
      usage: input.usage ?? null,
      purchase: input.purchase ?? null,
      inputs: { prospectiveItem: item },
      generatedAt,
    });
    const report = orchestrate(
      { capabilities: ["acquisition"], inputs: { prospectiveItem: item } },
      exec,
      { clock },
    );
    const outcome = report.outcomes.acquisition;
    return outcome?.status === "executed" ? (outcome.output as BuyVsSkipAnalysis) : null;
  };
}

function scorePlan(
  days: TripDay[],
  dailyOutfits: DailyOutfit[],
  capsuleItemCount: number,
  warningCount: number,
): number {
  const total = days.length || 1;
  const covered = dailyOutfits.filter((o) => !o.uncovered).length;
  const occasionCoverage = covered / total;
  const weatherCoverage = covered / total; // outfits are selected weather-aware
  const packingEfficiency = clamp01(1 - capsuleItemCount / (total * 3));
  const slots = dailyOutfits.reduce((n, o) => n + o.itemIds.length, 0) || 1;
  const wardrobeReuse = clamp01((slots - capsuleItemCount) / slots);
  const distinct = new Set(
    dailyOutfits.filter((o) => !o.uncovered).map((o) => [...o.itemIds].sort().join("|")),
  ).size;
  const variety = covered > 0 ? distinct / covered : 0;

  const w = PLAN_SCORE_WEIGHTS;
  const base =
    w.occasionCoverage * occasionCoverage +
    w.weatherCoverage * weatherCoverage +
    w.packingEfficiency * packingEfficiency +
    w.wardrobeReuse * wardrobeReuse +
    w.variety * variety;

  return Math.max(0, Math.min(100, Math.round(base * 100 - warningCount * WARNING_PENALTY)));
}

function planConfidence(input: LifestyleInput): number {
  let c = 0.4;
  if (input.forecast.source === "forecast") c += 0.25;
  else if (input.forecast.source === "manual") c += 0.1;
  if (input.wardrobe.length >= 10) c += 0.2;
  else if (input.wardrobe.length > 0) c += 0.1;
  if (input.preferences) c += 0.15;
  return Number(clamp01(c).toFixed(4));
}

function deriveTradeoffs(
  input: LifestyleInput,
  strategy: PlanningStrategy,
  withinLuggage: boolean,
): string[] {
  const t: string[] = [];
  if (input.trip.luggage.kind === "carry_on") t.push("Carry-on → reduced outfit variety.");
  if (strategy === "business") t.push("Business → higher packing count.");
  if (strategy === "minimal") t.push("Minimal → more repeats to keep the bag light.");
  if (strategy === "luxury") t.push("Luxury → larger bag for more variety.");
  if (!withinLuggage) t.push("Over the luggage limit → some coverage was dropped.");
  return [...new Set(t)];
}

export function planLifestyle(
  input: LifestyleInput,
  options: LifestyleOptions,
): LifestylePlan {
  const generatedAt = options.generatedAt;
  const strategyKey = options.strategy ?? DEFAULT_STRATEGY;
  const strategy = strategyProfile(strategyKey);
  const orchestrate = options.orchestrate ?? realOrchestrate;
  const clock = options.clock;

  // 1. Trip → per-day schedule (event-less days take the strategy's occasion).
  const days = expandTripDays(input.trip, input.forecast, strategy.defaultOccasion);

  // 2. Per-day outfit selection — through the Orchestrator's recommendation
  // capability, rotating away from already-worn combinations.
  const usedSignatures = new Set<string>();
  const dailyOutfits = days.map((day) =>
    selectDailyOutfit(day, input, generatedAt, orchestrate, usedSignatures, clock),
  );

  // 3. Capsule (deduped union of daily-outfit items).
  const capsule = planCapsule(dailyOutfits);

  // 4. Packing (respect luggage + strategy) → list + packingConfidence.
  const { packingList, packingConfidence } = planPacking(
    dailyOutfits,
    capsule,
    input.wardrobe,
    input.trip.luggage,
    strategy,
  );

  // 5. Laundry.
  const schedule = planLaundry(input.trip, dailyOutfits, packingList.count, strategy);

  // 6. Shopping — missing needs via the Acquisition capability (through the orchestrator).
  const missing = detectMissingItems(days, dailyOutfits);
  const shoppingPlan = buildShoppingPlan(
    missing,
    makeNeedEvaluator(input, generatedAt, orchestrate, clock),
  );

  // 7. Warnings + trade-offs.
  const warnings: string[] = [];
  for (const outfit of dailyOutfits) {
    if (outfit.uncovered) warnings.push(`No outfit for ${outfit.date} (${outfit.occasion}).`);
  }
  if (schedule.needed && !input.trip.laundry.available) {
    warnings.push(
      "Trip outlasts your clean clothes and no laundry is available — pack more or plan washes.",
    );
  }
  if (!packingList.withinLuggage) {
    warnings.push(`Packing (${packingList.count}) exceeds your ${input.trip.luggage.kind} limit.`);
  }
  const tradeoffs = deriveTradeoffs(input, strategyKey, packingList.withinLuggage);

  // 8. Score + confidence.
  const planScore = scorePlan(days, dailyOutfits, capsule.itemCount, warnings.length);
  const confidence = planConfidence(input);

  return {
    tripPlan: {
      days,
      dailyOutfits,
      capsule: { itemCount: capsule.itemCount, dayCount: capsule.dayCount },
    },
    packingPlan: { packingList, packingConfidence },
    laundryPlan: { schedule },
    shoppingPlan,
    warnings,
    tradeoffs,
    planScore,
    confidence,
    metadata: {
      engineVersion: LIFESTYLE_ENGINE_VERSION,
      generatedAt,
      destination: input.trip.destination,
      days: days.length,
      strategy: strategyKey,
      weatherSource: input.forecast.source,
    },
  };
}
