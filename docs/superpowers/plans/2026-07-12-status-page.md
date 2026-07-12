# Status Page (RFC-028) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only `/status` page showing live AI capability→provider wiring, per-service health (passive + manual probes), OpenAI budget guard state, and build info — replacing the stale hardcoded About card.

**Architecture:** Pure domain `buildStatusModel` shapes runtime inputs into a display model. The `/status` page is a **server component** assembling the snapshot directly from `getServerAIRuntime()` + log ring buffer + env presence (same pattern as `app/developer/ai-runtime/page.tsx`) and passing it to a client `StatusView`. Only probes need an API route (`POST /api/status/probe`).

**Tech Stack:** Next.js App Router (server components + route handler), React, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-12-rfc-028-status-page-design.md` · **RFC:** `docs/rfc/RFC-028-Status-Page.md`

## Global Constraints

- Domain (`src/domain/status/`) stays pure — no I/O, time injected (CLAUDE.md rule 6).
- Never render secret values — presence booleans only.
- No automatic probing: probes fire only from the Run checks button.
- AI probes go **through `getServerAIRuntime().run(...)`** so budget guard + cost tracking observe them; provider targeted by picking a capability whose `resolver.describe(capability).provider` equals the target (report `skipped` if none).
- Page and probe handler are `runtime = "nodejs"`, `dynamic = "force-dynamic"`.
- Conventional commits ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; `npm test` green before release.
- **Design refinement vs spec:** `GET /api/status` is replaced by server-component assembly (matches the existing developer page pattern; less code, secrets stay server-side). The spec's `StatusSnapshot` shape is unchanged — it's the domain model.

---

### Task 1: Domain — buildStatusModel

**Files:**
- Create: `src/domain/status/StatusModel.ts`
- Create: `src/domain/status/index.ts`
- Test: `src/domain/status/tests/status-model.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces (used by Task 2's page and Task 3's UI):

```ts
export type ServiceId = "gemini" | "openai" | "supabase" | "open_meteo";
export type ServiceState = "ok" | "warn" | "error" | "unknown";

export type StatusModelInput = {
  routes: {
    capability: string;
    provider: string;
    model: string;
    fallback: string | null;
    fallbackModel: string | null;
  }[];
  overriddenCapabilities: string[]; // capabilities with AI_POLICY_* env set
  budget: {
    spentUsd: number;
    softAlertUsd: number;
    hardStopUsd: number;
    monthlyBudgetUsd: number;
  };
  configured: Record<ServiceId, boolean>;
  lastCalls: { serviceId: ServiceId; at: string; ok: boolean }[]; // newest first
};

export type StatusModel = {
  aiWiring: {
    capability: string;
    primary: string;
    model: string;
    fallback: string | null;
    override: boolean;
  }[];
  services: {
    id: ServiceId;
    configured: boolean;
    lastCall: { at: string; ok: boolean } | null;
    state: ServiceState;
  }[];
  budget: StatusModelInput["budget"] & {
    state: "ok" | "soft_alert" | "hard_stop";
  };
};

export function buildStatusModel(input: StatusModelInput): StatusModel;
```

