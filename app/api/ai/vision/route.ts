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

/** ~8 MB decoded → base64 is ~4/3 larger. Bounds memory + Gemini cost (RFC-009/M6). */
const MAX_IMAGE_BASE64_CHARS = 11_000_000;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

function isVisionRequest(value: unknown): value is VisionRequestBody {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.imageBase64 === "string" &&
    v.imageBase64.length > 0 &&
    v.imageBase64.length <= MAX_IMAGE_BASE64_CHARS &&
    typeof v.mimeType === "string" &&
    ALLOWED_MIME.includes(v.mimeType)
  );
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
      { ok: false, error: "Expected { imageBase64, mimeType } — JPEG/PNG/WebP up to ~8 MB." },
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
    // Log detail server-side; return a generic message + safe code (RFC-009/M7).
    console.error("[/api/ai/vision] error:", error);
    const isInvalidInput = error instanceof VisionError && error.code === "invalid_input";
    return NextResponse.json(
      {
        ok: false,
        error: isInvalidInput ? "The image could not be read." : "Vision analysis failed.",
        code: error instanceof VisionError ? error.code : "unknown",
      },
      { status: isInvalidInput ? 400 : 502 },
    );
  }
}
