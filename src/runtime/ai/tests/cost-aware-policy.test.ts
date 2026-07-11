import { describe, expect, it } from "vitest";

import type { AIProvider, AIProviderId, AIRequest, AIResponse } from "@/ai/types";
import { AIRuntime } from "@/runtime/ai/AIRuntime";
import { DEFAULT_POLICIES, GEMINI_ONLY_POLICIES } from "@/runtime/ai/ProviderPolicy";
import { resolveProvider } from "@/runtime/ai/CapabilityRouter";
import { resolveModel } from "@/runtime/ai/ModelPolicy";
import { evaluateBudget, loadBudgetConfig } from "@/runtime/ai/BudgetGuard";
import { RuntimeMetrics } from "@/runtime/ai/RuntimeMetrics";
import type { MetricSample } from "@/runtime/ai/types";

const ENV = {
  GEMINI_MODEL: "gemini-2.5-flash",
  OPENAI_MODEL_TEXT: "gpt-5.4-mini",
  OPENAI_MODEL_STRUCTURED: "gpt-5.4-mini",
  OPENAI_MODEL_CLASSIFIER: "gpt-5.4-nano",
};

/** Provider that records the last request it saw and echoes the model back. */
function recordingProvider(id: AIProviderId): { provider: AIProvider; last: () => AIRequest | undefined } {
  let lastRequest: AIRequest | undefined;
  const provider: AIProvider = {
    id,
    capabilities: { generate: true, stream: false, vision: true, structuredOutput: true },
    async generate(request) {
      lastRequest = request;
      return {
        text: `${id}-ok`,
        provider: id,
        model: request.model ?? "default",
        finishReason: "stop",
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        latencyMs: 5,
      } satisfies AIResponse;
    },
    async *stream() {},
    async vision(request) {
      lastRequest = request;
      return { text: `${id}-vision`, provider: id, model: request.model ?? "default", finishReason: "stop" };
    },
  };
  return { provider, last: () => lastRequest };
}

function runtime(overrides: Partial<ConstructorParameters<typeof AIRuntime>[0]> = {}) {
  const gemini = recordingProvider("gemini");
  const openai = recordingProvider("openai");
  const rt = new AIRuntime({
    providers: [gemini.provider, openai.provider],
    policies: DEFAULT_POLICIES,
    env: ENV,
    ...overrides,
  });
  return { rt, gemini, openai };
}

// ---------------------------------------------------------------------------
// Provider policy resolution (cost-first defaults)
// ---------------------------------------------------------------------------

describe("cost-first provider policy", () => {
  it("keeps Gemini primary for conversation, explanation, summarization, vision", () => {
    expect(resolveProvider("conversation", DEFAULT_POLICIES).primary).toBe("gemini");
    expect(resolveProvider("explanation", DEFAULT_POLICIES).primary).toBe("gemini");
    expect(resolveProvider("summarization", DEFAULT_POLICIES).primary).toBe("gemini");
    expect(resolveProvider("vision", DEFAULT_POLICIES).primary).toBe("gemini");
  });

  it("uses OpenAI (with Gemini fallback) for structured + classification", () => {
    expect(resolveProvider("structured", DEFAULT_POLICIES)).toEqual({ primary: "openai", fallback: "gemini" });
    expect(resolveProvider("classification", DEFAULT_POLICIES)).toEqual({ primary: "openai", fallback: "gemini" });
  });

  it("GEMINI_ONLY_POLICIES never routes to OpenAI", () => {
    for (const cap of ["structured", "classification", "conversation"] as const) {
      expect(resolveProvider(cap, GEMINI_ONLY_POLICIES).primary).toBe("gemini");
    }
  });
});

// ---------------------------------------------------------------------------
// Model policy resolution
// ---------------------------------------------------------------------------