State rules: not configured → `error`; configured + no lastCall → `unknown`;
lastCall ok → `ok`; lastCall failed → `warn`. Budget: spent ≥ hardStop →
`hard_stop`; spent ≥ softAlert → `soft_alert`; else `ok`. Wiring sorted by
capability; services in fixed order gemini, openai, supabase, open_meteo.

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/status/tests/status-model.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/status/tests/status-model.test.ts`
Expected: FAIL — cannot resolve `@/domain/status`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/status/StatusModel.ts
/**
 * Pure status display model (RFC-028). All I/O happens in the /status server
 * page; this module only shapes the inputs deterministically.
 */

export type ServiceId = "gemini" | "openai" | "supabase" | "open_meteo";
export type ServiceState = "ok" | "warn" | "error" | "unknown";

export const SERVICE_ORDER: ServiceId[] = [
  "gemini",
  "openai",
  "supabase",
  "open_meteo",
];

export type StatusModelInput = {
  routes: {
    capability: string;
    provider: string;
    model: string;
    fallback: string | null;
    fallbackModel: string | null;
  }[];
  overriddenCapabilities: string[];
  budget: {
    spentUsd: number;
    softAlertUsd: number;
    hardStopUsd: number;
    monthlyBudgetUsd: number;
  };
  configured: Record<ServiceId, boolean>;
  lastCalls: { serviceId: ServiceId; at: string; ok: boolean }[];
};

export type StatusModel = {
  aiWiring: {
    capability: string;
    primary: string;
    model: string;
    fallback: string | null;
    override: boolean;
  }[];
  services: {
    id: ServiceId;
    configured: boolean;
    lastCall: { at: string; ok: boolean } | null;
    state: ServiceState;
  }[];
  budget: StatusModelInput["budget"] & {
    state: "ok" | "soft_alert" | "hard_stop";
  };
};

function newestCall(
  lastCalls: StatusModelInput["lastCalls"],
  serviceId: ServiceId,
): { at: string; ok: boolean } | null {
  const calls = lastCalls
    .filter((call) => call.serviceId === serviceId)
    .sort((a, b) => b.at.localeCompare(a.at));
  return calls[0] ? { at: calls[0].at, ok: calls[0].ok } : null;
}

export function buildStatusModel(input: StatusModelInput): StatusModel {
  const overridden = new Set(input.overriddenCapabilities);

  const aiWiring = [...input.routes]
    .sort((a, b) => a.capability.localeCompare(b.capability))
    .map((route) => ({
      capability: route.capability,
      primary: route.provider,
      model: route.model,
      fallback: route.fallback,
      override: overridden.has(route.capability),
    }));

  const services = SERVICE_ORDER.map((id) => {
    const configured = input.configured[id];
    const lastCall = newestCall(input.lastCalls, id);
    const state: ServiceState = !configured
      ? "error"
      : lastCall === null
        ? "unknown"
        : lastCall.ok
          ? "ok"
          : "warn";
    return { id, configured, lastCall, state };
  });

  const budgetState =
    input.budget.spentUsd >= input.budget.hardStopUsd
      ? "hard_stop"
      : input.budget.spentUsd >= input.budget.softAlertUsd
        ? "soft_alert"
        : "ok";

  return {
    aiWiring,
    services,
    budget: { ...input.budget, state: budgetState },
  };
}
```

```ts
// src/domain/status/index.ts
export {
  buildStatusModel,
  SERVICE_ORDER,
  type ServiceId,
  type ServiceState,
  type StatusModel,
  type StatusModelInput,
} from "@/domain/status/StatusModel";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/status/tests/status-model.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/status
git commit -m "feat: pure status display model (RFC-028)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: /status server page + StatusView

**Files:**
- Create: `app/status/page.tsx`
- Create: `src/features/status/components/status-view.tsx`

**Interfaces:**
- Consumes: `buildStatusModel`, `type StatusModel`, `type ServiceId` (Task 1); `getServerAIRuntime()` from `@/ai/server/ai-runtime.server`; `logRingBuffer` from `@/runtime/logging/ring-buffer`; `RouteDescription`/`AICapability` from `@/runtime/ai`; UI primitives `Card*`, `Badge`, `Button` from `components/ui/`.
- Produces: `<StatusView model={StatusModel} version={string} environment={string} />` — client component; Task 3 adds the probe button wiring inside it.

- [ ] **Step 1: Create the server page** (pattern: `app/developer/ai-runtime/page.tsx`)

```tsx
// app/status/page.tsx
import type { Metadata } from "next";

import packageJson from "@/package.json";
import { getServerAIRuntime } from "@/ai/server/ai-runtime.server";
import { buildStatusModel, type ServiceId } from "@/domain/status";
import { StatusView } from "@/features/status/components/status-view";
import type { AICapability } from "@/runtime/ai";
import { logRingBuffer } from "@/runtime/logging/ring-buffer";

