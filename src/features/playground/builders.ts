/**
 * AI Playground builder registry (dev/admin tool).
 *
 * A pure, shared catalogue of prompt builders the playground can exercise:
 * each entry pairs a prompt builder with its response schema, a version, and a
 * predefined sample input. Pure — no server imports, no I/O — so both the
 * client (to list builders / prefill inputs) and the server (to build + run)
 * import it.
 *
 * These builders EXPLAIN/SUMMARISE already-computed, deterministic data — they
 * make no decisions. The recommendation-explanation entry reuses the production
 * builder; the two summary builders are playground-oriented.
 */

import { createPromptBuilder } from "@/ai/prompt-builders";
import { objectSchema } from "@/ai/schemas";
import type { BuiltPrompt, ResponseSchema } from "@/ai/types";
import {
  EXPLANATION_PROMPT_VERSION,
  recommendationExplanationPromptBuilder,
} from "@/features/recommendations/ai/explanation.prompt-builder";
import { recommendationExplanationSchema } from "@/features/recommendations/ai/explanation.schema";
import type { ExplanationInput } from "@/features/recommendations/ai/explanation.types";

export interface PlaygroundBuilderDef {
  id: string;
  label: string;
  version: string;
  description: string;
  schema: ResponseSchema;
  build: (input: unknown) => BuiltPrompt;
  sampleInput: unknown;
}

// ---------------------------------------------------------------------------
// 1. Recommendation explanation (reuses the production builder + schema).
// ---------------------------------------------------------------------------

const sampleExplanationInput: ExplanationInput = {
  recommendation: {
    id: "gen:sample",
    name: "Navy polo + beige chinos",
    source: "generated_combo",
    score: 8.2,
    confidence: 0.86,
    reason: "Balanced smart-casual pick for a warm day.",
    strengths: ["Versatile", "Comfortable in heat"],
    tradeoffs: ["No layer for rain"],
    suggestions: ["Add a leather watch"],
    items: [
      { slot: "top", name: "Navy polo", category: "Tops" },
      { slot: "bottom", name: "Beige chinos", category: "Bottoms" },
      { slot: "footwear", name: "White sneakers", category: "Footwear" },
    ],
  },
  outfitAnalysis: {
    overallScore: 8.2,
    confidence: 0.86,
    summary: "Cohesive smart-casual look with strong colour harmony.",
    breakdown: [
      { dimension: "color", score: 9, reason: "Harmonious neutral palette" },
      { dimension: "formality", score: 8, reason: "Consistent formality" },
    ],
    strengths: ["Colour harmony"],
    weaknesses: ["Warm for peak summer"],
    suggestions: ["Consider loafers"],
  },
  wardrobeHealth: {
    overallScore: 72,
    strengths: ["Strong in tops"],
    weaknesses: ["Few outerwear pieces"],
    recommendations: ["Add a light jacket"],
  },
  insights: { overallSummary: "Healthy, tops-heavy wardrobe.", topActions: ["Add outerwear"] },
  weather: { season: "summer", condition: "hot", temperatureC: 34, humidity: 60 },
  commute: { mode: "wfh", officeDaysPerWeek: 1, durationMinutes: null },
};

// ---------------------------------------------------------------------------
// 2. Wardrobe health summary.
// ---------------------------------------------------------------------------

interface HealthSummaryInput {
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  gaps: { label: string; priority: string }[];
}

const wardrobeHealthSummarySchema = objectSchema<{
  summary: string;
  priorities: string[];
  quickWins: string[];
}>({
  name: "WardrobeHealthSummary",
  description: "a plain-language summary of a wardrobe health report",
  jsonHint: JSON.stringify({
    summary: "One or two sentences on overall wardrobe health.",
    priorities: ["The most important thing to address."],
    quickWins: ["A low-effort improvement."],
  }),
  fields: {
    summary: { type: "string" },
    priorities: { type: "array" },
    quickWins: { type: "array" },
  },
});

