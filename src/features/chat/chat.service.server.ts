/**
 * ChatService — the agentic loop behind the AI Stylist Chat. Server-side only.
 *
 * Architecture: Chat UI → this service → ToolRouter → feature services →
 * repositories → Supabase. The model is given ONLY tool declarations; it never
 * queries the database. Each turn it either requests tool calls (which we route
 * and feed back) or produces the final answer. Emits a stream of events so the
 * UI can show tool calls live (Debug mode), the answer progressively, and the
 * total latency + token usage. Final answers are cached (ADR-006).
 *
 * ChatModel, tool registry, cache, and clock are injectable so the loop is
 * unit-tested with no network.
 */

import { buildAICacheKey } from "@/ai/cache";
import { GeminiChatModel } from "@/ai/chat/gemini-chat-model";
import type { ChatModel, ChatToolSpec } from "@/ai/chat/chat-model";
import { createServerAICache } from "@/ai/server/ai-service.server";
import { ToolRegistry } from "@/ai/tools/tool-registry";
import { ToolRouter } from "@/ai/tools/tool-router";
import { createWardrobeToolRegistry } from "@/ai/tools/wardrobe";
import type { AICache, AIUsage } from "@/ai/types";
import { FUTURE_TOOLS } from "@/features/chat/future-tools";
import type {
  ChatRequestBody,
  ChatStreamEvent,
  ToolTraceEntry,
} from "@/features/chat/types";

const CHAT_TTL_SECONDS = 60 * 60; // 1 hour
const DEFAULT_MAX_STEPS = 6;

const SYSTEM = [
  "You are the Wardrobe OS stylist — a concise, friendly assistant with access to the user's wardrobe ONLY through tools.",
  "For ANY question about the user's wardrobe, recommendations, health, usage, insights, outfits, items, or shopping, you MUST call the relevant tool and answer from its result. Never invent items, scores, or data, and never claim to query a database.",
  "If a needed tool is not available yet, say so briefly and answer from the tools you do have.",
  "Prefer one or two tool calls; keep answers short and specific. This is a fresh session with no long-term memory.",
].join(" ");

export interface ChatServiceDeps {
  model?: ChatModel;
  registry?: ToolRegistry;
  cache?: AICache;
  now?: () => number;
  maxSteps?: number;
}

/** Wardrobe tools + the (future) weather/calendar placeholders. */
export function createChatToolRegistry(): ToolRegistry {
  const registry = createWardrobeToolRegistry();
  for (const tool of FUTURE_TOOLS) registry.register(tool);
  return registry;
}

function addUsage(a: AIUsage | undefined, b: AIUsage | undefined): AIUsage | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    promptTokens: a.promptTokens + b.promptTokens,
    completionTokens: a.completionTokens + b.completionTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

/** Split text into small chunks on word boundaries for progressive rendering. */
/** Heuristic: is this a transient provider error worth one retry? (RFC-009/H5) */
function isTransientChatError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    message.includes("429") ||
    message.includes("500") ||
    message.includes("503") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("unavailable") ||
    message.includes("overloaded")
  );
}

function* chunkText(text: string, size = 60): Generator<string> {
  const words = text.split(/(\s+)/);
  let buffer = "";
  for (const word of words) {
    buffer += word;
    if (buffer.length >= size) {
      yield buffer;
      buffer = "";
    }
  }
  if (buffer) yield buffer;
}

