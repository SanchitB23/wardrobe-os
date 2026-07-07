/**
 * POST /api/ai/explain-buy-vs-skip (RFC-003) — optional explanation of a
 * Buy vs Skip verdict. Body: a BuyVsSkipAnalysis. Server-side only; the AI only
 * explains, never decides. Returns { ok, data } or a structured error.
 */

import { NextResponse } from "next/server";

import { AIError } from "@/ai/types";
import type { BuyVsSkipAnalysis } from "@/domain/acquisition";
import { explainBuyVsSkip } from "@/features/acquisition/services/buy-vs-skip-explanation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAnalysis(value: unknown): value is BuyVsSkipAnalysis {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.decision === "string" && typeof v.score === "number" && "scoreBreakdown" in v;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!isAnalysis(body)) {
    return NextResponse.json({ ok: false, error: "Expected a BuyVsSkipAnalysis." }, { status: 400 });
  }

  try {
    const explanation = await explainBuyVsSkip(body);
    return NextResponse.json({ ok: true, data: explanation });
  } catch (error) {
    const code = error instanceof AIError ? error.code : "unknown";
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to generate explanation.",
        code,
      },
      { status: code === "parse_error" ? 502 : 500 },
    );
  }
}
