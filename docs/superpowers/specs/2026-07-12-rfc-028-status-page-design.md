# Status Page — Design (RFC-028)

Date: 2026-07-12
RFC: [RFC-028](../../rfc/RFC-028-Status-Page.md)
Status: Approved by owner (brainstorming session, 2026-07-12)
Target: v2.4.0 · Effort: S

## Context

The About page's "AI Runtime" card is a **hardcoded array**
(`about-view.tsx:35`) claiming Text/Vision/Explanations are all Gemini. The
real wiring (RFC-014B `DEFAULT_POLICIES`, `src/runtime/ai/ProviderPolicy.ts:24`)
routes **structured and classification to OpenAI primary** (gpt-5.4-mini/nano)
and image_generation to OpenAI, with per-capability `AI_POLICY_*` env
overrides. The card is stale by design — nothing feeds it.

External services in play: **Gemini, OpenAI, Supabase, Open-Meteo**. Existing
deep-dive surfaces live under `/developer` (AI runtime/budget, observability,
weather runtime, runtime statistics). RFC-022 logging uses an **in-memory ring
buffer** (per-process; resets on restart).

## Decisions (owner-confirmed)

1. **Purpose:** config truth + health — live provider-per-capability wiring
   AND per-service health.
2. **Placement:** new read-only **`/status`** page linked from nav/About; the
   About card shrinks to a one-liner linking to it. `/developer` stays the
   deep-dive tooling.
3. **Content blocks:** AI wiring table · Service health · OpenAI budget guard
   · App/build info.
4. **Health mode:** passive by default (key/URL configured + last-call outcome
   from the log ring buffer, honest "no recent calls" after restart) plus a
   manual **Run checks** button firing minimal on-demand probes. Never probes
   automatically.

## Architecture

### Feature: `src/features/status/`

- `components/status-view.tsx` — four cards (AI Wiring, Service Health,
  OpenAI Budget, Build Info) + Run checks button.
- `hooks/index.ts` — `useStatusQuery()` (GET), `useRunProbesMutation()` (POST).
- `services/status.service.ts` — client fetch wrappers returning
  `{ data, error }`.

### Server: assembly + probe route (secrets stay server-side)

**Refinement (planning, 2026-07-12):** the snapshot is assembled by the
`/status` **server component** (same pattern as
`app/developer/ai-runtime/page.tsx`, which already reads
`resolver.describe()` + `budgetStatus()` server-side) — no `GET /api/status`
route needed. Only the probe is an API route. The snapshot shape below is
unchanged; it lives as the domain `StatusModel`.

- Server-side snapshot (`buildStatusModel` input) → `StatusSnapshot`:
  - **aiWiring**: from `loadPolicies()` + model policy — per capability:
    primary/fallback provider, model, `override: boolean` when an
    `AI_POLICY_<CAPABILITY>` env var is active.
  - **services**: per service `{ id, configured, lastCall: { at, ok, source } | null }`
    — configured = key/URL present (never the value); lastCall scraped from
    the RFC-022 ring buffer.
  - **budget**: from `BudgetGuard` — month-to-date OpenAI spend, soft-alert,
    hard-stop, state `ok | soft_alert | hard_stop`.
  - **build**: `package.json` version + `NODE_ENV`.
- `POST /api/status/probe` → runs 4 minimal probes and returns
  `{ id, ok, latencyMs, error? }[]`:
  - Supabase: trivial `select` (e.g. `occasions` head count).
  - Open-Meteo: minimal forecast call.
  - Gemini / OpenAI: 1-token request **routed through the existing AI runtime**
    so cost tracking and the budget guard observe it.

### Domain (pure, tested)

`src/domain/status/` — `buildStatusModel(input)` shapes raw inputs (policies,
budget numbers, log tail, env-presence flags) into the display model:
deterministic states (`ok | warn | error | unknown`), sorted capabilities,
override flags. No I/O; time injected.

### About page change

Replace the hardcoded card with a single line + link to `/status`. Delete the
static provider array.

## Hidden by design

Key values (presence only) · request/response payloads · per-request logs
(that's `/developer`) · anything mutable — the page is read-only.

## Testing

- Domain: `buildStatusModel` — override detection, budget state thresholds,
  last-call mapping, unknown states after empty log buffer.
- Manual/preview: `/status` renders truthful wiring (structured/classification
  → OpenAI), Run checks turns unknown → ok, About card links through.
- Gates: `npm test`, lint, `tsc`, build green.

## Out of scope

- Historical uptime/latency charts (runtime statistics view already exists).
- Alerting/notifications (rejected: Notification Engine is out of product scope).
- Editing policies from the UI.
