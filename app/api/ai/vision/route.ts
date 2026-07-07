/**
 * POST /api/ai/vision (RFC-002) — dev/admin Vision Engine endpoint.
 *
 * Body: { imageBase64, mimeType, source? }. Runs the fixed pipeline
 * (preprocess → Gemini vision provider → normalize → validate) server-side and
 * returns the standardized VisionAnalysis. No DB writes, no inventory, no
 * recommendations, no AI explanation — Vision Engine only.
 */

import { NextResponse } from "next/server";

import { analyzeImage, VisionError, type VisionSource } from "@/domain/vision";
import { getServerVisionProvider } from "@/ai/vision/vision.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VisionRequestBody {
  imageBase64: string;
  mimeType: string;
  source?: VisionSource;
}

function isVisionRequest(value: unknown): value is VisionRequestBody {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.imageBase64 === "string" && typeof v.mimeType === "string";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!isVisionRequest(body)) {
    return NextResponse.json(
      { ok: false, error: "Expected { imageBase64, mimeType }." },
      { status: 400 },
    );
  }

  try {
    const analysis = await analyzeImage(
      {
        kind: "base64",
        data: body.imageBase64,
        mimeType: body.mimeType,
        source: body.source ?? "gallery",
      },
      { provider: getServerVisionProvider() },
    );
    return NextResponse.json({ ok: true, data: analysis });
  } catch (error) {
    const status = error instanceof VisionError && error.code === "invalid_input" ? 400 : 502;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Vision analysis failed.",
        code: error instanceof VisionError ? error.code : "unknown",
      },
      { status },
    );
  }
}
