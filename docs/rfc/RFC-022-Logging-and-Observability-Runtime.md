# RFC-022: Logging & Observability Runtime

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Cursor (Grok)
Target Release: v2.0.x
Epic: Platform / Observability
Priority: High
Effort: M
Dependencies:
- RFC-014 AI Runtime v2 (`src/runtime/ai/AIRuntime.ts`, `RuntimeMetrics`, `ProviderRouter`) — primary AI call path to instrument
- RFC-014B Cost-Aware AI Runtime (`RuntimeCostEstimator`, `CostTracker.estimateCost`, `RuntimePolicyResolver`) — cost/token fields reuse existing estimators; no new pricing logic
- RFC-005 Intelligence Orchestrator (`src/domain/orchestrator`, `ExecutionReport`) — engine/orchestrator log fields map from existing report shape
- RFC-011 Weather Runtime — pattern reference for process-local metrics + Developer Mode dashboard
- ADR-005 AI does not decide — logging observes; never changes scoring, eligibility, ranking, or routing policy
- ADR-007 AI tool calling — AI wardrobe ops stay tool-mediated; logs must not replace tools or DB access
- RFC-010 Application Access Guard — access codes / unlock paths are high-sensitivity redaction targets

> **Number note.** RFC-021 remains reserved/parked for Long-Horizon Planning &
> Multi-Step Reasoning ([FUTURE.md](../product/FUTURE.md)). This RFC claims the
> next free sequential number **022**.

> **Observability observes; it does not decide.** Structured logs make production
> and AI spend debuggable. They must not alter deterministic engines, AI routing
> policy, or business outcomes. Cost figures remain directional estimates from
> RFC-014B — never billed truth.

---

## Observability Runtime Philosophy

- **Logs help debug production** — correlation IDs + structured JSON beat scattered
  `console.*` calls when something fails on Vercel.
- **Safe by default** — no API keys, access codes, raw prompts (by default), image
  base64, or full wardrobe payloads.
- **AI calls are fully traceable** — every runtime call records provider, model,
  fallback, tokens, latency, cache, and estimated cost.
- **Logging does not change business logic** — wrap and emit; do not branch product
  behaviour on log flags beyond enable/disable of emission.
- **Deterministic engines stay deterministic** — domain code (`src/domain/**`)
  remains pure; orchestrator traces are emitted at the service/runtime boundary,
  not inside pure engines.
- **Vercel-first** — stdout JSON lines that Vercel Functions / Runtime Logs can
  filter; no external vendor required for this RFC.

---

## 1. Problem Statement

Wardrobe OS is deployed and release-ready, but **logging is not standardized**.
Today:

- **API routes** (`app/api/**` — chat, vision, explain-*, access unlock/logout,
  playground) mostly lack request-scoped structured logs; failures are hard to
  reconstruct after the fact.
- **AI paths** already *measure* in-process via `RuntimeMetrics`,
  `RuntimeCostEstimator`, and `LatencyTracker` (RFC-014 / 014B), and the legacy
  `AIOrchestrator` accepts an `AILogger` — but there is **no single production
  logging contract** that emits provider / model / tokens / cost / fallback /
  `requestId` as Vercel-friendly JSON on every call.
- **Scattered `console.warn` / `console.log`** (e.g. acquisitions decision
  history, AI service warnings) are ad hoc, uncorrelated, and unsafe to extend
  without redaction rules.
- **Intelligence Orchestrator** produces rich `ExecutionReport`s
  (`executedCapabilities`, `skippedCapabilities`, `failedCapabilities`, timings,
  confidence) but those are not systematically logged with a shared `requestId`.
- **Production debugging** means manually grepping Vercel logs without a
  correlation story; AI cost visibility is dashboard-oriented
  (`/developer/ai-runtime`) rather than per-request in Runtime Logs.

Who feels the pain: the owner debugging a failed chat/vision/explain call in
production, and anyone trying to answer “which provider/model ran, did we
fallback, what did it cost, and which request was it?”

Why now: the product surface and AI Runtime are stable (v2.0.x). Observability is
the platform gap that makes further releases safer without changing product
logic.

