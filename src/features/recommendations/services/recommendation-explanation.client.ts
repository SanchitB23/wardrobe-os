/**
 * Client-side caller for the explanation API route. Kept separate from the
 * server service so no server-only code (or the Gemini key) can leak into the
 * browser bundle. Throws on a non-OK response so React Query surfaces the error.
 */

import type {
  ExplanationInput,
  RecommendationExplanation,
} from "@/features/recommendations/ai/explanation.types";

export interface ExplanationClientResult {
  explanation: RecommendationExplanation;
  /** True when the server served this from cache rather than a fresh call. */
  cached: boolean;
}

export async function fetchRecommendationExplanation(
  input: ExplanationInput,
  options: { forceRefresh?: boolean; signal?: AbortSignal } = {},
): Promise<ExplanationClientResult> {
  const url = options.forceRefresh
    ? "/api/ai/explain-recommendation?refresh=1"
    : "/api/ai/explain-recommendation";
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: options.signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: RecommendationExplanation; cached?: boolean }
    | { ok: false; error?: string }
    | null;

  if (!response.ok || !payload || payload.ok !== true) {
    const message =
      (payload && "error" in payload && payload.error) ||
      "Couldn't generate an explanation.";
    throw new Error(message);
  }
  return { explanation: payload.data, cached: Boolean(payload.cached) };
}