export const metadata: Metadata = {
  title: "Status",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function lastCallsFromLogs(): { serviceId: ServiceId; at: string; ok: boolean }[] {
  const calls: { serviceId: ServiceId; at: string; ok: boolean }[] = [];
  for (const record of logRingBuffer.recent({ limit: 200 })) {
    if (record.kind === "ai_usage") {
      const provider = record.provider === "openai" ? "openai" : "gemini";
      calls.push({
        serviceId: provider,
        at: record.timestamp,
        ok: record.level !== "error",
      });
    }
    if (record.kind === "weather_request") {
      calls.push({
        serviceId: "open_meteo",
        at: record.timestamp,
        ok: record.status === "ok" || record.cached,
      });
    }
  }
  return calls;
}

export default function StatusPage() {
  const runtime = getServerAIRuntime();
  const resolver = runtime.getPolicyResolver();

  const routes = (Object.keys(runtime.getPolicies()) as AICapability[]).map(
    (capability) => resolver.describe(capability),
  );

  const overriddenCapabilities = (
    Object.keys(runtime.getPolicies()) as AICapability[]
  ).filter((capability) =>
    Boolean(process.env[`AI_POLICY_${capability.toUpperCase()}`]),
  );

  const budget = runtime.budgetStatus();

  const model = buildStatusModel({
    routes: routes.map((route) => ({
      capability: route.capability,
      provider: route.provider,
      model: route.model,
      fallback: route.fallback,
      fallbackModel: route.fallbackModel,
    })),
    overriddenCapabilities,
    budget: {
      spentUsd: budget.spentUsd,
      softAlertUsd: budget.softAlertUsd,
      hardStopUsd: budget.hardStopUsd,
      monthlyBudgetUsd: budget.monthlyBudgetUsd,
    },
    configured: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
      supabase:
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      open_meteo: true, // keyless public API
    },
    lastCalls: lastCallsFromLogs(),
  });

  return (
    <StatusView
      model={model}
      version={packageJson.version}
      environment={process.env.NODE_ENV ?? "unknown"}
    />
  );
}
```

Notes for the implementer:
- `BudgetStatus` field names: confirm against `src/runtime/ai/BudgetGuard.ts:22`
  (`spentUsd`, `softAlertUsd`, `hardStopUsd`, `monthlyBudgetUsd` — adjust the
  mapping if named differently; TypeScript will tell you).
- If `@/package.json` import is rejected by config, read version via
  `process.env.npm_package_version ?? "dev"` instead.
- Confirm the exact Supabase env var names against `src/lib/supabase/client.ts`.

- [ ] **Step 2: Create `StatusView`** — client component, four cards. Pattern-match card structure from `src/features/about/components/about-view.tsx` (Card, CardHeader, CardTitle, CardContent, Badge rows).

```tsx
// src/features/status/components/status-view.tsx
"use client";

import { ActivityIcon, CircuitBoardIcon, InfoIcon, WalletIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StatusModel } from "@/domain/status";

const SERVICE_LABELS: Record<string, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
  supabase: "Supabase",
  open_meteo: "Open-Meteo",
};

const STATE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ok: "default",
  warn: "secondary",
  error: "destructive",
  unknown: "outline",
};