---

## 2. Goals

1. **Audit** current Vercel / server logging behaviour and document the gaps
   against this RFC’s contracts.
2. **Standardize** structured JSON logging across all API routes.
3. **Request correlation IDs** (`requestId`) propagated from the edge of each
   request through AI / orchestrator log lines.
4. **AI runtime logging** on every AI API call with the required field set
   (provider, model, tokens, cost, fallback, cache, latency, status, errors).
5. **Cost / token / model / provider visibility** by integrating
   `RuntimeCostEstimator` / `estimateCost` — not inventing a second price table.
6. **Vercel-friendly** single-line JSON on stdout/stderr suitable for Runtime Logs
   filters.
7. **Redaction / safe logging rules** enforced at the logger boundary
   (`LOG_REDACTED=true` by default in spirit).
8. **Developer Mode log viewer** if feasible (read recent in-memory / ring-buffer
   lines under `/developer/...`); otherwise document Vercel inspection as the
   primary path and mark the viewer as a stretch acceptance item.
9. **Env-gated** log categories (`LOG_LEVEL`, `LOG_AI_USAGE`, `LOG_REQUESTS`,
   `LOG_ENGINE_TRACES`, `LOG_REDACTED`) so production noise and engine traces are
   tunable without code changes.
10. **Documentation** in this RFC (and a short ops note when implemented): how to
    inspect Vercel logs + sample log lines.

---

## 3. Non-Goals

- **External logging vendors** — Datadog, Sentry, Logflare, Axiom, etc.
- **Full OpenTelemetry** setup (traces/metrics/exporters). Correlation IDs are
  enough for this RFC; OTel remains a future extension.
- **Persisting logs to Supabase by default** — no new log tables required; optional
  persistence is out of scope unless later approved.
- **Logging raw prompts by default** — prompts stay out of production logs unless
  an explicit future debug flag is approved (not this RFC).
- **Logging image base64 / binary payloads.**
- **Logging personal wardrobe data in full** (item lists, StyleDNA dumps, chat
  message bodies).
- **Changing AI routing, budgets, or deterministic engine behaviour.**
- **Replacing** `/developer/ai-runtime` metrics dashboard — this RFC *complements*
  process-local `RuntimeMetrics` with emit-to-Vercel structured logs; it does not
  remove the dashboard.
- **Client-side browser logging as a production source of truth.**

---

## 4. User Stories

- As the owner, when a production AI call fails, I want a `requestId` on the error
  and matching structured lines in Vercel logs so I can reconstruct provider,
  model, fallback, and latency.
- As the owner, I want every AI call to record estimated cost and tokens so I can
  spot expensive or runaway usage without opening a billing portal.
- As a developer, I want API routes to emit consistent request logs (method,
  route, status, latency) so I can see slow or failing endpoints at a glance.
- As a developer, I want orchestrator runs (when enabled) to log which
  capabilities executed, skipped, or failed without logging wardrobe payloads.
- As a developer, I want redaction so access codes, API keys, and image bytes never
  appear in logs even if a caller passes them in a bag of metadata.
- As a developer (stretch), I want a Developer Mode view of recent structured log
  lines when I cannot open the Vercel dashboard immediately.

---

## 5. UX Flow

### Production / ops (primary)

1. Deploy to Vercel as today.
2. Reproduce or wait for an issue.
3. Open **Vercel → Project → Logs** (Runtime / Functions).
4. Filter by `requestId`, `route`, `capability`, `provider`, or `errorCode`
   (string contains / JSON field filters as Vercel UI allows).
5. Correlate API line → AI usage line(s) → optional engine trace by shared
   `requestId`.

### Error surfaces (product)

- API error JSON **may** include `requestId` (and `errorCode`) so the UI or curl
  user can paste an ID into Vercel search — without exposing stack internals or
  secrets.

### Developer Mode (optional / stretch)

Entry: gated Developer Mode (existing pattern under `/developer/*`, e.g. beside
`/developer/ai-runtime`).

1. Open **Observability** (proposed path: `/developer/observability`).
2. See a **ring buffer** of recent structured log records from the current
   server process (dev / preview; production usefulness is limited by serverless
   isolation — document that clearly).
