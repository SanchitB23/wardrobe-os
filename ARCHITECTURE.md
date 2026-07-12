# Architecture

Wardrobe OS is **feature-first** with a strict, one-directional layering. Each
layer only talks to the one below it; the domain layer at the bottom is pure and
knows nothing about React, Supabase, or AI.

```
UI (components)        app/**, src/features/**/components
   ↓
hooks                  src/features/**/hooks        (TanStack Query)
   ↓
services               src/features/**/services     (orchestration; { data, error })
   ↓
repositories           src/features/**/repositories (persistence)
   ↓
Supabase               Postgres + Storage
```

Alongside, two cross-cutting pillars:

```
domain engines         src/domain/**   (pure, deterministic — the source of truth)
runtime layer          src/runtime/**  (I/O adapters: weather + capability-routed AI runtime)
AI layer               src/ai/**       (vendor-neutral; explains + converses)
```

## Layers

### UI layer
Server and client components under `app/` and `src/features/**/components`. They
render state and dispatch intent. **Components never call Supabase directly and
never contain business logic** — they call hooks. Shared primitives live in
`src/shared/ui` and `components/ui` (shadcn/ui on Base UI).

### Hooks
`src/features/**/hooks` wrap services with **TanStack Query** (`useQuery` /
`useMutation`), owning query keys (`src/shared/query/wardrobe-keys.ts`),
caching, and invalidation. Hooks are the only bridge between UI and services.

### Services
`src/features/**/services` orchestrate a use case: fetch via repositories, map
rows into domain inputs, call the relevant **domain engine**, and return a
`{ data, error }` result (services never throw at the top level). Cross-feature
service composition is allowed; reaching into another feature's repository is not.

### Repositories
`src/features/**/repositories` are the only code that talks to Supabase. They
run queries/mutations and return typed rows. The app uses the Supabase **anon
key** with Row-Level Security (`mvp_anon_*` policies); there is no auth.

### Domain engines
`src/domain/**` is **pure TypeScript** — no React, no Supabase, no AI, no
`fetch`. Engines take plain inputs and return deterministic outputs, with any
notion of "now" injected explicitly (`generatedAt` / `asOf`) so results are
reproducible and unit-testable. See [ENGINE.md](ENGINE.md).

### Recommendation context
`buildRecommendationContext(...)` assembles a single immutable snapshot
(wardrobe, usage, purchase, health, preferences, weather, commute, saved
outfits, and RFC-013 `personalization` directives — preference lifecycle +
explore/exploit weights) that the recommendation/generation engines score
against. Optional accepted **visual attributes** (RFC-020) merge into each
item's StyleDNA input before `deriveStyleDNA` — manual non-null fields always
win. Services do the I/O; engines receive the context, never raw rows. See
[ADR-002](docs/adr/ADR-002-recommendation-context.md).

### Intelligence Orchestrator
`src/domain/orchestrator/**` (RFC-005) is a **pure, deterministic composition
layer** over the engines. Given a `CapabilityRequest`, it resolves capability
dependencies (topological order + stable tie-break + cycle detection), plans
execution, runs each capability's engine with **failure isolation** (a failed
capability is recorded; its dependents are skipped; independent capabilities
still run), and returns one `ExecutionReport`. It **composes** engines — it holds
no business logic, never calls AI, and engines never call each other (cross-engine
data flows only as declared capability dependencies). A feature service
(`src/features/orchestrator`) assembles the `ExecutionContext` from repositories;
AI reaches the orchestrator via the `runIntelligence` tool (the model *requests*
capabilities; the orchestrator plans and executes deterministically). See
[ENGINE_GRAPH.md](ENGINE_GRAPH.md).

### Lifestyle Engine
`src/domain/lifestyle/**` (RFC-006) is a **pure, deterministic** engine that
plans a trip by composing the existing engines across a time horizon: it expands
the trip into days, selects each day's outfit by requesting the `recommendation`
capability **through the Intelligence Orchestrator** (never a direct engine
call), then derives a capsule, packing list, laundry schedule, and — via the
`acquisition` capability — shopping suggestions for anything missing. It returns
one `LifestylePlan` (TripPlan / PackingPlan / LaundryPlan / ShoppingPlan +
planScore + packingConfidence + tradeoffs + warnings). Weather comes from the
**Weather Runtime** (below) — the engine consumes a normalized `WeatherSnapshot`,
never a provider. Surfaced at `/lifestyle/trip`. See
[ENGINE_GRAPH.md](ENGINE_GRAPH.md).