describe("model policy", () => {
  it("resolves the right model per (capability, provider)", () => {
    expect(resolveModel("conversation", "gemini", ENV)).toBe("gemini-2.5-flash");
    expect(resolveModel("structured", "openai", ENV)).toBe("gpt-5.4-mini");
    expect(resolveModel("classification", "openai", ENV)).toBe("gpt-5.4-nano");
    expect(resolveModel("explanation", "openai", ENV)).toBe("gpt-5.4-mini");
  });

  it("falls back to cost-first defaults when env is unset, never the premium model", () => {
    expect(resolveModel("classification", "openai", {})).toBe("gpt-5.4-nano");
    expect(resolveModel("structured", "openai", {})).toBe("gpt-5.4-mini");
    expect(resolveModel("conversation", "openai", {})).toBe("gpt-5.4-mini");
    expect(resolveModel("conversation", "gemini", {})).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// End-to-end routing: default provider + resolved model per capability
// ---------------------------------------------------------------------------

describe("AIRuntime cost-aware routing", () => {
  it("routes conversation to Gemini with the Gemini model", async () => {
    const { rt, gemini } = runtime();
    const res = await rt.run({ capability: "conversation", request: { prompt: "hi" } });
    expect(res.servedBy).toBe("gemini");
    expect(res.usedFallback).toBe(false);
    expect(gemini.last()?.model).toBe("gemini-2.5-flash");
  });

  it("routes explanation to Gemini (cost-first default)", async () => {
    const { rt } = runtime();
    const res = await rt.run({ capability: "explanation", request: { prompt: "why" } });
    expect(res.servedBy).toBe("gemini");
  });

  it("routes structured to OpenAI with the structured model", async () => {
    const { rt, openai } = runtime();
    const res = await rt.run({ capability: "structured", request: { prompt: "json" } });
    expect(res.servedBy).toBe("openai");
    expect(openai.last()?.model).toBe("gpt-5.4-mini");
  });

  it("routes classification to OpenAI with the Nano classifier model", async () => {
    const { rt, openai } = runtime();
    const res = await rt.run({ capability: "classification", request: { prompt: "label" } });
    expect(res.servedBy).toBe("openai");
    expect(openai.last()?.model).toBe("gpt-5.4-nano");
  });

  it("records provider, tokens, latency, and estimated cost in metrics", async () => {
    const { rt } = runtime();
    await rt.run({ capability: "structured", request: { prompt: "json" } });
    const row = rt
      .metricsSnapshot()
      .byCapabilityProvider.find((r) => r.capability === "structured" && r.provider === "openai");
    expect(row?.requests).toBe(1);
    expect(row?.totalTokens).toBe(30);
    expect(row?.avgLatencyMs).toBe(5);
    expect(row?.estCostUsd).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Budget guard
// ---------------------------------------------------------------------------

describe("OpenAI budget guard", () => {
  it("loads config from env with a $5 default", () => {
    expect(loadBudgetConfig({})).toEqual({ monthlyBudgetUsd: 5, softAlertUsd: 2, hardStopUsd: 5 });
    expect(loadBudgetConfig({ OPENAI_HARD_STOP_USD: "3" }).hardStopUsd).toBe(3);
  });

  it("evaluates soft alert + hard stop thresholds", () => {
    const cfg = { monthlyBudgetUsd: 5, softAlertUsd: 2, hardStopUsd: 5 };
    expect(evaluateBudget(1, cfg)).toMatchObject({ softAlertReached: false, hardStopReached: false, available: true });
    expect(evaluateBudget(2, cfg)).toMatchObject({ softAlertReached: true, hardStopReached: false, available: true });
    expect(evaluateBudget(5, cfg)).toMatchObject({ softAlertReached: true, hardStopReached: true, available: false });
  });

  it("hard stop marks OpenAI unavailable and falls back to Gemini; Gemini keeps working", async () => {
    // Pre-load metrics so OpenAI estimated spend already exceeds the hard stop.
    const metrics = new RuntimeMetrics();
    const spentSample: MetricSample = {
      capability: "structured",
      provider: "openai",
      promptVersion: "adhoc",
      latencyMs: 1,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      costUsd: 10,
      cacheHit: false,
      ok: true,
    };
    metrics.record(spentSample);

    const { rt } = runtime({ metrics, budget: { monthlyBudgetUsd: 5, softAlertUsd: 2, hardStopUsd: 5 } });
    expect(rt.budgetStatus()).toMatchObject({ hardStopReached: true, available: false });

    // structured is OpenAI-primary, but the guard disables OpenAI → Gemini fallback.
    const structured = await rt.run({ capability: "structured", request: { prompt: "json" } });
    expect(structured.servedBy).toBe("gemini");
    expect(structured.usedFallback).toBe(true);

    // Gemini-primary capability is unaffected.
    const convo = await rt.run({ capability: "conversation", request: { prompt: "hi" } });
    expect(convo.servedBy).toBe("gemini");
    expect(convo.usedFallback).toBe(false);
  });
});
