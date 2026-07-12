/**
 * Debug route (req 8): GET /api/ai/test
 *
 * Exercises the whole server-side plumbing end to end — orchestrator →
 * GeminiProvider → @google/genai — and returns a small STRUCTURED JSON object
 * parsed and validated from the model. Not a product feature; it exists to
 * prove the wiring works. No recommendation logic (req 10).
 *
 * Server-side only: this handler runs on the Node runtime; the API key never
 * reaches the browser.
 */

import { NextResponse } from "next/server";

import { createJsonResponseParser, objectSchema } from "@/ai/schemas";
import { getServerAIService } from "@/ai/server/ai-service.server";
import { AIError } from "@/ai/types";
import { withApiLogging } from "@/runtime/logging/api-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PingResult {
  ok: boolean;
  message: string;
  model: string;
}

const pingSchema = objectSchema<PingResult>({
  name: "PingResult",
  description: "a health-check acknowledgement",
  jsonHint: '{"ok":true,"message":"hello from Gemini","model":"gemini-2.5-flash"}',
  fields: {
    ok: { type: "boolean" },
    message: { type: "string" },
    model: { type: "string" },
  },
});

async function handleAiTest(request: Request): Promise<Response> {
  void request;
  const ai = getServerAIService();

  try {
    const response = await ai.generate(
      {
        system:
          "You are a health-check endpoint. Reply ONLY with the requested JSON.",
        prompt:
          'Return a JSON object with keys "ok" (true), "message" (a short friendly greeting), and "model" (the model name you are).',
        responseFormat: "json",
        temperature: 0,
        maxTokens: 256,
      },
      { parser: createJsonResponseParser(pingSchema) },
    );

    return NextResponse.json({
      ok: true,
      provider: response.provider,
      model: response.model,
      latencyMs: response.latencyMs,
      usage: response.usage,
      data: response.parsed,
    });
  } catch (error) {
    const status =
      error instanceof AIError && error.code === "provider_error" ? 502 : 500;
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        code: error instanceof AIError ? error.code : "unknown",
      },
      { status },
    );
  }
}

export const GET = withApiLogging("/api/ai/test", handleAiTest);