3. Filter by level / kind (`api` | `ai` | `engine`).
4. No edit of env from UI (env-only, same as AI Runtime policy).

If the stretch viewer is deferred, acceptance still passes via Vercel docs +
sample lines in §11 / appendix samples below.

---

## 6. Architecture

Fits **feature-first** as a **platform/runtime** concern — not a domain engine.

```
API Route
   → RequestLogger (start)
   → CorrelationId / RequestContext (AsyncLocalStorage or explicit pass-through)
   → Service / Intelligence Orchestrator / AIRuntime
        → AIUsageLogger (per AI call)
        → OrchestratorLogger (per engine run, if LOG_ENGINE_TRACES)
   → StructuredLogger (JSON + redaction + level gate)
   → stdout → Vercel Runtime Logs
   → (optional) in-memory ring buffer → Developer Observability View
```

### Domain Layer

**No domain changes required for core behaviour.** Pure engines stay pure.

- Orchestrator logging reads already-produced `ExecutionReport` fields at the
  **service / tool boundary** (e.g. after `runIntelligence` / service wrappers),
  and emits `OrchestratorLogger` records.
- Domain modules must **not** import the logging runtime or Node APIs.

### Service Layer

- Services / server entrypoints that call `AIRuntime` or the Intelligence
  Orchestrator ensure `requestId` is available (from `RequestContext`) when
  logging.
- Services do not gain new business branches based on log contents.

### Repository Layer

- **No new repositories** for default logging.
- Repositories continue to avoid logging row payloads; if an error is logged,
  log `errorCode` / safe message only.

### UI Layer

- Optional Developer Mode observability page (stretch).
- Product UIs may surface `requestId` on failed AI actions (small copy change
  when implemented) — no dashboard clutter in normal IA.

### AI Layer / Runtime

- **Instrument `AIRuntime`** (`src/runtime/ai/AIRuntime.ts`) after each routed
  call (success, cache hit, failure, fallback) via `AIUsageLogger`.
- Reuse: `RuntimeCostEstimator.perCall`, `MetricSample` / result fields
  (`servedBy`, `usedFallback`, `usage`, `costUsd`, `cacheHit`, prompt version).
- Honour existing `AILogger` on `AIOrchestrator` by backing it with the same
  structured sink (unify legacy + runtime paths).
- Providers (`GeminiProvider`, `OpenAIProvider`) remain free of product logging;
  the runtime owns emission so provider implementations stay thin.

### Platform components (new module home — suggested)

Suggested package root: `src/runtime/logging/` (implemented; mirrors `src/runtime/ai`
and `src/runtime/weather` style), **not** under `src/domain`.

| Component | Responsibility |
| --- | --- |
| `Logger` | Level-gated structured emit (`info` / `warn` / `error` / `debug`) |
| `RequestContext` | Hold `requestId`, route, start time for the request scope |
| `CorrelationId` | Create / accept incoming `x-request-id` (or generate UUID) |
| `Redaction` | Strip/hash secrets and sensitive fields before emit |
| `AIUsageLogger` | Emit required AI fields; calls cost estimator |
| `APILogger` | Emit required API request/response fields |
| `OrchestratorLogger` | Emit required engine/orchestrator fields from `ExecutionReport` |
| `CostEstimator` integration | Delegate to `RuntimeCostEstimator` / `estimateCost` |
| `LogLevel` config | Parse env flags listed in §Environment |

---

## 7. Data Flow

1. **Incoming HTTP** hits an App Router route under `app/api/**`.
2. **CorrelationId** resolves: use `x-request-id` if present and well-formed,
   else generate a UUID; store in `RequestContext`.
3. **APILogger** records request start (or a single completion log with
   `latencyMs` — prefer one completion line per request to reduce noise).
4. Handler runs business/service code unchanged.
5. If the path calls **AIRuntime**:
   - Runtime resolves policy (unchanged; RFC-014B).
   - On completion (or failure), **AIUsageLogger** emits one JSON line with the
     required AI fields, including `requestId` from context, `estimatedCostUsd`
     from `RuntimeCostEstimator`, and fallback flags from the router result.
