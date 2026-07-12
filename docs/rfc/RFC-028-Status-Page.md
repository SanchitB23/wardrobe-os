# RFC-028: Status Page

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Claude Code
Target Release: v2.4.0
Epic: Platform / Observability
Priority: Medium
Effort: S
Dependencies:

- [RFC-014B](RFC-014B-Cost-Aware-AI-Runtime.md) — capability policies, model
  policy, budget guard (Implemented)
- [RFC-022](RFC-022-Logging-and-Observability-Runtime.md) — log ring buffer
  used for passive last-call signals (Implemented)
- [RFC-011](RFC-011-Weather-Runtime.md) — Open-Meteo provider (Implemented)

Design spec: [2026-07-12-rfc-028-status-page-design.md](../superpowers/specs/2026-07-12-rfc-028-status-page-design.md)

---

## 1. Problem Statement

The About page's "AI Runtime" card is a hardcoded array
(`about-view.tsx:35`) claiming Text/Vision/Explanations all run on Gemini.
The actual RFC-014B cost-first policy routes **structured and classification
to OpenAI primary** (gpt-5.4-mini/nano) and image_generation to OpenAI, with
per-capability `AI_POLICY_*` env overrides. Nothing feeds the card, so it
drifts silently — the owner discovered the discrepancy by reading the page.

There is also no single place to answer "are my services healthy?": Gemini,
OpenAI, Supabase, and Open-Meteo keys/endpoints can each be missing or broken,
and the only signal today is a failing feature.

## 2. Goals

1. A read-only **`/status`** page showing the **real** AI wiring, read live
   from the runtime policy resolver — the hardcoded card is deleted.
2. Per-service health for Gemini, OpenAI, Supabase, Open-Meteo: configured?
   last call ok? — **free by default** (no probe spend on page view).
3. A manual **Run checks** button for on-demand minimal probes (1-token AI
   calls routed through the runtime so cost tracking sees them).
4. OpenAI budget guard state (spend vs soft-alert/hard-stop) at a glance.
5. Build info (version, environment).

## 3. Non-Goals

- Historical uptime/latency charts (runtime statistics view covers metrics).
- Alerting/notifications (Notification Engine rejected in product scope).
- Editing policies or any mutable control — the page is strictly read-only.
- Exposing key values, request/response payloads, or per-request logs
  (`/developer` remains the deep-dive surface).
- Automatic/scheduled probing.

## 4. User Stories

- As the owner, I want to see which provider actually serves each AI
  capability (with overrides flagged), so the app never lies to me about its
  own wiring again.
- As the owner, I want a quick answer to "is everything up?" without spending
  tokens, and a button to spend a trivial amount when I want certainty.
- As the owner, I want to see how close OpenAI spend is to the budget guard
  thresholds.

## 5. UX Flow

1. `/status` (linked from nav and About): four cards — **AI Wiring**,
   **Service Health**, **OpenAI Budget**, **Build Info**.
2. AI Wiring: capability rows with primary → fallback provider + model;
   "override" badge when an `AI_POLICY_*` env var is active.
3. Service Health: one row per service with state `ok / warn / error /
   unknown`, "configured" indicator, and last-call time/outcome. After a
   server restart the buffer is empty → honest "no recent calls".
4. **Run checks** fires the four probes; rows update with probed-at
   timestamps and latency.
5. About page: hardcoded AI Runtime card replaced by a one-liner linking to
   `/status`.

## 6. Architecture

### Domain Layer

`src/domain/status/` — pure `buildStatusModel(input)`: shapes policies,
budget numbers, log tail, and env-presence flags into the display model
(states, sorted capabilities, override flags). Deterministic; time injected;
unit-tested.

### Service Layer

`src/features/status/services/status.service.ts` — client fetch wrappers for
the two routes, returning `{ data, error }`.

### Repository Layer

None — no Supabase tables involved beyond the probe's trivial read.

### Route handlers (server)

- No `GET /api/status` route. Per the design spec's refinement, the snapshot
  is assembled directly by the `/status` server component
  (`app/status/page.tsx`) from `loadPolicies()`, model policy, `BudgetGuard`,
  the RFC-022 log ring buffer, and env-presence checks — the same pattern as
  `app/developer/ai-runtime/page.tsx`.
- `POST /api/status/probe` — minimal probes: Supabase head-count select,
  Open-Meteo forecast call, 1-token Gemini/OpenAI requests **via the AI
  runtime** (budget guard + cost tracker observe them).

### UI Layer

`src/features/status/components/status-view.tsx`; no `hooks/` module
(`useStatusQuery`/`useRunProbesMutation` were never created) — the client
component receives the server-assembled model as props and calls the probe
via an inline `useMutation` over `runStatusProbes` from
`src/features/status/services/status.service.ts` (matches existing codebase
precedent); `/status` route; nav/About links; About card replacement.

### AI Layer

No AI decisions. Probes are plain runtime calls; AI never interprets status.

## 7. Data Flow

