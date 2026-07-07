"use client";

import { useCallback, useRef, useState } from "react";

import { streamChatRequest } from "@/features/chat/client";
import type { ChatMessage, ChatTurn, ToolTraceEntry } from "@/features/chat/types";

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `m${idCounter}`;
}

/**
 * Session-only stylist chat state. Holds the conversation in memory (no
 * persistence), streams assistant responses, and records per-message tool
 * traces, usage, latency, and cache status.
 */
export function useStylistChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const patch = useCallback((id: string, update: Partial<ChatMessage>) => {
    setMessages((prev) =>
      prev.map((message) => (message.id === id ? { ...message, ...update } : message)),
    );
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const userMessage: ChatMessage = { id: nextId(), role: "user", content: trimmed };
      const assistantId = nextId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        streaming: true,
        toolTrace: [],
      };

      // Build the wire history from the visible conversation + the new turn.
      const priorTurns: ChatTurn[] = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const wireMessages: ChatTurn[] = [...priorTurns, { role: "user", content: trimmed }];

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;
      const trace: ToolTraceEntry[] = [];
      let content = "";

      try {
        for await (const event of streamChatRequest(
          { messages: wireMessages },
          controller.signal,
        )) {
          switch (event.type) {
            case "tool_call":
              // Provisional trace entry (result fills in on tool_result).
              break;
            case "tool_result":
              trace.push({
                name: event.name,
                args: {},
                ok: event.ok,
                data: event.data,
                error: event.error,
                latencyMs: event.latencyMs,
              });
              patch(assistantId, { toolTrace: [...trace] });
              break;
            case "token":
              content += event.text;
              patch(assistantId, { content });
              break;
            case "done":
              patch(assistantId, {
                streaming: false,
                usage: event.usage,
                latencyMs: event.latencyMs,
                cached: event.cached,
                toolTrace: event.toolTrace.length ? event.toolTrace : trace,
              });
              break;
            case "error":
              patch(assistantId, { streaming: false, error: event.error });
              break;
          }
        }
      } catch (error) {
        patch(assistantId, {
          streaming: false,
          error: error instanceof Error ? error.message : "Chat failed.",
        });
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        // If nothing streamed and no error was set, leave a gentle note.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.streaming
              ? { ...m, streaming: false }
              : m,
          ),
        );
      }
    },
    [isStreaming, messages, patch],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
  }, []);

  return { messages, isStreaming, send, stop, reset };
}