export function StatusView({
  model,
  version,
  environment,
}: {
  model: StatusModel;
  version: string;
  environment: string;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Status</h1>
        <p className="text-sm text-muted-foreground">
          Live wiring and service health. Read-only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CircuitBoardIcon className="size-4" /> AI Wiring
          </CardTitle>
          <CardDescription>
            Capability routing read live from the runtime policy (RFC-014B).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {model.aiWiring.map((row) => (
            <div key={row.capability} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {row.capability}
                {row.override ? (
                  <Badge variant="outline" className="ml-2">override</Badge>
                ) : null}
              </span>
              <span className="flex items-center gap-1.5">
                <Badge variant="secondary">{row.primary}</Badge>
                <span className="text-xs text-muted-foreground">{row.model}</span>
                {row.fallback ? (
                  <span className="text-xs text-muted-foreground">→ {row.fallback}</span>
                ) : null}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ActivityIcon className="size-4" /> Service Health
          </CardTitle>
          <CardDescription>
            Passive signals — key presence and the most recent real call.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {model.services.map((service) => (
            <div key={service.id} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {SERVICE_LABELS[service.id] ?? service.id}
              </span>
              <span className="flex items-center gap-2">
                {service.lastCall ? (
                  <span className="text-xs text-muted-foreground">
                    last call {new Date(service.lastCall.at).toLocaleTimeString()}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">no recent calls</span>
                )}
                <Badge variant={STATE_VARIANT[service.state]}>{service.state}</Badge>
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <WalletIcon className="size-4" /> OpenAI Budget
          </CardTitle>
          <CardDescription>Budget guard (RFC-014B).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Month to date</span>
            <span>${model.budget.spentUsd.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Soft alert / hard stop</span>
            <span>
              ${model.budget.softAlertUsd.toFixed(2)} / ${model.budget.hardStopUsd.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">State</span>
            <Badge
              variant={
                model.budget.state === "ok"
                  ? "default"
                  : model.budget.state === "soft_alert"
                    ? "secondary"
                    : "destructive"
              }
            >
              {model.budget.state.replace("_", " ")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <InfoIcon className="size-4" /> Build
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Version</span>
            <span>v{version}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Environment</span>
            <span>{environment}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — clean. `npm test` — PASS.
Browser: open `/status` — AI Wiring shows structured/classification → openai
(the stale-card fix, visible proof); services show configured states;
budget + build render.

- [ ] **Step 4: Commit**

```bash
git add app/status src/features/status
git commit -m "feat: /status page with live AI wiring, health, budget (RFC-028)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Probe route + Run checks button

**Files:**
- Create: `app/api/status/probe/route.ts`
- Create: `src/features/status/services/status.service.ts`
- Modify: `src/features/status/components/status-view.tsx` (Run checks button + probed rows)

**Interfaces:**
- Consumes: `getServerAIRuntime()`; `createClient` from `@/lib/supabase/server` (async); `withApiLogging` from `@/runtime/logging/api-logger` (pattern: `app/api/ai/test/route.ts`).
- Produces: `POST /api/status/probe` → `{ results: ProbeResult[] }` where `ProbeResult = { id: ServiceId; ok: boolean; latencyMs: number; skipped?: boolean; error?: string }`; client `runStatusProbes(): Promise<{ data: ProbeResult[] | null; error: Error | null }>`.

- [ ] **Step 1: Create the probe route**

```ts
// app/api/status/probe/route.ts
/**
 * Manual status probes (RFC-028). Never called automatically. AI probes run
 * through the runtime so the budget guard and cost tracker observe them; the
 * provider is targeted by picking a capability it currently serves as primary.
 */

import { NextResponse } from "next/server";

import { getServerAIRuntime } from "@/ai/server/ai-runtime.server";
import type { ServiceId } from "@/domain/status";
import { createClient } from "@/lib/supabase/server";
import type { AICapability } from "@/runtime/ai";
import { withApiLogging } from "@/runtime/logging/api-logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProbeResult = {
  id: ServiceId;
  ok: boolean;
  latencyMs: number;
  skipped?: boolean;
  error?: string;
};

async function timed(
  id: ServiceId,
  fn: () => Promise<void>,
): Promise<ProbeResult> {
  const start = Date.now();
  try {
    await fn();
    return { id, ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    return {
      id,
      ok: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function capabilityFor(provider: "gemini" | "openai"): AICapability | null {
  const aiRuntime = getServerAIRuntime();
  const resolver = aiRuntime.getPolicyResolver();
  const capabilities = Object.keys(aiRuntime.getPolicies()) as AICapability[];
  return (
    capabilities.find(
      (capability) => resolver.describe(capability).provider === provider,
    ) ?? null
  );
}

async function probeAI(provider: "gemini" | "openai"): Promise<ProbeResult> {
  const capability = capabilityFor(provider);
  if (!capability) {
    return { id: provider, ok: true, latencyMs: 0, skipped: true };
  }
  return timed(provider, async () => {
    const result = await getServerAIRuntime().run({
      capability,
      request: {
        system: "You are a health check. Reply with the single word: ok",
        prompt: "ok?",
        maxOutputTokens: 4,
      },
    });
    if (result.status === "error") {
      throw new Error(result.error?.message ?? "AI probe failed");
    }
  });
}

async function probeSupabase(): Promise<ProbeResult> {
  return timed("supabase", async () => {
    const supabase = await createClient();
    const { error } = await supabase
      .from("occasions")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
  });
}

async function probeOpenMeteo(): Promise<ProbeResult> {
  return timed("open_meteo", async () => {
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m",
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  });
}

async function handleProbe(): Promise<Response> {
  const results = await Promise.all([
    probeAI("gemini"),
    probeAI("openai"),
    probeSupabase(),
    probeOpenMeteo(),
  ]);
  return NextResponse.json({ results });
}

export const POST = withApiLogging(handleProbe, { route: "/api/status/probe" });
```

Implementer notes: confirm `withApiLogging`'s exact signature against
`app/api/ai/test/route.ts` usage and `AIRuntimeRequest` field names
(`system`/`prompt`/`maxOutputTokens`) against `src/runtime/ai/types.ts`;
adjust to the real shapes — the behavior (1 tiny request per provider,
routed via the runtime) is what matters. If `run`'s result shape differs
(e.g. `status: "ok" | "cache_hit" | "error"`), branch accordingly.

- [ ] **Step 2: Client service**

```ts
// src/features/status/services/status.service.ts
import type { ServiceId } from "@/domain/status";

export type ProbeResult = {
  id: ServiceId;
  ok: boolean;
  latencyMs: number;
  skipped?: boolean;
  error?: string;
};

export async function runStatusProbes(): Promise<{
  data: ProbeResult[] | null;
  error: Error | null;
}> {
  try {
    const response = await fetch("/api/status/probe", { method: "POST" });
    if (!response.ok) {
      return { data: null, error: new Error(`Probe failed (HTTP ${response.status})`) };
    }
    const body = (await response.json()) as { results: ProbeResult[] };
    return { data: body.results, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error : new Error("Probe failed"),
    };
  }
}
```

- [ ] **Step 3: Wire Run checks into StatusView**

Add to `status-view.tsx`: local state `probeResults` + `probing`; a
`Button` ("Run checks" / "Checking…") in the Service Health card header
calling `runStatusProbes()`; when a result exists for a service row, render
`ok / failed (+latency, probed-at time)` in place of the passive last-call
text, and an inline error line when a probe fails. Skipped AI probes render
"not routed". Keep the component client-only; no automatic invocation.

- [ ] **Step 4: Verify (browser)**

1. `/status` → Run checks → all four turn ok (dev env has all keys).
2. `/developer/ai-runtime` (or runtime statistics) → the AI probe calls appear
   in metrics/cost tracking.
3. `read_console_messages` → no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/status src/features/status
git commit -m "feat: manual status probes with Run checks (RFC-028)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Nav link + About card replacement

**Files:**
- Modify: `src/features/layout/nav-config.ts` (Settings/system group, near line 143)
- Modify: `src/features/about/components/about-view.tsx:34-37` and the card at lines ~90-100

**Interfaces:** consumes nothing new; produces no contracts.

- [ ] **Step 1: Nav entry** — add to the group containing Settings/About (pattern-match neighbors):

```ts
{ label: "Status", href: "/status", icon: ActivityIcon },
```

(import `ActivityIcon` from `lucide-react` alongside the existing icon imports.)

- [ ] **Step 2: About card** — delete the `AI_RUNTIME` array (about-view.tsx:34-37) and replace the card body that mapped it with a single line + link:

```tsx
<p className="text-sm text-muted-foreground">
  Provider wiring is shown live on the{" "}
  <Link href="/status" className="underline underline-offset-2">
    Status page
  </Link>
  .
</p>
```

(import `Link` from `next/link`; keep the card title/icon so the section
doesn't vanish, or fold the line into an adjacent card — implementer's call,
whichever reads better with the surrounding layout.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; browser: nav shows Status; About no longer claims all-Gemini and links through.

- [ ] **Step 4: Commit**

```bash
git add src/features/layout/nav-config.ts src/features/about
git commit -m "feat: status nav link; replace hardcoded About AI card (RFC-028)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Final gates + docs

**Files:**
- Modify: `docs/rfc/RFC-028-Status-Page.md` (Status → Implemented; tick §10)
- Modify: `docs/product/BACKLOG.md`, `docs/rfc/README.md` (rows → Implemented)
- Modify: `CHANGELOG.md` (Unreleased → Added RFC-028 entry)

- [ ] **Step 1: Gates** — `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all green.
- [ ] **Step 2: Browser end-to-end** — `/status` truthful wiring (structured/classification → openai), passive states, Run checks round-trip, About link, no console errors.
- [ ] **Step 3: Docs** — flip statuses, tick acceptance criteria, changelog entry describing the page, probes, and the About-card fix.
- [ ] **Step 4: Commit**

```bash
git add docs CHANGELOG.md
git commit -m "docs: mark RFC-028 implemented (status page)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Release remains owner-initiated (CLAUDE.md rule 13) — do not tag here.