const wardrobeHealthSummaryPromptBuilder = createPromptBuilder({
  id: "wardrobe-health-summary",
  schema: wardrobeHealthSummarySchema,
  render(context) {
    const input = context.data.input as HealthSummaryInput;
    return {
      system:
        "You summarise an already-computed wardrobe health report in plain, encouraging language. Explain the report; do not invent numbers or items not present in the input.",
      prompt: [
        "Summarise this wardrobe health report.",
        "",
        "HEALTH REPORT:",
        JSON.stringify(input),
      ].join("\n"),
    };
  },
});

const sampleHealthSummaryInput: HealthSummaryInput = {
  overallScore: 72,
  strengths: ["Strong core of versatile tops", "Good neutral colour base"],
  weaknesses: ["Thin on outerwear", "Limited formal options"],
  gaps: [
    { label: "Light rain jacket", priority: "high" },
    { label: "Dark formal shoes", priority: "medium" },
  ],
};

// ---------------------------------------------------------------------------
// 3. Insight summary.
// ---------------------------------------------------------------------------

interface InsightSummaryInput {
  overallSummary: string;
  insights: { title: string; priority: string; description: string }[];
}

const insightSummarySchema = objectSchema<{
  headline: string;
  themes: string[];
  topActions: string[];
}>({
  name: "InsightSummary",
  description: "a concise summary of a wardrobe insight report",
  jsonHint: JSON.stringify({
    headline: "A one-line headline.",
    themes: ["A recurring theme across the insights."],
    topActions: ["The single most valuable next action."],
  }),
  fields: {
    headline: { type: "string" },
    themes: { type: "array" },
    topActions: { type: "array" },
  },
});

const insightSummaryPromptBuilder = createPromptBuilder({
  id: "insight-summary",
  schema: insightSummarySchema,
  render(context) {
    const input = context.data.input as InsightSummaryInput;
    return {
      system:
        "You summarise an already-computed wardrobe insight report. Group the insights into themes and surface the highest-value actions. Do not invent insights beyond the input.",
      prompt: ["Summarise these wardrobe insights.", "", "INSIGHTS:", JSON.stringify(input)].join(
        "\n",
      ),
    };
  },
});

const sampleInsightSummaryInput: InsightSummaryInput = {
  overallSummary: "Wardrobe is versatile but leans casual and tops-heavy.",
  insights: [
    {
      title: "Tops outnumber bottoms 3:1",
      priority: "medium",
      description: "Consider adding bottoms to unlock more combinations.",
    },
    {
      title: "5 items never worn in 90 days",
      priority: "high",
      description: "Re-style or retire stale pieces to lift usage.",
    },
    {
      title: "No wet-weather outerwear",
      priority: "high",
      description: "Monsoon commutes lack a water-resistant layer.",
    },
  ],
};

// ---------------------------------------------------------------------------
// Registry.
// ---------------------------------------------------------------------------

export const PLAYGROUND_BUILDERS: PlaygroundBuilderDef[] = [
  {
    id: recommendationExplanationPromptBuilder.id,
    label: "Recommendation explanation",
    version: EXPLANATION_PROMPT_VERSION,
    description: "Explains why an outfit recommendation works.",
    schema: recommendationExplanationSchema,
    build: (input) =>
      recommendationExplanationPromptBuilder.build({
        task: "recommendation-explanation",
        data: { input: input as ExplanationInput },
      }),
    sampleInput: sampleExplanationInput,
  },
  {
    id: wardrobeHealthSummaryPromptBuilder.id,
    label: "Wardrobe health summary",
    version: "v1",
    description: "Summarises a wardrobe health report in plain language.",
    schema: wardrobeHealthSummarySchema,
    build: (input) =>
      wardrobeHealthSummaryPromptBuilder.build({
        task: "wardrobe-health-summary",
        data: { input },
      }),
    sampleInput: sampleHealthSummaryInput,
  },
  {
    id: insightSummaryPromptBuilder.id,
    label: "Insight summary",
    version: "v1",
    description: "Summarises a wardrobe insight report into themes + actions.",
    schema: insightSummarySchema,
    build: (input) =>
      insightSummaryPromptBuilder.build({ task: "insight-summary", data: { input } }),
    sampleInput: sampleInsightSummaryInput,
  },
];

export function getPlaygroundBuilder(id: string): PlaygroundBuilderDef | undefined {
  return PLAYGROUND_BUILDERS.find((builder) => builder.id === id);
}
