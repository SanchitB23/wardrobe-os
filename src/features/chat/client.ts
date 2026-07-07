/**
 * Client streaming reader for /api/chat. Yields parsed {@link ChatStreamEvent}s
 * as newline-delimited JSON arrives. No server-only code here.
 */

import type { ChatRequestBody, ChatStreamEvent } from "@/features/chat/types";

export async function* streamChatRequest(
  body: ChatRequestBody,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    let message = "Chat request failed.";
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // keep default
    }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line) yield JSON.parse(line) as ChatStreamEvent;
    }
  }

  const tail = buffer.trim();
  if (tail) yield JSON.parse(tail) as ChatStreamEvent;
}
