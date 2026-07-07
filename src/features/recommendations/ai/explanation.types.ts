/**
 * Types for the AI recommendation-explanation feature.
 *
 * The AI only EXPLAINS an already-computed, deterministic recommendation — it
 * makes no styling decisions. To that end the model receives a curated summary
 * ({@link ExplanationInput}) and never the raw wardrobe.
 */

/** The JSON the model must return (validated before use). */
export interface RecommendationExplanation {
  summary: string;
  whyThisWorks: string;
  stylingTips: string[];
  confidenceExplanation: string;
  thingsToAvoid: string[];
}

/**
 * The ONLY data sent to the model. Deliberately curated: the recommendation,
 * its outfit analysis, and short summaries of wardrobe health, insights,
 * weather, and commute. No inventory, usage, or purchase dumps.
 */
export interface ExplanationInput {
  recommendation: {
    id: string;
    name: string;
    source: "saved_outfit" | "generated_combo";
    /** 0–10 composite. */
    score: number;
    /** 0–1 composite. */
    confidence: number;
    reason: string;
    strengths: string[];
    tradeoffs: string[];
    suggestions: string[];
    /** The chosen outfit's pieces — part of the recommendation, not the wardrobe. */
    items: { slot: string; name: string; category: string | null }[];
  };
  outfitAnalysis: {
    overallScore: number;
    confidence: number;
    summary: string;
    breakdown: { dimension: string; score: number; reason: string }[];
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
  wardrobeHealth: {
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  insights: {
    overallSummary: string;
    topActions: string[];
  };
  weather: {
    season: string;
    condition: string;
    temperatureC: number | null;
    humidity: number | null;
  };
  commute: {
    mode: string;
    officeDaysPerWeek: number;
    durationMinutes: number | null;
  };
}

/**
 * The parts of {@link ExplanationInput} that are shared across every card in a
 * recommendation response (everything except the per-card recommendation). The
 * service computes this once from domain snapshots; the client merges it with
 * each recommendation via `buildExplanationInput`.
 */
export type ExplainSharedContext = Pick<
  ExplanationInput,
  "wardrobeHealth" | "insights" | "weather" | "commute"
>;
