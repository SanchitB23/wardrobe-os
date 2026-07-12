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
import { aiRuntimeMetrics } from "@/runtime/ai";
import type { AIProviderId } from "@/ai/types";
import { logAIUsage } from "@/runtime/logging/ai-usage-logger";
import { withApiLogging } from "@/runtime/logging/api-logger";

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

async function handleVision(request: Request): Promise<Response> {
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

  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
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
    const provider = (analysis.metadata.provider || "gemini") as AIProviderId;
    logAIUsage({
      capability: "vision",
      provider,
      model: analysis.metadata.model || model,
      promptVersion: "vision-engine",
      cacheHit: false,
      usage: null,
      estimatedCostUsd: null,
      latencyMs: analysis.metadata.latencyMs,
      status: "ok",
    });
    aiRuntimeMetrics.record({
      capability: "vision",
      provider,
      model: analysis.metadata.model || model,
      promptVersion: "vision-engine",
      latencyMs: analysis.metadata.latencyMs ?? null,
      costUsd: 0,
      cacheHit: false,
      ok: true,
      usedFallback: false,
    });
    return NextResponse.json({ ok: true, data: analysis });
  } catch (error) {
    // Log detail server-side; return a generic message + safe code (RFC-009/M7).
    console.error("[/api/ai/vision] error:", error);
    const isInvalidInput = error instanceof VisionError && error.code === "invalid_input";
    logAIUsage({
      capability: "vision",
      provider: "gemini",
      model,
      promptVersion: "vision-engine",
      cacheHit: false,
      usage: null,
      estimatedCostUsd: null,
      latencyMs: null,
      status: "error",
      errorCode: error instanceof VisionError ? error.code : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    aiRuntimeMetrics.record({
      capability: "vision",
      provider: "gemini",
      model,
      promptVersion: "vision-engine",
      latencyMs: null,
      costUsd: 0,
      cacheHit: false,
      ok: false,
      usedFallback: false,
    });
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

export const POST = withApiLogging("/api/ai/vision", handleVision);
