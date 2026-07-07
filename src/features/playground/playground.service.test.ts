import { describe, expect, it, vi } from "vitest";

import type {
  AICallOptions,
  AIRequest,
  AIResponse,
  AIService,
  AIStreamChunk,
} from "@/ai/types";
import { PLAYGROUND_BUILDERS } from "@/features/playground/builders";
import { runPlayground } from "@/features/playground/playground.service.server";

function fakeAI(text: string, cached = false): AIService {
  return {
    async generate<T>(_req: AIRequest, _opts?: AICallOptions<T>): Promise<AIResponse<T>> {
      void _req;
      void _opts;
      return {
        text,
        provider: "gemini",
        model: "gemini-2.5-flash",
        finishReason: "stop",
        latencyMs: 42,
        cached,
      } as AIResponse<T>;
    },
    async *stream(): AsyncIterable<AIStreamChunk> {},
    async vision<T>(): Promise<AIResponse<T>> {
      throw new Error("unused");
    },
  };
}

const healthOutput = JSON.stringify({
  summary: "Solid, versatile wardrobe with a couple of gaps.",
  priorities: ["Add a rain jacket"],
  quickWins: ["Re-style stale tops"],
});

const sample = PLAYGROUND_BUILDERS.find((b) => b.id === "wardrobe-health-summary")!;

describe("runPlayground", () => {
  it("returns prompts, parsed response, validation, and latency", async () => {
    const result = await runPlayground(
      { builderId: sample.id, input: sample.sampleInput },
      { ai: fakeAI(healthOutput) },
    );

    expect(result.systemPrompt).toBeTruthy();
    expect(result.userPrompt).toContain("HEALTH REPORT");
    expect(result.responseText).toBe(healthOutput);
    expect(result.validation).toEqual({ valid: true });
    expect(result.responseJson).toMatchObject({ priorities: ["Add a rain jacket"] });
    expect(result.latencyMs).toBe(42);
  });

  it("reports cache off by default and a cache descriptor only when enabled", async () => {
    const ai = fakeAI(healthOutput, true);
    const spy = vi.spyOn(ai, "generate");

    const off = await runPlayground(
      { builderId: sample.id, input: sample.sampleInput },
      { ai },
    );
    expect(off.cached).toBeUndefined(); // caching off → no hit/miss reported
    expect(spy.mock.calls[0][1]?.cache).toBeUndefined();

    const on = await runPlayground(
      { builderId: sample.id, input: sample.sampleInput, cacheEnabled: true },
      { ai },
    );
    expect(on.cached).toBe(true);
    expect(spy.mock.calls[1][1]?.cache?.promptBuilder).toBe(sample.id);
  });

  it("surfaces validation errors for a malformed response instead of throwing", async () => {
    const result = await runPlayground(
      { builderId: sample.id, input: sample.sampleInput },
      { ai: fakeAI('{"summary":"only summary"}') },
    );
    expect(result.validation?.valid).toBe(false);
    expect(result.responseJson).toBeUndefined();
    expect(result.error).toBeUndefined(); // validation failure ≠ hard error
  });

  it("captures provider errors without throwing (prompt still returned)", async () => {
    const failing: AIService = {
      async generate() {
        throw new Error("provider exploded");
      },
      async *stream() {},
      async vision<T>(): Promise<AIResponse<T>> {
        throw new Error("x");
      },
    };
    const result = await runPlayground(
      { builderId: sample.id, input: sample.sampleInput },
      { ai: failing },
    );
    expect(result.error).toBe("provider exploded");
    expect(result.userPrompt).toContain("HEALTH REPORT"); // prompt still built
    expect(result.responseText).toBeUndefined();
  });

  it("returns an error for an unknown builder", async () => {
    const result = await runPlayground(
      { builderId: "does-not-exist", input: {} },
      { ai: fakeAI(healthOutput) },
    );
    expect(result.error).toMatch(/Unknown prompt builder/);
  });
});
