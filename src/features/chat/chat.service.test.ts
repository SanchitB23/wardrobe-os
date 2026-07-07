import { describe, expect, it, vi } from "vitest";

import { buildAICacheKey } from "@/ai/cache";
import { InMemoryAICache } from "@/ai/cache/ai-cache";
import type { ChatModel, ChatSession, ChatTurnResult } from "@/ai/chat/chat-model";
import { objectParams } from "@/ai/tools/json-schema";
import { ToolRegistry } from "@/ai/tools/tool-registry";
import type { AITool } from "@/ai/tools/types";
import { streamChat, type ChatServiceDeps } from "@/features/chat/chat.service.server";
import type { ChatStreamEvent, ChatTurn } from "@/features/chat/types";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const healthTool: AITool = {
  name: "getWardrobeHealth",
  description: "health",
  parameters: objectParams({}),
  async execute() {
    return { overallScore: 72 };
  },
};

function registry(): ToolRegistry {
  return new ToolRegistry([healthTool]);
}

/** Fake model that returns a scripted sequence of turns; records sends. */
function fakeModel(turns: ChatTurnResult[]) {
  const sends: unknown[] = [];
  let started = 0;
  let i = 0;
  const session: ChatSession = {
    async send(input) {
      sends.push(input);
      const turn = turns[Math.min(i, turns.length - 1)];
      i += 1;
      return turn;
    },
  };
  const model: ChatModel = {
    id: "fake",
    async startSession() {
      started += 1;
      return session;
    },
  };
  return { model, sends, startedCount: () => started };
}

function fixedClock() {
  let t = 1000;
  return () => (t += 5);
}

async function collect(gen: AsyncGenerator<ChatStreamEvent>): Promise<ChatStreamEvent[]> {
  const out: ChatStreamEvent[] = [];
  for await (const event of gen) out.push(event);
  return out;
}

function run(messages: ChatTurn[], deps: ChatServiceDeps) {
  return collect(streamChat({ messages }, { now: fixedClock(), ...deps }));
}

const userMsg: ChatTurn[] = [{ role: "user", content: "How healthy is my wardrobe?" }];

describe("streamChat", () => {
  it("calls a tool then streams the final answer with usage + latency", async () => {
    const { model } = fakeModel([
      {
        toolCalls: [{ name: "getWardrobeHealth", args: {} }],
        usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
      },
      { text: "Your wardrobe scores 72/100 — solid.", usage: { promptTokens: 5, completionTokens: 8, totalTokens: 13 } },
    ]);
    const events = await run(userMsg, { model, registry: registry(), cache: new InMemoryAICache() });

    const types = events.map((e) => e.type);
    expect(types).toContain("tool_call");
    expect(types).toContain("tool_result");
    expect(types).toContain("token");

    const toolResult = events.find((e) => e.type === "tool_result");
    expect(toolResult).toMatchObject({ name: "getWardrobeHealth", ok: true, data: { overallScore: 72 } });

    const text = events.filter((e) => e.type === "token").map((e) => (e as { text: string }).text).join("");
    expect(text).toContain("72");

    const done = events.at(-1);
    expect(done).toMatchObject({ type: "done", cached: false, steps: 1 });
    if (done?.type === "done") {
      expect(done.usage?.totalTokens).toBe(25); // 12 + 13 aggregated
      expect(done.toolTrace).toHaveLength(1);
      expect(done.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("serves a cache hit without invoking the model", async () => {
    const cache = new InMemoryAICache();
    const { key } = buildAICacheKey({
      promptBuilder: "stylist-chat",
      promptVersion: "v1",
      model: MODEL,
      input: userMsg,
    });
    await cache.set({
      key,
      provider: "gemini",
      model: MODEL,
      promptBuilder: "stylist-chat",
      promptVersion: "v1",
      inputHash: key,
      response: {
        text: "Cached: your wardrobe is healthy.",
        provider: "gemini",
        model: MODEL,
        finishReason: "stop",
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
      },
      createdAt: new Date(0).toISOString(),
      expiresAt: null,
    });

    const spy = fakeModel([{ text: "should not be used" }]);
    const events = await run(userMsg, { model: spy.model, registry: registry(), cache });

    const done = events.at(-1);
    expect(done).toMatchObject({ type: "done", cached: true, steps: 0 });
    const text = events.filter((e) => e.type === "token").map((e) => (e as { text: string }).text).join("");
    expect(text).toContain("Cached");
    expect(spy.startedCount()).toBe(0); // model never started
  });

  it("stops at maxSteps when the model keeps requesting tools", async () => {
    const { model } = fakeModel([
      { toolCalls: [{ name: "getWardrobeHealth", args: {} }] }, // always tools
    ]);
    const events = await run(userMsg, {
      model,
      registry: registry(),
      cache: new InMemoryAICache(),
      maxSteps: 2,
    });
    const done = events.at(-1);
    expect(done).toMatchObject({ type: "done", steps: 2 });
    const toolResults = events.filter((e) => e.type === "tool_result");
    expect(toolResults).toHaveLength(2); // one per step, capped
  });

  it("emits an error event when the model throws", async () => {
    const model: ChatModel = {
      id: "boom",
      async startSession() {
        return {
          async send() {
            throw new Error("gemini overloaded");
          },
        };
      },
    };
    const events = await run(userMsg, { model, registry: registry(), cache: new InMemoryAICache() });
    expect(events.at(-1)).toMatchObject({ type: "error", error: "gemini overloaded" });
  });

  it("rejects an empty or non-user last message", async () => {
    const events = await run([{ role: "assistant", content: "hi" }], {
      model: fakeModel([{ text: "x" }]).model,
      registry: registry(),
      cache: new InMemoryAICache(),
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "error" });
  });

  it("caches the answer after a successful run", async () => {
    const cache = new InMemoryAICache();
    const setSpy = vi.spyOn(cache, "set");
    const { model } = fakeModel([{ text: "All good!", usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }]);
    await run(userMsg, { model, registry: registry(), cache });
    expect(setSpy).toHaveBeenCalledOnce();
    expect(setSpy.mock.calls[0][0]).toMatchObject({ promptBuilder: "stylist-chat" });
  });
});
