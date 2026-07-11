import { describe, expect, it } from "vitest";

import { resolveCapabilityPolicy, mechanicalForCapability } from "@/runtime/ai/CapabilityPolicy";
import { DEFAULT_POLICIES } from "@/runtime/ai/ProviderPolicy";
import {
  activeProvider,
  resolveProviderPreference,
} from "@/runtime/ai/ProviderPreferenceResolver";
import { RuntimeCostEstimator } from "@/runtime/ai/RuntimeCostEstimator";
import { RuntimeBudgetMonitor } from "@/runtime/ai/RuntimeBudgetMonitor";
import { RuntimePolicyResolver } from "@/runtime/ai/RuntimePolicyResolver";
import type { AIRuntimeMetricsSnapshot, MetricRow } from "@/runtime/ai/types";

const ENV = {
  GEMINI_MODEL: "gemini-2.5-flash",
  OPENAI_MODEL_STRUCTURED: "gpt-5.4-mini",
  OPENAI_MODEL_CLASSIFIER: "gpt-5.4-nano",
};

function row(provider: string, estCostUsd: number): MetricRow {
  return {
    capability: "structured",
    provider,
    promptVersion: "adhoc",
    requests: 1,
    cacheHits: 0,
    failures: 0,
    avgLatencyMs: 1,
    lastLatencyMs: 1,
    totalTokens: 100,
    estCostUsd,
  };
}
function snapshot(rows: MetricRow[]): AIRuntimeMetricsSnapshot {
  return {
    byCapabilityProvider: rows,
    totalRequests: rows.length,
    totalCostUsd: rows.reduce((s, r) => s + r.estCostUsd, 0),
  };
}

const budget = { monthlyBudgetUsd: 5, softAlertUsd: 2, hardStopUsd: 5 };

describe("RuntimeCostEstimator", () => {
  const est = new RuntimeCostEstimator();

  it("estimates per-call cost from usage × the price table", () => {
    const cost = est.perCall({ promptTokens: 1000, completionTokens: 1000, totalTokens: 2000 }, "openai", "gpt-5.4-mini");
    expect(cost).toBeGreaterThan(0);
    expect(est.perCall(undefined, "openai", "gpt-5.4-mini")).toBe(0);
  });

  it("sums month-to-date spend for one provider only", () => {
    const snap = snapshot([row("openai", 3), row("gemini", 1), row("openai", 1.5)]);
    expect(est.monthToDate(snap, "openai")).toBe(4.5);
    expect(est.monthToDate(snap, "gemini")).toBe(1);
  });
});

describe("RuntimeBudgetMonitor", () => {
  it("reports status from the live spend source and gates only OpenAI", () => {
    let spend = 1;
    const monitor = new RuntimeBudgetMonitor(budget, () => spend);
    expect(monitor.status()).toMatchObject({ softAlertReached: false, hardStopReached: false, available: true });
    expect(monitor.isProviderAvailable("openai")).toBe(true);
    expect(monitor.isProviderAvailable("gemini")).toBe(true);

    spend = 5; // hard stop
    expect(monitor.status()).toMatchObject({ hardStopReached: true, available: false });
    expect(monitor.isProviderAvailable("openai")).toBe(false);
    expect(monitor.isProviderAvailable("gemini")).toBe(true); // never blocked
  });
});

describe("ProviderPreferenceResolver", () => {
  it("orders primary → fallback with availability flags", () => {
    const pref = resolveProviderPreference(
      { primary: "openai", fallback: "gemini" },
      { isAvailable: (id) => id !== "openai" },
    );
    expect(pref).toEqual([
      { id: "openai", isFallback: false, available: false },
      { id: "gemini", isFallback: true, available: true },
    ]);
  });

  it("activeProvider picks the first available (skips an unavailable primary)", () => {
    const policy = { primary: "openai", fallback: "gemini" } as const;
    expect(activeProvider(policy)).toBe("openai");
    expect(activeProvider(policy, { isAvailable: (id) => id !== "openai" })).toBe("gemini");
  });
});

describe("CapabilityPolicy", () => {
  it("resolves the provider policy per capability and the mechanical method", () => {
    expect(resolveCapabilityPolicy("conversation", DEFAULT_POLICIES).primary).toBe("gemini");
    expect(resolveCapabilityPolicy("structured", DEFAULT_POLICIES)).toEqual({ primary: "openai", fallback: "gemini" });
    expect(mechanicalForCapability("vision")).toBe("vision");
    expect(mechanicalForCapability("structured")).toBe("generate");
  });
});

describe("RuntimePolicyResolver", () => {
  function resolver(spend = 0) {
    const monitor = new RuntimeBudgetMonitor(budget, () => spend);
    return new RuntimePolicyResolver(DEFAULT_POLICIES, monitor, ENV);
  }

  it("resolves capability → provider policy + per-provider model + availability", () => {
    const route = resolver().resolve("structured");
    expect(route.policy).toEqual({ primary: "openai", fallback: "gemini" });
    expect(route.mechanical).toBe("generate");
    expect(route.providers.map((p) => [p.id, p.model, p.available])).toEqual([
      ["openai", "gpt-5.4-mini", true],
      ["gemini", "gemini-2.5-flash", true],
    ]);
    expect(route.isAvailable("openai")).toBe(true);
  });

  it("uses the Nano classifier model for classification", () => {
    expect(resolver().modelFor("classification", "openai")).toBe("gpt-5.4-nano");
    expect(resolver().modelFor("conversation", "gemini")).toBe("gemini-2.5-flash");
  });

  it("describe() surfaces provider, model, fallback, and the active provider", () => {
    const d = resolver().describe("conversation");
    expect(d).toMatchObject({
      capability: "conversation",
      provider: "gemini",
      model: "gemini-2.5-flash",
      fallback: "openai",
      activeProvider: "gemini",
    });
  });

  it("when the OpenAI budget is exhausted, structured's active provider flips to Gemini", () => {
    const r = resolver(5); // hard stop
    expect(r.resolve("structured").isAvailable("openai")).toBe(false);
    expect(r.describe("structured").activeProvider).toBe("gemini"); // fallback
    // Gemini-primary capabilities are unaffected.
    expect(r.describe("conversation").activeProvider).toBe("gemini");
  });
});
