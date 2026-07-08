/**
 * POST /api/ai/explain-lifestyle-plan (RFC-006) — optional explanation of a
 * Lifestyle Plan. Body: a curated LifestylePlanExplanationInput (deterministic
 * plan outputs only — never the wardrobe/DB/context). Server-side only; the AI
 * only explains, never plans. Returns { ok, data, cached } or a structured error.
 */

import { NextResponse } from "next/server";

import type { LifestylePlanExplanationInput } from "@/ai/schemas/LifestylePlanExplanation.schema";
import { AIError } from "@/ai/types";
import { explainLifestylePlan } from "@/features/lifestyle/services/LifestyleExplanationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isExplanationInput(value: unknown): value is LifestylePlanExplanationInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.planScore === "number" &&
    typeof v.packingConfidence === "number" &&
    typeof v.trip === "object" &&
    Array.isArray(v.dailyOutfits)
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!isExplanationInput(body)) {
    return NextResponse.json(
      { ok: false, error: "Expected a LifestylePlanExplanationInput." },
      { status: 400 },
    );
  }

  try {
    const { explanation, cached } = await explainLifestylePlan(body);
    return NextResponse.json({ ok: true, data: explanation, cached });
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