6. If the path runs the **Intelligence Orchestrator** and `LOG_ENGINE_TRACES=true`:
   - **OrchestratorLogger** emits a summary from `ExecutionReport` (ids + timings
     + confidence + status) — **not** full outcomes payloads.
7. On handler exit, **APILogger** ensures status / latency / `errorCode` are
   logged; errors include the same `requestId`.
8. **StructuredLogger** applies `LOG_LEVEL`, category flags, and `Redaction`,
   then writes one JSON object per line to stdout (Vercel).
9. Optional ring buffer retains N recent records for Developer Mode.

Time is injected / wall-clock only at the logging boundary; domain purity
unaffected.

---

## 8. Data Model / Schema Impact

**No schema changes.**

- No Supabase tables, columns, RLS policies, or migrations for default logging.
- Optional future: persist AI usage aggregates — **out of scope**; would need a
  separate RFC if desired.
- In-memory only: `RuntimeMetrics` (existing) + optional log ring buffer
  (process-local, ephemeral).

---

## 9. API / Domain Contracts

### Environment

```bash
LOG_LEVEL=info                 # debug | info | warn | error
LOG_AI_USAGE=true              # emit AIUsageLogger lines
LOG_REQUESTS=true              # emit APILogger lines
LOG_ENGINE_TRACES=false        # emit OrchestratorLogger lines (verbose)
LOG_REDACTED=true              # enforce redaction pipeline (must stay true in prod)
```

### Correlation

- Header in: `x-request-id` (optional).
- Header / body out on errors: `requestId` echoed when safe.
- Context API (illustrative): `getRequestId(): string`, `runWithRequestContext(ctx, fn)`.

### Required AI log fields

| Field | Notes |
| --- | --- |
| `requestId` | From RequestContext |
| `route` | API route path if known |
| `capability` | AIRuntime capability id |
| `provider` | Served provider id |
| `model` | Concrete model id |
| `fallbackProvider` | Configured/used fallback id if any |
| `usedFallback` | boolean |
| `promptVersion` | From PromptRegistry / request |
| `cacheHit` | boolean |
| `inputTokens` | from `AIUsage` |
| `outputTokens` | from `AIUsage` |
| `totalTokens` | from `AIUsage` |
| `estimatedCostUsd` | `RuntimeCostEstimator.perCall` |
| `latencyMs` | number |
| `status` | e.g. `ok` \| `error` \| `cache_hit` |
| `errorCode` | stable code when failed; omit/null when ok |
| `timestamp` | ISO-8601 |

Envelope: `{ "kind": "ai_usage", "level": "info", ...fields }`.

### Required API log fields

| Field | Notes |
| --- | --- |
| `requestId` | |
| `method` | GET/POST/… |
| `route` | pathname |
| `statusCode` | |
| `latencyMs` | |
| `userAgent` | **hash** or redacted truncated form — never full raw if `LOG_REDACTED` |
| `ip` | **hash** if available (e.g. `x-forwarded-for`); never raw store of PII |
| `timestamp` | ISO-8601 |
| `errorCode` | when applicable |

Envelope: `{ "kind": "api_request", ... }`.

### Required engine / orchestrator log fields

| Field | Notes |
| --- | --- |
| `requestId` | |
| `capability` | entry capability / tool name if applicable |
| `executionGraph` | compact summary (ids / edges count) — not full item data |
| `executedCapabilities` | from `ExecutionReport` |
| `skippedCapabilities` | from `ExecutionReport` |
| `failedCapabilities` | from `ExecutionReport` |
| `totalLatencyMs` | from report metadata / timings `__total` |
| `confidence` | report confidence |
| `status` | derived ok / partial / failed |
| `timestamp` | ISO-8601 |

Envelope: `{ "kind": "engine_trace", ... }`.

### Redaction rules (normative)

**Never log:**

- `GEMINI_API_KEY`, `OPENAI_API_KEY`, Supabase service keys, any `*_SECRET*`
- Access codes / unlock tokens (RFC-010)
- Authorization / cookie header values
- Image base64 / `data:` URLs / raw multipart bytes
- Full chat message arrays / raw prompts (default)
- Full wardrobe item lists / StyleDNA blobs

