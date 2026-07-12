import { describe, expect, it, vi } from "vitest";

import { PLAYGROUND_BUILDERS } from "@/features/playground/builders";
import { runPlayground } from "@/features/playground/playground.service.server";
import type { AIRuntime, AIRuntimeRequest, AIRuntimeResult } from "@/runtime/ai";

function fakeRuntime(text: string, cached = false): Pick<AIRuntime, "run"> {
  return {
    async run<T>(req: AIRuntimeRequest<T>): Promise<AIRuntimeResult<T>> {
      return {
        text,
        provider: "gemini",
        model: "gemini-2.5-flash",
        finishReason: "stop",
        latencyMs: 42,
        cached,
        capability: req.capability,
        promptVersion: "adhoc",
        servedBy: "gemini",
        usedFallback: false,
        costUsd: 0,
      } as AIRuntimeResult<T>;
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
      { runtime: fakeRuntime(healthOutput) },
    );

    expect(result.systemPrompt).toBeTruthy();
    expect(result.userPrompt).toContain("HEALTH REPORT");
    expect(result.responseText).toBe(healthOutput);
    expect(result.validation).toEqual({ valid: true });
    expect(result.responseJson).toMatchObject({ priorities: ["Add a rain jacket"] });
    expect(result.latencyMs).toBe(42);
  });

  it("reports cache off by default and a cache descriptor only when enabled", async () => {
    const runtime = fakeRuntime(healthOutput, true);
    const spy = vi.spyOn(runtime, "run");

    const off = await runPlayground(
      { builderId: sample.id, input: sample.sampleInput },
      { runtime },
    );
    expect(off.cached).toBeUndefined();
    expect(spy.mock.calls[0][0].cache).toBeUndefined();

    const on = await runPlayground(
      { builderId: sample.id, input: sample.sampleInput, cacheEnabled: true },
      { runtime },
    );
    expect(on.cached).toBe(true);
    expect(spy.mock.calls[1][0].cache?.promptBuilder).toBe(sample.id);
  });

  it("surfaces validation errors for a malformed response instead of throwing", async () => {
    const result = await runPlayground(
      { builderId: sample.id, input: sample.sampleInput },
      { runtime: fakeRuntime('{"summary":"only summary"}') },
    );
    expect(result.validation?.valid).toBe(false);
    expect(result.responseJson).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it("captures provider errors without throwing (prompt still returned)", async () => {
    const failing: Pick<AIRuntime, "run"> = {
      async run() {
        throw new Error("provider exploded");
      },
    };
    const result = await runPlayground(
      { builderId: sample.id, input: sample.sampleInput },
      { runtime: failing },
    );
    expect(result.error).toBe("provider exploded");
    expect(result.userPrompt).toContain("HEALTH REPORT");
    expect(result.responseText).toBeUndefined();
  });

  it("returns an error for an unknown builder", async () => {
    const result = await runPlayground(
      { builderId: "does-not-exist", input: {} },
      { runtime: fakeRuntime(healthOutput) },
    );
    expect(result.error).toMatch(/Unknown prompt builder/);
  });
});
