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

function isChatRequest(value: unknown): value is ChatRequestBody {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.messages) &&
    v.messages.every(
      (m) =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as { content?: unknown }).content === "string",
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
    return Response.json({ error: "Expected { messages: [...] }." }, { status: 400 });
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
        write({
          type: "error",
          error: error instanceof Error ? error.message : String(error),
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
