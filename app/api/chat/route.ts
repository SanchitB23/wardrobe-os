/**
 * POST /api/chat — streaming AI Stylist Chat (server-side only).
 *
 * Streams newline-delimited JSON {@link ChatStreamEvent}s as the agentic loop
 * runs: tool_call / tool_result (Debug), token (answer), then done (usage +
 * latency) or error. The Gemini key never reaches the browser.
 */

import { streamChat } from "@/features/chat/chat.service.server";
import type { ChatRequestBody, ChatStreamEvent } from "@/features/chat/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Request-size caps — bound Gemini token cost per call (RFC-009/M6). */
const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 8000;

function isChatRequest(value: unknown): value is ChatRequestBody {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.messages) &&
    v.messages.length <= MAX_MESSAGES &&
    v.messages.every(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as { content?: unknown }).content === "string" &&
        ((m as { content: string }).content.length <= MAX_CONTENT_CHARS),
    )
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!isChatRequest(body)) {
    return Response.json(
      { error: `Expected { messages: [...] } (≤${MAX_MESSAGES} messages, ≤${MAX_CONTENT_CHARS} chars each).` },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (event: ChatStreamEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const event of streamChat(body as ChatRequestBody)) {
          write(event);
        }
      } catch (error) {
        // Log the detail server-side; return a generic message to the client
        // so provider/SDK internals don't leak (RFC-009/M7).
        console.error("[/api/chat] stream error:", error);
        write({
          type: "error",
          error: "The stylist is unavailable right now. Please try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
