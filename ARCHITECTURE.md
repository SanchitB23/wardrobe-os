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
outfits) that the recommendation/generation engines score against. Services do
the I/O; engines receive the context, never raw rows. See
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

### AI abstraction
`src/ai/**` is a vendor-neutral layer:

- **Contracts** — `AIProvider` (`generate` / `stream` / `vision`), `AIRequest` /
  `AIResponse`, and the `AIService` façade.
- **Orchestrator** — provider selection, retry with backoff, cross-provider
  fallback, logging, and cache.
- **Providers** — `GeminiProvider` (real, `@google/genai`); OpenAI/Claude stubs.
  Selected via `AI_PROVIDER`. The composition root
  (`src/ai/server/ai-service.server.ts`) is the only place a provider meets real
  credentials; all AI calls run server-side. See
  [ADR-004](docs/adr/ADR-004-ai-provider-abstraction.md).
- **Prompt builders / schemas / parsers** — structured, validated output.
- **Cache** — `src/ai/cache` (Supabase-backed with in-memory fallback);
  [ADR-006](docs/adr/ADR-006-ai-cache.md).

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
Postgres holds wardrobe items, outfits, wear logs, purchases, lookups, and the
`ai_cache` table. Storage holds item images (public bucket). Access is
RLS-gated with anon policies; two typed clients exist —
`src/lib/supabase/client.ts` (browser) and `src/lib/supabase/server.ts` (server,
cookie-aware).

## Request flow examples

**Recommendations (deterministic):**
`RecommendationCenter` → `useOutfitRecommendations` →
`fetchOutfitRecommendations` → repositories + analytics services →
`buildRecommendationContext` → `recommendUnifiedOutfits` → ranked list.

**Stylist chat (AI + tools):**
`/chat` → `POST /api/chat` → `streamChat` → `GeminiChatModel` (function calling)
→ on tool calls, `ToolRouter` → wardrobe tools → services → repositories →
Supabase → results fed back → streamed final answer.