### Shopping & Acquisitions Intelligence
`src/domain/shopping` (RFC-018) ranks a wishlist of Buy vs Skip analyses into a
`ShoppingDashboard` (priority, ROI, duplicates, static strategy). 
`src/domain/shopping/v2` (RFC-018B) learns from outcomes — lifecycle, accuracy,
need/ROI timelines, opportunity queue, dynamic strategy — without replacing 018
engines. Feature orchestration lives in `src/features/shopping`; product hub at
`/acquisitions`; Developer debug at `/developer/acquisitions`.

### Weather Runtime
`src/runtime/weather/**` (RFC-011) is the **single deterministic weather source**:
**weather is data; the engines decide; AI explains.** It is a runtime (I/O)
sibling to the AI layer, not a domain engine — the pure part lives in
`src/domain/weather` (`WeatherForecast`, the narrow engine-facing
`WeatherSnapshot`, deterministic enum `WeatherLabel`s, forecast confidence, and a
`seasonalFallbackSnapshot`). `WeatherRuntime` selects a provider (`OpenMeteo` /
`Manual`, `WEATHER_PROVIDER`), fetches, normalizes, projects a `WeatherSnapshot`,
and caches it (60-min TTL; `WeatherMetrics` for cache hit/miss, provider,
latency). It **never throws** and **never recommends**; on failure `getSnapshot`
returns a seasonal-fallback snapshot (`source = seasonal_fallback`) which the AI
*explains* rather than hallucinates. The Recommendation builder consumes a
`WeatherSnapshot`; the Orchestrator registers `weather` as a capability that
recommendation and outfit depend on (failure-isolated). Inspect it at
`/developer/weather`. See [ENGINE_GRAPH.md](ENGINE_GRAPH.md).

### Product surfaces & the Today home
The UI is organized as feature-first surfaces under `src/features/**` mounted by
routes under `app/**`, wrapped by a single `AppShell` (sidebar + mobile sheet)
and `PageHeader`. Navigation is declared in `src/features/layout/nav-config.ts`.

**Today** (`src/features/today`, route `/` — the default home, RFC-007) is a pure
**consumer**: each widget calls an existing hook (recommendations, insights,
wardrobe health, wear logs) and renders it with independent loading / error /
empty states. It composes engine output and deep-links into the stylist chat
(`/chat?q=`); it contains **no business logic and computes nothing new** — the
same "engines decide, UI surfaces" rule that governs every other view.

**Developer Mode** is a client toggle (`useDevMode`, persisted to
`localStorage`); when on, `nav-config` appends a `DEVELOPER_SECTION` that exposes
otherwise-hidden internal tooling (the AI Playground, Weather Runtime at
`/developer/weather`, Vision Debug, Inventory Image Backfill at
`/developer/inventory-images`, Acquisitions Intelligence debug at
`/developer/acquisitions`, and the `/developer` hub).
This keeps developer surfaces out of the everyday IA without a separate build.
**Settings** (`/settings`) and **About** (`/about`) are thin presentational
surfaces sourcing static release/architecture metadata.

### AI abstraction
`src/ai/**` is a vendor-neutral layer:

- **Contracts** — `AIProvider` (`generate` / `stream` / `vision`), `AIRequest` /
  `AIResponse`, and the `AIService` façade.
- **Orchestrator** — provider selection, retry with backoff, cross-provider
  fallback, logging, and cache.
- **Providers** — `GeminiProvider` (real, `@google/genai`) and `OpenAIProvider`
  (real, `openai` SDK — RFC-014A); `ClaudeProvider` remains a stub. The legacy
  single-provider path is selected via `AI_PROVIDER`; the AI Runtime v2 routes by
  capability policy (below). Composition roots
  (`src/ai/server/ai-service.server.ts`, `ai-runtime.server.ts`) are the only
  places a provider meets real credentials; all AI calls run server-side. When
  `OPENAI_API_KEY` is unset the OpenAI provider is unavailable and routing falls
  back to Gemini. See [ADR-004](docs/adr/ADR-004-ai-provider-abstraction.md).
- **Prompt builders / schemas / parsers** — structured, validated output.
- **Cache** — `src/ai/cache` (Supabase-backed with in-memory fallback);
  [ADR-006](docs/adr/ADR-006-ai-cache.md).
