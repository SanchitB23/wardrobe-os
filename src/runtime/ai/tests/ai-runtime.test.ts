import { describe, expect, it, vi } from "vitest";

import type {
  AICapabilities,
  AIProvider,
  AIProviderId,
  AIRequest,
  AIResponse,
  ResponseParser,
} from "@/ai/types";
import { AIRuntime } from "@/runtime/ai/AIRuntime";
import { resolveProvider, mechanicalFor } from "@/runtime/ai/CapabilityRouter";
import { loadPolicies, DEFAULT_POLICIES } from "@/runtime/ai/ProviderPolicy";
import { PromptRegistry } from "@/runtime/ai/PromptRegistry";
import { RuntimeMetrics } from "@/runtime/ai/RuntimeMetrics";
import { estimateCost } from "@/runtime/ai/CostTracker";
import { inCandidateArm } from "@/runtime/ai/PromptVersion";
import type { AIRuntimePolicies } from "@/runtime/ai/types";

const CAPS: AICapabilities = { generate: true, stream: true, vision: true, structuredOutput: true };

function fakeProvider(
  id: AIProviderId,
  impl?: (req: AIRequest) => AIResponse | Promise<AIResponse>,
): AIProvider {
  const respond = impl ?? ((): AIResponse => ({
    text: `${id}-ok`,
    provider: id,
    model: `${id}-model`,
    finishReason: "stop",
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    latencyMs: 12,
  }));
  return {
    id,
    capabilities: CAPS,
    generate: vi.fn(async (req: AIRequest) => respond(req)),
    async *stream() {},
    vision: vi.fn(async (req: AIRequest) => respond(req)),
  };
}

function throwingProvider(id: AIProviderId, message = "boom"): AIProvider {
  return {
    id,
    capabilities: CAPS,
    generate: vi.fn(async () => {
      throw new Error(message);
    }),
    async *stream() {},
    vision: vi.fn(async () => {
      throw new Error(message);
    }),
  };
}

const policies = (p: Partial<AIRuntimePolicies>): AIRuntimePolicies => ({
  ...DEFAULT_POLICIES,
  ...p,
});

// ---------------------------------------------------------------------------
// Capability routing + policies
// ---------------------------------------------------------------------------

describe("capability routing + policies", () => {
  it("resolves a capability to its policy provider", () => {
    const pol = policies({ explanation: { primary: "openai", fallback: "gemini" } });
    expect(resolveProvider("explanation", pol)).toEqual({ primary: "openai", fallback: "gemini" });
  });

  it("maps vision to vision() and everything else to generate()", () => {
    expect(mechanicalFor("vision")).toBe("vision");
    expect(mechanicalFor("explanation")).toBe("generate");
    expect(mechanicalFor("summarization")).toBe("generate");
  });

  it("loads env policy overrides (AI_POLICY_<CAP>=primary,fallback)", () => {
    const loaded = loadPolicies({ AI_POLICY_EXPLANATION: "openai,gemini" });
    expect(loaded.explanation).toEqual({ primary: "openai", fallback: "gemini" });
    // untouched capabilities keep defaults
    expect(loaded.vision).toEqual(DEFAULT_POLICIES.vision);
  });
});

// ---------------------------------------------------------------------------
// Provider routing: primary / fallback / retry
// ---------------------------------------------------------------------------

