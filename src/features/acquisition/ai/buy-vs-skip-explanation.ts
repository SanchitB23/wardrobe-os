/**
 * AI explanation for a Buy vs Skip verdict (RFC-003 §6). Reuses the vendor-
 * neutral AI layer (prompt builder + schema + parser). The AI ONLY explains the
 * already-computed deterministic {@link BuyVsSkipAnalysis} — it never changes
 * the decision, score, or breakdown (ADR-005).
 */

import { createPromptBuilder } from "@/ai/prompt-builders";
import { createJsonResponseParser, objectSchema } from "@/ai/schemas";
import type { PromptBuilder, PromptContext, ResponseParser, ResponseSchema } from "@/ai/types";
import type { BuyVsSkipAnalysis } from "@/domain/acquisition";

export const BUY_VS_SKIP_EXPLANATION_PROMPT_VERSION = "v1";

export interface BuyVsSkipExplanation {
  summary: string;
  whyThisVerdict: string;
  keyFactors: string[];
  thingsToWatch: string[];
}

export const buyVsSkipExplanationSchema: ResponseSchema<BuyVsSkipExplanation> =
  objectSchema<BuyVsSkipExplanation>({
    name: "BuyVsSkipExplanation",
    description: "a plain-language explanation of an already-decided buy/skip verdict",
    jsonHint: JSON.stringify({
      summary: "One or two sentences restating the verdict.",
      whyThisVerdict: "Why the engine landed on this decision.",
      keyFactors: ["The strongest factor for the verdict."],
      thingsToWatch: ["A caveat or thing to double-check."],
    }),
    fields: {
      summary: { type: "string" },
      whyThisVerdict: { type: "string" },
      keyFactors: { type: "array" },
      thingsToWatch: { type: "array" },
    },
  });

export const buyVsSkipExplanationParser: ResponseParser<BuyVsSkipExplanation> =
  createJsonResponseParser(buyVsSkipExplanationSchema);

/** Curated, decision-free input the model sees (never the raw wardrobe). */
export interface BuyVsSkipExplanationInput {
  decision: string;
  score: number;
  confidence: number;
  summary: string;
  reasonsToBuy: string[];
  reasonsToSkip: string[];
  tradeoffs: string[];
  scoreBreakdown: { dimension: string; score: number; reason: string }[];
}

export function toExplanationInput(analysis: BuyVsSkipAnalysis): BuyVsSkipExplanationInput {
  return {
    decision: analysis.decision,
    score: analysis.score,
    confidence: analysis.confidence,
    summary: analysis.summary,
    reasonsToBuy: analysis.reasonsToBuy,
    reasonsToSkip: analysis.reasonsToSkip,
    tradeoffs: analysis.tradeoffs,
    scoreBreakdown: Object.entries(analysis.scoreBreakdown).map(([dimension, d]) => ({
      dimension,
      score: d.score,
      reason: d.reason,
    })),
  };
}

export interface BuyVsSkipExplanationContext extends PromptContext {
  task: "buy-vs-skip-explanation";
  data: { input: BuyVsSkipExplanationInput };
}

export const buyVsSkipExplanationPromptBuilder: PromptBuilder<BuyVsSkipExplanationContext> =
  createPromptBuilder<BuyVsSkipExplanationContext>({
    id: "buy-vs-skip-explanation",
    schema: buyVsSkipExplanationSchema,
    render(context) {
      return {
        system:
          "You explain an ALREADY-DECIDED purchase verdict from Wardrobe OS. Do NOT change the decision, score, or breakdown — only explain them in plain, friendly language. Ground every statement in the provided analysis; invent nothing. Return ONLY the requested JSON.",
        prompt: [
          "Explain this Buy vs Skip verdict.",
          "",
          "VERDICT + ANALYSIS:",
          JSON.stringify(context.data.input),
        ].join("\n"),
      };
    },
  });
