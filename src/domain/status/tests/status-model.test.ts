import { describe, expect, it } from "vitest";

import { buildStatusModel, type StatusModelInput } from "@/domain/status";

function input(overrides: Partial<StatusModelInput> = {}): StatusModelInput {
  return {
    routes: [
      {
        capability: "vision",
        provider: "gemini",
        model: "(provider default)",
        fallback: null,
        fallbackModel: null,
      },
      {
        capability: "classification",
        provider: "openai",
        model: "gpt-5.4-nano",
        fallback: "gemini",
        fallbackModel: null,
      },
    ],
    overriddenCapabilities: [],
    budget: { spentUsd: 0, softAlertUsd: 3, hardStopUsd: 5, monthlyBudgetUsd: 5 },
    configured: { gemini: true, openai: true, supabase: true, open_meteo: true },
    lastCalls: [],
    ...overrides,
  };
}

describe("buildStatusModel", () => {
  it("sorts wiring by capability and flags overrides", () => {
    const model = buildStatusModel(
      input({ overriddenCapabilities: ["vision"] }),
    );
    expect(model.aiWiring.map((w) => w.capability)).toEqual([
      "classification",
      "vision",
    ]);
    expect(model.aiWiring.find((w) => w.capability === "vision")?.override).toBe(true);
    expect(
      model.aiWiring.find((w) => w.capability === "classification")?.override,
    ).toBe(false);
  });

  it("returns services in fixed order", () => {
    const model = buildStatusModel(input());
    expect(model.services.map((s) => s.id)).toEqual([
      "gemini",
      "openai",
      "supabase",
      "open_meteo",
    ]);
  });

  it("unconfigured service → error", () => {
    const model = buildStatusModel(
      input({
        configured: { gemini: true, openai: false, supabase: true, open_meteo: true },
      }),
    );
    expect(model.services.find((s) => s.id === "openai")?.state).toBe("error");
  });

  it("configured with no calls → unknown", () => {
    const model = buildStatusModel(input());
    expect(model.services.find((s) => s.id === "gemini")?.state).toBe("unknown");
    expect(model.services.find((s) => s.id === "gemini")?.lastCall).toBeNull();
  });

  it("uses the newest call per service for state ok/warn", () => {
    const model = buildStatusModel(
      input({
        lastCalls: [
          { serviceId: "gemini", at: "2026-07-12T10:00:00Z", ok: true },
          { serviceId: "gemini", at: "2026-07-12T09:00:00Z", ok: false },
          { serviceId: "supabase", at: "2026-07-12T08:00:00Z", ok: false },
        ],
      }),
    );
    const gemini = model.services.find((s) => s.id === "gemini");
    expect(gemini?.state).toBe("ok");
    expect(gemini?.lastCall?.at).toBe("2026-07-12T10:00:00Z");
    expect(model.services.find((s) => s.id === "supabase")?.state).toBe("warn");
  });

  it("budget thresholds map to states", () => {
    const base = { softAlertUsd: 3, hardStopUsd: 5, monthlyBudgetUsd: 5 };
    expect(
      buildStatusModel(input({ budget: { spentUsd: 1, ...base } })).budget.state,
    ).toBe("ok");
    expect(
      buildStatusModel(input({ budget: { spentUsd: 3, ...base } })).budget.state,
    ).toBe("soft_alert");
    expect(
      buildStatusModel(input({ budget: { spentUsd: 5, ...base } })).budget.state,
    ).toBe("hard_stop");
  });
});
