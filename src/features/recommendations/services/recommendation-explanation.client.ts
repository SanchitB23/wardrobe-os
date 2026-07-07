/**
 * Client-side caller for the explanation API route. Kept separate from the
 * server service so no server-only code (or the Gemini key) can leak into the
 * browser bundle. Throws on a non-OK response so React Query surfaces the error.
 */

import type {
  ExplanationInput,
  RecommendationExplanation,
} from "@/features/recommendations/ai/explanation.types";

export async function fetchRecommendationExplanation(
  input: ExplanationInput,
  signal?: AbortSignal,
): Promise<RecommendationExplanation> {
  const response = await fetch("/api/ai/explain-recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | { ok: true; data: RecommendationExplanation }
    | { ok: false; error?: string }
    | null;

  if (!response.ok || !payload || payload.ok !== true) {
    const message =
      (payload && "error" in payload && payload.error) ||
      "Couldn't generate an explanation.";
    throw new Error(message);
  }
  return payload.data;
}