describe("AIRuntime — routing, fallback, retry", () => {
  it("routes to the primary provider", async () => {
    const runtime = new AIRuntime({
      providers: [fakeProvider("openai"), fakeProvider("gemini")],
      policies: policies({ explanation: { primary: "openai", fallback: "gemini" } }),
    });
    const result = await runtime.run({ capability: "explanation", request: { prompt: "hi" } });
    expect(result.servedBy).toBe("openai");
    expect(result.usedFallback).toBe(false);
    expect(result.text).toBe("openai-ok");
  });

  it("falls back to the secondary provider when the primary fails", async () => {
    const runtime = new AIRuntime({
      providers: [throwingProvider("openai"), fakeProvider("gemini")],
      policies: policies({ explanation: { primary: "openai", fallback: "gemini" } }),
    });
    const result = await runtime.run({ capability: "explanation", request: { prompt: "hi" } });
    expect(result.servedBy).toBe("gemini");
    expect(result.usedFallback).toBe(true);
  });

  it("disableFallback pins to the primary and never touches the fallback", async () => {
    const primary = throwingProvider("gemini");
    const fallback = fakeProvider("openai");
    const runtime = new AIRuntime({
      providers: [primary, fallback],
      policies: policies({ conversation: { primary: "gemini", fallback: "openai" } }),
    });
    // Primary (gemini) throws; without fallback the whole chain fails.
    await expect(
      runtime.run({
        capability: "conversation",
        request: { prompt: "ok?" },
        disableFallback: true,
      }),
    ).rejects.toThrow(/all providers failed/i);
    // The fallback provider must never be invoked — the probe measures gemini alone.
    expect(fallback.generate).not.toHaveBeenCalled();
  });

  it("retries a retryable failure before moving on", async () => {
    let calls = 0;
    const flaky = fakeProvider("gemini", () => {
      calls += 1;
      if (calls === 1) throw Object.assign(new Error("temporary"), { retryable: true });
      return { text: "ok", provider: "gemini", model: "m", finishReason: "stop" } as AIResponse;
    });
    // AIError-less errors are treated as retryable.
    const runtime = new AIRuntime({
      providers: [flaky],
      policies: policies({ explanation: { primary: "gemini" } }),
      retries: 2,
      sleep: async () => {},
    });
    const result = await runtime.run({ capability: "explanation", request: { prompt: "x" } });
    expect(result.text).toBe("ok");
    expect(calls).toBe(2);
  });

  it("throws when all providers in the chain fail", async () => {
    const runtime = new AIRuntime({
      providers: [throwingProvider("openai"), throwingProvider("gemini")],
      policies: policies({ explanation: { primary: "openai", fallback: "gemini" } }),
    });
    await expect(
      runtime.run({ capability: "explanation", request: { prompt: "hi" } }),
    ).rejects.toThrow(/all providers failed/i);
  });
});

// ---------------------------------------------------------------------------
// Structured output
// ---------------------------------------------------------------------------