- **AI Runtime v2** (RFC-014, `src/runtime/ai`) — a **capability-centric**
  runtime wrapping the layer above: callers request a *capability* (explanation /
  vision / conversation / summarization / …), declarative **provider policies**
  choose the provider (primary → fallback + retry), and the runtime versions
  prompts, benchmarks providers, and records latency / cost / token metrics per
  capability × provider × prompt version. Decision-making lives in a resolver
  stack (RFC-014B): a **`RuntimePolicyResolver`** turns a capability into a full
  route by composing `CapabilityPolicy` (provider), `ModelPolicy` (model),
  `ProviderPreferenceResolver` (order + availability), `RuntimeCostEstimator`, and
  `RuntimeBudgetMonitor` — the resolver *decides*, `ProviderRouter` *executes*. A
  separate **model policy** resolves the model per (capability, provider) —
  capability → provider → model.
  The shipped default is **cost-first**: Gemini is primary for conversation /
  explanation / summarization / vision; OpenAI serves only **structured** +
  **classification** (cheap gpt-5.4 mini/nano), always with a Gemini fallback. An
  **OpenAI budget guard** tracks estimated spend and, at the hard stop, marks
  OpenAI unavailable so routing falls back to Gemini (Gemini is never blocked).
  Inspector at `/developer/ai-runtime`. It routes and measures; it never decides
  (ADR-005).

### Logging & Observability (RFC-022)
`src/runtime/logging/**` is shared infrastructure (not a domain feature):

- Structured single-line JSON → stdout (Vercel Runtime Logs).
- `requestId` via `x-request-id` + AsyncLocalStorage; echoed on error responses.
- AI usage lines (provider / model / tokens / estimated cost / fallback) on every
  `AIRuntime` call and legacy `AIService` / chat edges.
- API completion logs via `withApiLogging` on all `app/api/**` routes.
- Orchestrator `engine_trace` at the service boundary when `LOG_ENGINE_TRACES=true`
  (domain engines stay pure — no logging I/O in `src/domain/**`).
- Redaction by default (`LOG_REDACTED=true`): no keys, access codes, raw prompts,
  or image base64.
- Developer viewer: `/developer/observability` (process-local ring buffer).
  Ops guide: [docs/operations/VERCEL_LOGGING.md](docs/operations/VERCEL_LOGGING.md).

AI **explains and converses only** — it is never the source of truth for
scoring, eligibility, ranking, health, or cost.
See [ADR-005](docs/adr/ADR-005-ai-does-not-decide.md).

### Tool calling
`src/ai/tools` lets the model act through tools instead of querying data:

```
AI model → ToolRouter → ToolExecutor → AITool → feature service → repository → Supabase
```

The model receives JSON-schema tool declarations and emits tool calls; the
executor validates args and runs the tool, which calls a service. The model
never touches the database. `ChatModel` / `GeminiChatModel` drive the streaming
chat loop. See [ADR-007](docs/adr/ADR-007-ai-tool-calling.md).

### Supabase storage & database
Postgres holds wardrobe items, outfits, wear logs, purchases, lookups, the
`ai_cache` table, and (RFC-020) `item_visual_attributes` for reviewed
vision-derived style cues. Storage holds item images (public bucket). Access is
RLS-gated with anon policies; two typed clients exist —
`src/lib/supabase/client.ts` (browser) and `src/lib/supabase/server.ts` (server,
cookie-aware).

## Request flow examples

**Recommendations (deterministic):**
`RecommendationCenter` → `useOutfitRecommendations` →
`fetchOutfitRecommendations` → repositories + analytics services →
`buildRecommendationContext` → `recommendV2` (RFC-012 Recommendation Engine v2:
multi-objective, weather- & preference-aware, diverse, explainable) → ranked list
+ quality metrics.

**Intelligence Center (deterministic):**
`IntelligenceCenter` (`/intelligence`) → `useIntelligenceCenter` →
`getIntelligenceCenter` → recommendation + health + usage (+ contextual acquisition/
lifestyle/weather/vision) → `buildIntelligenceCenter` (RFC-015: generate → dedupe
→ impact-rank) → prioritised typed action cards. Also led as "Do this next" on
Today and exposed to the stylist via `getTopActions`.

**Stylist chat (AI + tools):**
`/chat` → `POST /api/chat` → `streamChat` → `GeminiChatModel` (function calling)
→ on tool calls, `ToolRouter` → wardrobe tools → services → repositories →
Supabase → results fed back → streamed final answer.

**Today home (composition, no new logic):**
`/` → `TodayView` widgets → existing hooks (`useOutfitRecommendations`,
`useInsightReport`, `useWardrobeHealth`, `useWearLogs`) → their services /
engines → rendered as widgets. Today aggregates and surfaces; it never scores or
decides.
