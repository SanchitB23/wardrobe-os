/**
 * POST /api/ai/explain-recommendation
 *
 * Body: an ExplanationInput (curated recommendation + summaries — no raw
 * wardrobe). Returns the validated natural-language explanation. Server-side
 * only (Node runtime); the Gemini key never reaches the browser. Degrades
 * gracefully: any failure returns { ok: false, error } with a 4xx/5xx status
 * so the UI can show a fallback.
 */

import { NextResponse } from "next/server";

import { AIError } from "@/ai/types";
import { explainRecommendation } from "@/features/recommendations/services/recommendation-explanation.service";
import type { ExplanationInput } from "@/features/recommendations/ai/explanation.types";
import { withApiLogging } from "@/runtime/logging/api-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Minimal structural guard — enough to reject junk before spending a call. */
function isExplanationInput(value: unknown): value is ExplanationInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  const rec = v.recommendation as Record<string, unknown> | undefined;
  return (
    typeof rec === "object" &&
    rec !== null &&
    typeof rec.id === "string" &&
    Array.isArray(rec.items) &&
    typeof v.outfitAnalysis === "object" &&
    v.outfitAnalysis !== null &&
    typeof v.wardrobeHealth === "object" &&
    typeof v.insights === "object" &&
    typeof v.weather === "object" &&
    typeof v.commute === "object"
  );
}

async function handleExplainRecommendation(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (!isExplanationInput(body)) {
    return NextResponse.json(
      { ok: false, error: "Malformed explanation input." },
      { status: 400 },
    );
  }

  // ?refresh=1 bypasses the cache and regenerates (req 8).
  const forceRefresh =
    new URL(request.url).searchParams.get("refresh") === "1";

  try {
    const { explanation, cached } = await explainRecommendation(body, {
      forceRefresh,
    });
    return NextResponse.json({ ok: true, data: explanation, cached });
  } catch (error) {
    const code = error instanceof AIError ? error.code : "unknown";
    const status = code === "parse_error" ? 502 : 500;
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate explanation.",
        code,
      },
      { status },
    );
  }
}

export const POST = withApiLogging(
  "/api/ai/explain-recommendation",
  handleExplainRecommendation,
);