describe("AIRuntime — structured output", () => {
  const parser: ResponseParser<{ ok: boolean }> = {
    schema: { name: "test", validate: () => ({ valid: true }) },
    parse: (raw) => (raw.includes("ok") ? { ok: true, data: { ok: true } } : { ok: false, errors: ["bad"] }),
  };

  it("validates + attaches parsed output", async () => {
    const runtime = new AIRuntime({
      providers: [fakeProvider("gemini")],
      policies: policies({ explanation: { primary: "gemini" } }),
    });
    const result = await runtime.run({ capability: "explanation", request: { prompt: "x" }, parser });
    expect(result.parsed).toEqual({ ok: true });
  });

  it("falls back to the secondary provider when the primary's output fails validation", async () => {
    const badPrimary = fakeProvider("gemini", () => ({
      text: "nope — truncated garbage",
      provider: "gemini",
      model: "m",
      finishReason: "length",
    }));
    const runtime = new AIRuntime({
      providers: [badPrimary, fakeProvider("openai")],
      policies: policies({ explanation: { primary: "gemini", fallback: "openai" } }),
    });
    const result = await runtime.run({ capability: "explanation", request: { prompt: "x" }, parser });
    expect(result.parsed).toEqual({ ok: true });
    expect(result.servedBy).toBe("openai");
    expect(result.usedFallback).toBe(true);
  });

  it("throws when every provider's output fails validation", async () => {
    const bad = (id: "gemini" | "openai") =>
      fakeProvider(id, () => ({ text: "nope", provider: id, model: "m", finishReason: "stop" }));
    const runtime = new AIRuntime({
      providers: [bad("gemini"), bad("openai")],
      policies: policies({ explanation: { primary: "gemini", fallback: "openai" } }),
    });
    await expect(
      runtime.run({ capability: "explanation", request: { prompt: "x" }, parser }),
    ).rejects.toThrow(/all providers failed/i);
  });

  it("throws ParseError on invalid output", async () => {
    const runtime = new AIRuntime({
      providers: [fakeProvider("gemini", () => ({ text: "nope", provider: "gemini", model: "m", finishReason: "stop" }))],
      policies: policies({ explanation: { primary: "gemini" } }),
    });
    await expect(
      runtime.run({ capability: "explanation", request: { prompt: "x" }, parser }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Metrics + benchmarking + cost
// ---------------------------------------------------------------------------

describe("AIRuntime — metrics, cost, benchmarking", () => {
  it("records latency / tokens / cost / provider per call", async () => {
    const metrics = new RuntimeMetrics();
    const runtime = new AIRuntime({
      providers: [fakeProvider("gemini")],
      policies: policies({ explanation: { primary: "gemini" } }),
      metrics,
    });
    await runtime.run({ capability: "explanation", request: { prompt: "x" } });
    const snap = metrics.snapshot();
    const row = snap.byCapabilityProvider.find((r) => r.provider === "gemini");
    expect(row?.requests).toBe(1);
    expect(row?.failures).toBe(0);
    expect(row?.totalTokens).toBe(150);
    expect(snap.totalRequests).toBe(1);
  });

  it("records a failure when the whole chain fails", async () => {
    const metrics = new RuntimeMetrics();
    const runtime = new AIRuntime({
      providers: [throwingProvider("gemini")],
      policies: policies({ explanation: { primary: "gemini" } }),
      metrics,
    });
    await expect(runtime.run({ capability: "explanation", request: { prompt: "x" } })).rejects.toThrow();
    const row = metrics.snapshot().byCapabilityProvider.find((r) => r.provider === "gemini");
    expect(row?.failures).toBe(1);
  });

  it("counts fallbacks and cache savings on the metrics snapshot", async () => {
    const metrics = new RuntimeMetrics();
    metrics.record({
      capability: "explanation",
      provider: "gemini",
      model: "gemini-2.5-flash",
      promptVersion: "adhoc",
      latencyMs: 10,
      costUsd: 0.01,
      cacheHit: false,
      ok: true,
      usedFallback: true,
    });
    metrics.record({
      capability: "explanation",
      provider: "gemini",
      model: "gemini-2.5-flash",
      promptVersion: "adhoc",
      latencyMs: 1,
      costUsd: 0.02,
      cacheHit: true,
      ok: true,
      usedFallback: false,
    });
    const snap = metrics.snapshot();
    expect(snap.totalFallbacks).toBe(1);
    expect(snap.totalCacheSavingsUsd).toBeCloseTo(0.02);
    expect(snap.totalCostUsd).toBeCloseTo(0.01);
    const row = snap.byCapabilityProvider[0];
    expect(row.model).toBe("gemini-2.5-flash");
    expect(row.fallbacks).toBe(1);
    expect(row.cacheSavingsUsd).toBeCloseTo(0.02);
  });

  it("estimateCost uses the price table", () => {
    const cost = estimateCost({ promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 }, "gemini", "gemini-2.5-flash");
    expect(cost).toBeGreaterThan(0);
    expect(estimateCost(undefined, "gemini", "x")).toBe(0);
  });

  it("benchmarks a capability across providers", async () => {
    const runtime = new AIRuntime({
      providers: [fakeProvider("gemini"), throwingProvider("openai")],
      policies: policies({ explanation: { primary: "gemini" } }),
    });
    const result = await runtime.benchmark(
      { capability: "explanation", request: { prompt: "x" } },
      ["gemini", "openai"],
    );
    const gem = result.entries.find((e) => e.provider === "gemini");
    const oai = result.entries.find((e) => e.provider === "openai");
    expect(gem?.ok).toBe(true);
    expect(oai?.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Prompt versioning + experiments
// ---------------------------------------------------------------------------

describe("prompt versioning + experiments", () => {
  function registry(): PromptRegistry {
    return new PromptRegistry()
      .register({ builderId: "explain", version: "1", build: () => ({ prompt: "v1" }) })
      .register({ builderId: "explain", version: "2", build: () => ({ prompt: "v2" }) });
  }

  it("uses the default (control) version and records it", async () => {
    const runtime = new AIRuntime({
      providers: [fakeProvider("gemini")],
      policies: policies({ explanation: { primary: "gemini" } }),
      registry: registry(),
    });
    const result = await runtime.run({
      capability: "explanation",
      builderId: "explain",
      promptContext: { task: "explain", data: {} },
    });
    expect(result.promptVersion).toBe("explain@1");
  });

  it("routes the candidate arm deterministically under an experiment", () => {
    const reg = registry().setExperiment({
      builderId: "explain",
      control: "1",
      candidate: "2",
      candidateShare: 0.5,
    });
    // Deterministic: same key ⇒ same version every time.
    const a = reg.select("explain", "user-42").version;
    const b = reg.select("explain", "user-42").version;
    expect(a).toBe(b);
    // Bucketing is a pure function of the key.
    const shareOn = inCandidateArm("user-42", 1);
    const shareOff = inCandidateArm("user-42", 0);
    expect(shareOn).toBe(true);
    expect(shareOff).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

describe("AIRuntime — determinism", () => {
  it("produces the same result for the same request + policy", async () => {
    const make = () =>
      new AIRuntime({
        providers: [fakeProvider("gemini")],
        policies: policies({ explanation: { primary: "gemini" } }),
      });
    const a = await make().run({ capability: "explanation", request: { prompt: "x" } });
    const b = await make().run({ capability: "explanation", request: { prompt: "x" } });
    expect({ ...a, latencyMs: 0 }).toEqual({ ...b, latencyMs: 0 });
  });
});