export async function* streamChat(
  body: ChatRequestBody,
  deps: ChatServiceDeps = {},
): AsyncGenerator<ChatStreamEvent> {
  const now = deps.now ?? (() => Date.now());
  const startedMs = now();
  const maxSteps = deps.maxSteps ?? DEFAULT_MAX_STEPS;

  const messages = body.messages ?? [];
  const lastUser = messages[messages.length - 1];
  if (!lastUser || lastUser.role !== "user" || !lastUser.content.trim()) {
    yield { type: "error", error: "The last message must be a non-empty user message." };
    return;
  }

  const model = deps.model ?? new GeminiChatModel();
  const registry = deps.registry ?? createChatToolRegistry();
  const router = new ToolRouter(registry);
  const cache = deps.cache ?? createServerAICache();
  const modelId = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const { key } = buildAICacheKey({
    promptBuilder: "stylist-chat",
    promptVersion: "v1",
    model: modelId,
    input: messages,
  });

  try {
    // Cache hit: replay the final answer, no tool loop.
    const cached = await cache.get(key);
    if (cached) {
      const text = cached.response.text;
      for (const chunk of chunkText(text)) yield { type: "token", text: chunk };
      yield {
        type: "done",
        usage: cached.response.usage,
        latencyMs: now() - startedMs,
        cached: true,
        steps: 0,
        toolTrace: [],
      };
      return;
    }

    const sessionOptions = {
      system: SYSTEM,
      history: messages.slice(0, -1),
      tools: registry.definitions() as ChatToolSpec[],
      model: modelId,
    };

    // Resilience (RFC-009/H5): retry the opening turn once on a transient
    // provider error (429/503/timeout) so a blip doesn't kill the conversation.
    const openTurn = async () => {
      const s = await model.startSession(sessionOptions);
      return { session: s, turn: await s.send({ text: lastUser.content }) };
    };
    let session: Awaited<ReturnType<typeof openTurn>>["session"];
    let turn: Awaited<ReturnType<typeof openTurn>>["turn"];
    try {
      ({ session, turn } = await openTurn());
    } catch (error) {
      if (!isTransientChatError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400));
      ({ session, turn } = await openTurn());
    }
    let usage = turn.usage;
    const toolTrace: ToolTraceEntry[] = [];
    let steps = 0;

    while (turn.toolCalls && turn.toolCalls.length > 0 && steps < maxSteps) {
      steps++;
      const calls = turn.toolCalls;
      for (const call of calls) {
        yield { type: "tool_call", id: call.id, name: call.name, args: call.args };
      }

      const timed = await Promise.all(
        calls.map(async (call) => {
          const t0 = now();
          const result = await router.route({ name: call.name, args: call.args, id: call.id });
          return { call, result, latencyMs: now() - t0 };
        }),
      );

      for (const { call, result, latencyMs } of timed) {
        const entry: ToolTraceEntry = {
          name: call.name,
          args: call.args,
          ok: result.ok,
          data: result.ok ? result.data : undefined,
          error: result.ok ? undefined : result.error,
          latencyMs,
        };
        toolTrace.push(entry);
        yield { type: "tool_result", name: call.name, ok: result.ok, data: entry.data, error: entry.error, latencyMs };
      }

      turn = await session.send({
        toolResults: timed.map(({ call, result }) => ({
          id: call.id,
          name: call.name,
          ok: result.ok,
          data: result.ok ? result.data : undefined,
          error: result.ok ? undefined : result.error,
        })),
      });
      usage = addUsage(usage, turn.usage);
    }

    const finalText =
      turn.text && turn.text.trim()
        ? turn.text
        : "I couldn't complete that with the available tools. Try rephrasing.";

    for (const chunk of chunkText(finalText)) yield { type: "token", text: chunk };

    // Cache the successful answer.
    const nowMs = now();
    await cache.set({
      key,
      provider: "gemini",
      model: modelId,
      promptBuilder: "stylist-chat",
      promptVersion: "v1",
      inputHash: key,
      response: {
        text: finalText,
        provider: "gemini",
        model: modelId,
        finishReason: "stop",
        usage,
      },
      metadata: { steps },
      createdAt: new Date(nowMs).toISOString(),
      expiresAt: new Date(nowMs + CHAT_TTL_SECONDS * 1000).toISOString(),
    });

    yield {
      type: "done",
      usage,
      latencyMs: now() - startedMs,
      cached: false,
      steps,
      toolTrace,
    };
  } catch (error) {
    yield {
      type: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