**Allowed:**

- Hashed IP / hashed or truncated User-Agent
- Stable `errorCode`, HTTP status, capability names, model ids, token counts, costs
- Counts and ids that are not secrets (e.g. capability id lists)

### Sample log lines (documentation)

```json
{"kind":"api_request","level":"info","requestId":"7c2e1a8b-…","method":"POST","route":"/api/chat","statusCode":200,"latencyMs":1842,"userAgent":"ua_h:a1b2c3","ip":"ip_h:d4e5f6","timestamp":"2026-07-12T07:00:01.234Z","errorCode":null}
```

```json
{"kind":"ai_usage","level":"info","requestId":"7c2e1a8b-…","route":"/api/chat","capability":"conversation","provider":"gemini","model":"gemini-2.5-flash","fallbackProvider":"openai","usedFallback":false,"promptVersion":"chat-v1","cacheHit":false,"inputTokens":1200,"outputTokens":340,"totalTokens":1540,"estimatedCostUsd":0.00021,"latencyMs":1605,"status":"ok","errorCode":null,"timestamp":"2026-07-12T07:00:01.200Z"}
```

```json
{"kind":"engine_trace","level":"debug","requestId":"7c2e1a8b-…","capability":"runIntelligence","executionGraph":{"nodes":4,"edges":3},"executedCapabilities":["health","usage","analytics","recommendation"],"skippedCapabilities":[],"failedCapabilities":[],"totalLatencyMs":42,"confidence":0.81,"status":"ok","timestamp":"2026-07-12T07:00:00.050Z"}
```

### Inspecting Vercel logs (documentation)

1. Vercel Dashboard → Project → **Logs**.
2. Select Deployment / Time range.
3. Search for `"kind":"ai_usage"` or a known `requestId`.
4. For fallback debugging, search `"usedFallback":true`.
5. Pair with `/developer/ai-runtime` for process-local aggregates (not a substitute
   for per-request Vercel lines on serverless).

---

## 10. Acceptance Criteria

- [ ] Every API route under `app/api/**` emits structured `api_request` logs when
      `LOG_REQUESTS=true`.
- [ ] Every AI Runtime call emits structured `ai_usage` logs when
      `LOG_AI_USAGE=true`, including provider, model, tokens, latency, and
      `estimatedCostUsd`.
- [ ] Fallback AI calls are visible (`usedFallback: true` and
      `fallbackProvider` / served provider distinguishable).
- [ ] Errors include `requestId` in logs and, where practical, in API error
      responses.
- [ ] Log format is single-line JSON suitable for Vercel Runtime Logs.
- [ ] No secrets logged under `LOG_REDACTED=true` (keys, access codes, raw images,
      raw prompts by default).
- [ ] Logging does not alter deterministic engine outputs or AI routing decisions.
- [ ] Documentation includes how to inspect Vercel logs (this RFC §9).
- [ ] Documentation includes sample log lines (this RFC §9).
- [ ] Domain layer remains free of logging I/O imports.
- [ ] Env flags control level and categories as specified.
- [ ] (Stretch) Developer Mode observability viewer for recent in-process lines —
      if deferred, document deferral in the implementation PR without blocking
      the rest.
- [ ] **This RFC is documentation-only at authoring time** — no application code
      shipped with Draft publication.

---

## 11. QA / Testing Plan

### Unit (when implementing)

- `Redaction` — keys, access codes, base64, prompt-like fields stripped/hashed.
- `CorrelationId` — generate vs honour incoming header; reject oversized/malformed.
- `APILogger` / `AIUsageLogger` / `OrchestratorLogger` — field presence snapshots.
- `LogLevel` + category flags — disabled categories emit nothing.
- Cost field — `estimatedCostUsd` matches `RuntimeCostEstimator.perCall` for a
  fixed usage fixture (reuse RFC-014B price table).

### Integration / route-level

- One representative route per family: `/api/chat`, one `/api/ai/explain-*`,
  `/api/ai/vision`, `/api/access/unlock` (assert **no** access code in logs).