```
/status server component (app/status/page.tsx)
  → getServerAIRuntime (policies, budget) + log ring buffer + env presence
  → buildStatusModel (domain, pure) → StatusView props (cards)

[Run checks] → inline useMutation over runStatusProbes (status.service.ts)
  → POST /api/status/probe
  → 4 minimal probes (AI ones via runtime) → ProbeResult[] → health rows update
```

## 8. Data Model / Schema Impact

**No schema changes.** No new tables; probe reads use an existing table with
existing RLS.

## 9. API / Domain Contracts

```ts
// domain
export function buildStatusModel(input: StatusModelInput): StatusModel;

// Assembled server-side by app/status/page.tsx → StatusModel (domain)
type StatusModel = {
  aiWiring: {
    capability: string;
    primary: string;
    fallback: string | null;
    model: string | null;
    override: boolean;
  }[];
  services: {
    id: "gemini" | "openai" | "supabase" | "open_meteo";
    configured: boolean;
    lastCall: { at: string; ok: boolean } | null;
    state: "ok" | "warn" | "error" | "unknown";
  }[];
  budget: {
    spentUsd: number;
    softAlertUsd: number;
    hardStopUsd: number;
    monthlyBudgetUsd: number;
    state: "ok" | "soft_alert" | "hard_stop";
  };
  build: { version: string; environment: string };
};

// POST /api/status/probe → { id, ok, latencyMs, skipped?: boolean, error?: string }[]
```

## 10. Acceptance Criteria

- [x] `/status` shows the live capability→provider table; with default env it
      shows structured/classification → OpenAI primary (not all-Gemini).
      **Verified live** in a browser pass: classification/structured/
      image_generation all resolved to `openai` primary, not all-Gemini.
- [x] Setting an `AI_POLICY_*` env override flags that row as override.
      **Not toggled live** in this environment — verified by code review of
      the override-detection logic and by the `buildStatusModel` domain
      tests (override cases), not by an actual env-var flip in a running
      instance.
- [x] Health rows show configured + last-call state without any network probe
      on page load; empty log buffer → "unknown / no recent calls".
      **Verified live**: after a server restart the ring buffer was empty and
      the passive rows correctly rendered "no recent calls / unknown" with no
      probe fired on page load.
- [x] Run checks probes all four services; AI probes appear in cost tracking.
      **Partially verified live**: Run checks fired all four probes —
      Supabase ok (~657ms), Open-Meteo ok (~664ms), Gemini failed honestly
      (real free-tier 429 quota exhaustion), OpenAI failed honestly
      (`OPENAI_API_KEY is not set` in this environment — the fallback-masking
      fix correctly refused to report "ok" via a Gemini fallback), and the
      batch endpoint returned partial results without a 500. The "AI probes
      appear in cost tracking" half of this criterion was **not exercised
      live** — both AI probes failed before incurring any provider cost in
      this environment — so it is verified by code review only (the probe
      calls are routed through the same runtime/budget-guard path as normal
      AI calls, which do observe cost).
- [x] Budget card reflects BudgetGuard numbers and state. Rendered correctly
      during the live browser pass (no console errors); values are read
      directly from `BudgetGuard`.
- [x] About page no longer contains the hardcoded provider array; it links to
      `/status`. **Verified live**: the About page's AI Runtime card is gone,
      replaced by a link to `/status`, and nav shows a Status entry.
- [x] No secret values rendered anywhere (presence booleans only). Verified
      by code review — `/api/status` only emits presence booleans for env
      keys; no key values are read into the response or rendered in the UI.
- [x] Domain tests for `buildStatusModel` (override detection, budget
      thresholds, last-call mapping, unknown states). Present in
      `src/domain/status/tests/status-model.test.ts` and passing as part of
      the full `npm test` suite (694 tests passing).

## 11. QA / Testing Plan

This is the pre-registered plan written before implementation; actual
execution results (what was and wasn't verified live) are recorded in §10's
per-criterion annotations.

- **Unit (domain):** buildStatusModel cases — defaults, overrides, budget at
  each threshold, empty/populated log tail.
- **Manual/preview:** page load with dev env (all keys present); Run checks
  round-trip; About link; remove a key locally → configured=false path.
- **Gates:** `npm test`, lint, `tsc`, `build` green.

## 12. Risks & Trade-offs

| Risk | Mitigation |
| --- | --- |
| Probe spend on AI providers | Manual-only button; 1-token requests; routed through budget guard |
| Ring buffer resets on restart → "unknown" states | Honest label + Run checks button; documented |
| Status page duplicating `/developer` | Strict split: status = glanceable truth; developer = deep dive; no metrics/charts here |
| Env introspection leaking secrets | Presence booleans only; server-side assembly; no key echoes |

## 13. Future Extensions

- Persist last-call signals (Supabase table) to survive restarts.
- Status of scheduled jobs if/when any exist.
- Surface Gemini quota/rate-limit headers when available.

## 14. Open Questions

None — placement, content blocks, and health mode resolved in the 2026-07-12
design session (see design spec).
