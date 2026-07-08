/**
 * Structured schema for the Lifestyle Plan explanation (RFC-006 §6, AI layer).
 *
 * The AI ONLY explains the already-computed deterministic {@link LifestylePlan}
 * — it never changes the plan, packing, score, or any decision (ADR-005). It
 * receives ONLY curated deterministic outputs (trip summary, score, packing
 * confidence, trade-offs, warnings, shopping suggestions) — never the wardrobe,
 * raw data, recommendation context, or weather-provider internals.
 */

import { createJsonResponseParser, objectSchema } from "@/ai/schemas";
import type { ResponseParser, ResponseSchema } from "@/ai/types";
import type { LifestylePlan } from "@/domain/lifestyle";

export const LIFESTYLE_PLAN_EXPLANATION_PROMPT_VERSION = "v1";

/** The structured, plain-language explanation the model returns. */
export interface LifestylePlanExplanation {
  summary: string;
  packingStrategy: string;
  dailyHighlights: string[];
  packingTips: string[];
  tradeoffExplanation: string;
  shoppingAdvice: string;
  riskAssessment: string;
  confidenceExplanation: string;
  travelTips: string[];
}

export const lifestylePlanExplanationSchema: ResponseSchema<LifestylePlanExplanation> =
  objectSchema<LifestylePlanExplanation>({
    name: "LifestylePlanExplanation",
    description: "a plain-language explanation of an already-computed trip plan",
    jsonHint: JSON.stringify({
      summary: "One or two sentences describing the plan overall.",
      packingStrategy: "How the packing/capsule strategy works for this trip.",
      dailyHighlights: ["A short note about a day's outfit or occasion."],
      packingTips: ["A concrete packing tip grounded in the plan."],
      tradeoffExplanation: "Explain the trade-offs the plan made, in plain terms.",
      shoppingAdvice: "What to do about any missing items (grounded in the suggestions).",
      riskAssessment: "Risks/warnings the traveller should note.",
      confidenceExplanation: "Why the plan/packing confidence is what it is.",
      travelTips: ["A practical travel tip consistent with the plan."],
    }),
    fields: {
      summary: { type: "string" },
      packingStrategy: { type: "string" },
      dailyHighlights: { type: "array" },
      packingTips: { type: "array" },
      tradeoffExplanation: { type: "string" },
      shoppingAdvice: { type: "string" },
      riskAssessment: { type: "string" },
      confidenceExplanation: { type: "string" },
      travelTips: { type: "array" },
    },
  });

export const lifestylePlanExplanationParser: ResponseParser<LifestylePlanExplanation> =
  createJsonResponseParser(lifestylePlanExplanationSchema);

/**
 * Curated, decision-free input the model sees — ONLY deterministic plan outputs.
 * No wardrobe, no DB, no recommendation context, no weather internals (item
 * names are excluded too; only counts).
 */
export interface LifestylePlanExplanationInput {
  trip: { destination: string; days: number; strategy: string; weatherSource: string };
  planScore: number;
  packingConfidence: number;
  capsule: { itemCount: number; dayCount: number };
  packingCount: number;
  dailyOutfits: {
    date: string;
    occasion: string;
    condition: string;
    itemCount: number;
    uncovered: boolean;
  }[];
  tradeoffs: string[];
  warnings: string[];
  shoppingSuggestions: { need: string; decision: string }[];
}

/** Map a LifestylePlan to the curated explanation input. Pure. */
export function toLifestyleExplanationInput(plan: LifestylePlan): LifestylePlanExplanationInput {
  return {
    trip: {
      destination: plan.metadata.destination,
      days: plan.metadata.days,
      strategy: plan.metadata.strategy,
      weatherSource: plan.metadata.weatherSource,
    },
    planScore: plan.planScore,
    packingConfidence: plan.packingPlan.packingConfidence,
    capsule: plan.tripPlan.capsule,
    packingCount: plan.packingPlan.packingList.count,
    dailyOutfits: plan.tripPlan.dailyOutfits.map((o) => ({
      date: o.date,
      occasion: o.occasion,
      condition: o.weather.condition,
      itemCount: o.itemIds.length,
      uncovered: o.uncovered,
    })),
    tradeoffs: plan.tradeoffs,
    warnings: plan.warnings,
    shoppingSuggestions: plan.shoppingPlan.shoppingSuggestions.map((s) => ({
      need: s.need,
      decision: s.analysis.decision,
    })),
  };
}
