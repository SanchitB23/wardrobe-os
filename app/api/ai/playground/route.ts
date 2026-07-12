/**
 * POST /api/ai/playground — dev/admin tool (req 5, 8).
 *
 * Runs a selected prompt builder against the AI service and returns prompts,
 * response, validation, latency, cache status, and errors. Server-side only
 * (Node runtime); the provider key never reaches the browser.
 */

import { NextResponse } from "next/server";

import { runPlayground } from "@/features/playground/playground.service.server";
import type { PlaygroundRunRequest } from "@/features/playground/types";
import { withApiLogging } from "@/runtime/logging/api-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isRunRequest(value: unknown): value is PlaygroundRunRequest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.builderId === "string" && "input" in v;
}

async function handlePlayground(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRunRequest(body)) {
    return NextResponse.json(
      { error: "Expected { builderId, input }." },
      { status: 400 },
    );
  }

  // The runner captures provider/validation errors into the result, so this
  // route returns 200 with a result object; only malformed requests are 4xx.
  const result = await runPlayground(body);
  return NextResponse.json(result);
}

export const POST = withApiLogging("/api/ai/playground", handlePlayground);