- Simulate provider failure → fallback → assert `usedFallback` log line.
- Simulate handler error → assert `requestId` + `errorCode` on API log.

### Manual / preview

- Deploy preview → trigger chat → find lines in Vercel Logs by `requestId`.
- Confirm `/developer/ai-runtime` still works (metrics dashboard unchanged).
- If viewer ships: enable Developer Mode → `/developer/observability` shows
  recent lines in local `next dev`.

### Must be green before release

- Existing Vitest suite green.
- New observability unit tests green.
- No schema migrations.
- `npm test` green before any release tag that includes this work (per CLAUDE.md).

---

## 12. Risks & Trade-offs

| Risk | Mitigation |
| --- | --- |
| Log volume / Vercel noise | Category flags; default `LOG_ENGINE_TRACES=false`; one API completion line |
| Accidental secret leakage | Central `Redaction`; deny-list; tests on unlock route; `LOG_REDACTED` |
| Serverless cold start / multi-instance | Do not rely on in-memory viewer in prod; Vercel Logs are source of truth |
| Double-counting cost vs metrics dashboard | Logs emit per-call estimates; dashboard remains aggregate `RuntimeMetrics` — document both |
| AsyncLocalStorage edge cases on edge runtime | Prefer `nodejs` runtime for instrumented AI routes (already used by chat); document if any edge route is excluded |
| Performance | Logging is post-call; avoid sync heavy hashing on large bodies (hash headers only) |
| Temptation to log prompts for “better debug” | Explicit non-goal; future RFC + flag if ever needed |

**Trade-off chosen:** Vercel stdout JSON over vendors — enough for a single-user
product; keeps ops simple and aligned with current hosting.

---

## 13. Future Extensions

- OpenTelemetry export (trace spans linking API → AI → orchestrator).
- Optional durable AI usage table / monthly rollups in Supabase (separate RFC).
- Prompt-hash-only debug mode (hash of prompt, never raw text).
- Client-visible “copy request id” on all AI error toasts.
- Sampling / rate limits for ultra-chatty paths.
- Weather Runtime request logs unified under the same `Logger` (RFC-011 pattern).

---

## 14. Open Questions

1. **Developer Mode viewer:** ship in the same implementation PR as stretch, or
   explicitly defer to a follow-up while marking Vercel as sole prod inspection
   path?
2. **Error response shape:** always add `requestId` to JSON errors app-wide, or
   only AI / instrumented routes first?
3. **Incoming `x-request-id`:** accept from clients always, or only in non-prod to
   avoid log injection / spoofing noise? (Recommendation: accept when UUID-shaped,
   else generate.)
4. **Module path:** confirm `src/runtime/observability/` vs
   `src/platform/logging/` before Approved.
5. **Access unlock logging:** log only anonymized failure counters vs one
   redacted `api_request` line per attempt (recommendation: always structured API
   log, never code/token fields)?

---

## Appendix A — Current-state audit (grounding)

| Area | Today | Gap vs this RFC |
| --- | --- | --- |
| `AIRuntime` + `RuntimeMetrics` | In-process aggregates; cost via `RuntimeCostEstimator` | No per-request Vercel JSON with `requestId` |
| `AIOrchestrator` + `AILogger` | Injected logger interface; often silent | Not wired to a shared production sink |
| API routes | Minimal / ad hoc logging | No standard `api_request` contract |
| Orchestrator `ExecutionReport` | Rich structured result | Not emitted as `engine_trace` logs |
| Developer Mode | AI Runtime + Weather dashboards | No log viewer |
| Vercel | Hosting + raw console | No documented field contract or samples |

## Appendix B — Modules to touch (implementation later — not this Draft)

Documentation pointer only; **do not implement in this RFC authoring task**:

- New: `src/runtime/observability/*`
- Wire: `src/runtime/ai/AIRuntime.ts`, `app/api/**/route.ts`, server services that
  invoke AI / orchestrator
- Optional UI: `src/features/developer/components/*`, `/developer/observability`
- Tests: `src/runtime/observability/tests/*`
)
