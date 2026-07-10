# RFC-014: AI Runtime v2

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Claude (Opus 4.8)
Target Release: v1.1.0
Epic: Runtime
Priority: High
Effort: L
Dependencies:
- AI layer (`src/ai`) — the vendor-neutral `AIProvider` / `AIService` contracts, `AIOrchestrator`, cache, prompt builders, and providers this RFC generalises
- ADR-004 (AI provider abstraction), ADR-005 (AI does not decide), ADR-006 (AI cache), ADR-007 (AI tool calling), ADR-008 (release/versioning)
- RFC-011 Weather Runtime (`src/runtime/weather`) — the precedent for a provider-agnostic **runtime** with a metrics sink and a Developer-Mode inspector; AI Runtime v2 mirrors its shape
- RFC-012 Recommendation Engine v2 / RFC-013 Personalization Engine v2 — downstream **consumers** of the `Explanation` capability (they decide; AI explains)
- AICache / `ai_cache` (ADR-006) — reused; already carries `promptVersion` + `promptBuilder`

> **Runtime, not brains.** AI Runtime v2 is pure infrastructure. It routes,
> benchmarks, versions prompts, and measures — it never makes a wardrobe decision.
> Every deterministic decision stays in the domain engines (ADR-005).

---

## Runtime Philosophy

One responsibility, cleanly separated — the same discipline as the Weather
Runtime (RFC-011), applied to AI:

- **Capabilities are the unit of routing.** A caller asks for a *capability*
  (explain this, converse, summarise, see this image) — not a provider. The
  runtime owns which provider serves each capability.
- **Policies choose providers.** A declarative **provider policy** per capability
  (primary + fallback) decides routing. Swapping providers is a policy edit, not
  a caller change.
- **The runtime measures, never decides.** It records latency, cost, tokens,
  cache hits, and failures per provider × capability × prompt version — and never
  participates in any scoring, ranking, eligibility, or wardrobe decision
  (ADR-005). AI still only **explains, converses, summarises, and sees**.

So: **Capability → Policy → Provider Router → Provider → Structured Output →
Cache → Metrics.** If you removed every engine, the runtime would have nothing to
explain; if you removed the runtime, the engines would still decide everything.

## 1. Problem Statement

Wardrobe OS already has a vendor-neutral AI layer (`src/ai`): the `AIProvider`
contract (generate / stream / vision), the `AIOrchestrator` (retry, fallback,
cache, logging), prompt builders, schemas/parsers, a Supabase-backed response
cache, and a tool-calling layer. Providers are interchangeable *in principle*.

But routing is still **provider-centric**, and in practice single-provider:

- **The orchestrator routes by mechanical capability, in registration order.**
  `selectProviders("generate" | "stream" | "vision")` returns the first
  registered provider whose `capabilities` flag is set, or an explicitly forced
  `provider`. There is no notion of a *semantic* capability (explanation vs
  conversation vs summarisation) and no per-capability provider preference.
- **The composition root is Gemini-only.** `getServerAIService()` reads
  `AI_PROVIDER`, throws for anything but `gemini`, and registers a single
  `GeminiProvider`. "Fallback" exists in the orchestrator but has nothing to fall
  back *to*.
- **Prompt versioning is a lone string.** `AICacheEntry.promptVersion` /
  `promptBuilder` exist for cache keying, but there is no registry of prompt
  versions, no way to run an experiment (A/B a prompt), and no link from a
  response back to the exact prompt version that produced it beyond the cache row.
- **There are no runtime metrics.** Latency is attached to a single response;
  nothing aggregates latency, **cost**, token usage, cache-hit rate, or failure
  rate per provider / capability / prompt version. There is no way to benchmark
  two providers on the same capability, and no Developer-Mode dashboard for any
  of it (unlike the Weather Runtime, which shipped one in RFC-011).

The roadmap's **v1.1 AI Runtime** epic names exactly these gaps — Capability
Routing, Provider Routing, Primary/Fallback Providers, Provider Benchmarking,
Cost Analytics, Latency Analytics, Prompt Versioning. We need to turn the AI
*layer* into an AI **runtime**: capability-centric routing behind declarative
provider policies, with prompt versioning, structured outputs, experiments, and
first-class metrics + a Developer dashboard — **without** moving any decision
into AI.

## 2. Goals

Make the AI layer a **capability-centric runtime**. Concretely:

- **Capability routing.** Callers request a semantic **capability** (Explanation,
  Vision, Image Generation, Conversation, Summarization, future Embeddings); the
  runtime resolves the provider from that capability's policy.
- **Provider policies.** A declarative **primary + fallback** provider policy per
  capability (e.g. Text → OpenAI primary, Gemini fallback; Vision → Gemini
  primary, OpenAI fallback; Image → OpenAI primary, Gemini fallback), overridable
  by config/env. Fallback triggers on the primary's exhausted retries.
- **Provider benchmarking.** Run the same capability request across N providers
  and compare latency / cost / tokens / output — a developer tool, off the hot
  path.
- **Prompt versioning.** A registry that binds each prompt builder to an explicit,
  incrementing **version**; every response and metric records the version that
  produced it. Enables **prompt experiments** (route a fraction of calls to a
  candidate version, deterministically bucketed).
- **Latency + cost analytics.** Per-call and aggregate latency, token usage, and
  **cost** (from a provider/model price table), keyed by provider × capability ×
  prompt version.
- **Structured outputs.** First-class: a capability call can require a
  `ResponseSchema`; the runtime requests strict output, validates via the existing
  `ResponseParser`, and (on fallback) re-validates against the fallback provider.
- **Runtime metrics + Developer dashboard.** A metrics sink (mirroring
  `WeatherMetrics`) and a `/developer/ai-runtime` page showing provider, latency,
  cost, prompt version, failures, and benchmark results.
- **Never decide.** No business logic, recommendation, vision *interpretation*,
  shopping, or any deterministic decision enters the runtime (ADR-005). It routes
  and measures; engines decide; AI explains.
- **Backward compatible.** Existing `AIService.generate/stream/vision` callers
  keep working; capability routing is additive (a default "Text/Explanation"
  capability preserves today's behaviour).

## 3. Non-Goals

Explicitly **out of scope** for RFC-014 (verbatim from the brief, plus guardrails):

- **Business logic.** The runtime holds none.
- **Recommendation.** Ranking stays in RFC-012; the runtime only *explains* it.
- **Vision (interpretation/decisions).** The Vision Engine (RFC-002) still turns
  images into a `VisionAnalysis`; the runtime only routes the raw `vision()` call.
- **Shopping.** Buy-vs-Skip (RFC-001) decides; the runtime never does.
- **Anything deterministic.** No scoring, eligibility, or wardrobe decision — ever
  (ADR-005).
- **New AI *features*.** No new chat surfaces, no new explanation products; this
  is infrastructure under the existing features.
- **Training / fine-tuning / embeddings *storage*.** Embeddings are declared as a
  future capability slot; no vector store is built here.
- **Autonomous provider selection by a model.** Policies are declarative config,
  not model-chosen.

## 4. User Stories

- As a developer, I want to set "explanations use OpenAI, fall back to Gemini"
  **once** in a policy, and have every explanation call route there — without
  editing any feature.
- As a developer, I want a **fallback** to kick in automatically when the primary
  provider errors or times out, so a provider outage degrades gracefully instead
  of failing the feature.
- As a developer, I want to **benchmark** Gemini vs OpenAI on the same explanation
  prompt and see latency / cost / tokens side by side, so I can choose a policy on
  evidence.
- As a developer, I want each prompt bound to a **version**, and to **experiment**
  with a candidate version on a deterministic slice of traffic, so I can improve
  prompts safely.
- As a developer, I want a **Developer-Mode dashboard** showing per-capability
  provider, latency, cost, prompt version, and failure rate, so the runtime is
  observable (like the Weather Runtime page).
- As the Recommendation / Personalization engines, I want to request the
  **Explanation** capability and get a validated, structured explanation back,
  without knowing or caring which provider produced it.

## 5. UX Flow

**No end-user UX.** The runtime is infrastructure beneath existing AI features
(explanations, chat, vision). The only visible surface is a **Developer-Mode**
page **`/developer/ai-runtime`** (gated like `/developer/weather`, RFC-011):

1. **Policies** — the capability → primary/fallback provider map, and the active
   prompt versions per capability.
2. **Metrics** — per capability × provider: request count, cache-hit rate,
   avg/last latency, token usage, estimated cost, and failure rate.
3. **Benchmark** — pick a capability + prompt, run it across the policy's
   providers, and see a latency/cost/tokens comparison table.
4. **Experiments** — active prompt experiments (version A vs B, traffic split,
   per-version metrics).

End-user features (Recommendation Center explain, Stylist chat, Screenshot vision)
are unchanged; they now call the runtime by capability instead of by provider.

## 6. Architecture

AI Runtime v2 is a **runtime layer** (I/O-bearing, like RFC-011's Weather Runtime)
that wraps and generalises today's `src/ai`. It stays vendor-neutral and holds no
business logic. Proposed home: `src/runtime/ai` (mirroring `src/runtime/weather`),
composing the existing `src/ai` providers/cache/parsers.

```
Caller: runtime.run({ capability, promptContext | request, schema? })
        ↓
Capability            (Explanation | Vision | ImageGeneration | Conversation | Summarization | Embeddings*)
        ↓
Policy Resolver       (capability → { primary, fallback, promptVersion/experiment })   ← PURE
        ↓
Prompt Registry       (build the prompt for the resolved version)                      ← PURE
        ↓
Provider Router       (try primary → on failure, fallback) — wraps AIOrchestrator
        ↓
Provider              (Gemini / OpenAI / Claude — existing AIProvider instances)
        ↓
Structured Output     (ResponseParser validates; re-validate on fallback)             ← PURE
        ↓
Cache                 (ai_cache, keyed incl. capability + prompt version)  (ADR-006)
        ↓
Metrics               (latency / cost / tokens / cache-hit / failure, tagged)          (sink)
```

### Domain / pure parts
- **Capability + policy types** (`src/runtime/ai`, pure) — `AICapability`,
  `ProviderPolicy` (`{ primary, fallback }`), `AIRuntimePolicies`
  (capability → policy), and `resolveProvider(capability, policies)`. Pure and
  deterministic.
- **Prompt registry + versioning** (pure) — `PromptRegistry` binds a
  `promptBuilder.id` to an explicit **version** and (optionally) an **experiment**
  (candidate version + deterministic bucketing by a stable key). Selecting a
  version is a pure function of `(builderId, experimentConfig, bucketKey)`.
- **Cost model** (pure) — a `{ provider, model } → price-per-1K-tokens` table and
  `estimateCost(usage, provider, model)`.

### Runtime (I/O) parts
- **`AIRuntime`** (`src/runtime/ai/AIRuntime.ts`) — the entry point:
  `run(capabilityRequest)` resolves the policy, builds the versioned prompt, routes
  through the provider router (primary → fallback), validates structured output,
  reads/writes the cache, and records metrics. **Never throws** for a
  provider/parse failure that fallback can handle; returns a typed result. Wraps
  the existing `AIOrchestrator` (reusing its retry/fallback/cache mechanics) rather
  than replacing it.
- **`AIRuntimeMetrics`** (in-memory sink, mirroring `WeatherMetrics`) — records
  latency, cost, tokens, cache-hit, failure per provider × capability × prompt
  version; exposes a snapshot for the dashboard. Optionally persisted (§8).
- **`ProviderBenchmark`** — runs a capability across multiple providers and returns
  a comparison; developer tool, off the hot path.

### Service / composition
- `getServerAIService()` (composition root) is extended into `getServerAIRuntime()`
  which registers the available providers (Gemini today; OpenAI/Claude when their
  `AIProvider`s are implemented) and loads the policy map from config/env. The
  existing `AIService` façade is preserved (a thin adapter over the runtime with a
  default capability) so current callers are untouched.

### AI Layer
- Unchanged contracts: `AIProvider`, `ResponseSchema`/`ResponseParser`, prompt
  builders, `AICache`. The runtime **composes** them. Providers still only
  generate / stream / vision; the runtime adds the capability/policy/metrics layer
  on top. **AI never decides** (ADR-005).

## 7. Data Flow

```
feature → runtime.run({ capability: "Explanation", promptContext, schema })   typed result
  → resolveProvider("Explanation", policies)              → { primary, fallback }   ← PURE
  → PromptRegistry.select(builderId, experiment, bucket)  → { version, builtPrompt } ← PURE
  → cache.get(key incl. capability + version)             (ADR-006)  — hit ⇒ return + record cacheHit
  → ProviderRouter (AIOrchestrator):
        try primary.generate/vision(request)
          ↳ retry (backoff) → on exhaustion → fallback provider
  → ResponseParser.validate(text)                         ← PURE (re-validate on fallback)
  → cache.set(...)                                        (ADR-006)
  → metrics.record({ provider, capability, promptVersion, latency, tokens, cost, cacheHit, ok })
  → return { text, parsed?, provider, model, promptVersion, latencyMs, usage, cost, cached }
```

Policy resolution, prompt-version selection, structured-output validation, and
cost estimation are **pure**; only provider calls, cache, and the metrics sink do
I/O. Given a fixed policy + prompt version + cache state, routing is deterministic
(provider latency/cost aside, which are metadata).

## 8. Data Model / Schema Impact

**Reuses `ai_cache` (ADR-006), which already carries `promptVersion` +
`promptBuilder`** — extended (additively) to also tag `capability`. Metrics are
in-memory by default (like `WeatherMetrics`); **no schema change is required to
ship the runtime**.

Optional, additive (documented, not applied here): an append-only
`ai_runtime_metrics` table for durable analytics/benchmark history —

```sql
-- Additive, append-only. Aggregates computed in queries; anon RLS like the rest.
create table if not exists ai_runtime_metrics (
  id             uuid primary key default gen_random_uuid(),
  capability     text not null,          -- 'explanation' | 'vision' | 'image' | ...
  provider       text not null,
  model          text,
  prompt_version text,
  latency_ms     integer,
  prompt_tokens  integer,
  completion_tokens integer,
  cost_usd       numeric,
  cache_hit      boolean not null default false,
  ok             boolean not null default true,
  occurred_at    timestamptz not null default now()
);
```

Prompt versions/experiments and provider policies are **code/config**, not new
tables. Any migration is finalised and called out in the implementing PR — this
RFC only documents the impact.

## 9. API / Domain Contracts

Illustrative (final names settled at implementation).

```ts
// src/runtime/ai/types.ts  (design)

export type AICapability =
  | "explanation"
  | "vision"
  | "image_generation"
  | "conversation"
  | "summarization"
  | "embeddings";        // reserved — future, not wired

/** Primary + fallback provider ids for one capability. */
export interface ProviderPolicy {
  primary: AIProviderId;
  fallback?: AIProviderId;
  /** Optional model hint per capability. */
  model?: string;
}

export type AIRuntimePolicies = Record<AICapability, ProviderPolicy>;

/** A prompt builder pinned to a version, with an optional experiment. */
export interface PromptVersion {
  builderId: string;
  version: string;            // e.g. "explanation@3"
}
export interface PromptExperiment {
  builderId: string;
  control: string;            // version id
  candidate: string;          // version id
  /** 0–1 share of traffic routed to the candidate, deterministically bucketed. */
  candidateShare: number;
}

export interface AIRuntimeRequest<T = unknown> {
  capability: AICapability;
  /** Either a prompt context (built via the registry) or a ready AIRequest. */
  promptContext?: PromptContext;
  request?: AIRequest;
  parser?: ResponseParser<T>;
  /** Stable key for deterministic experiment bucketing (e.g. entity id). */
  bucketKey?: string;
  cache?: AICacheRequest;
  forceRefresh?: boolean;
  signal?: AbortSignal;
}

export interface AIRuntimeResult<T = unknown> extends AIResponse<T> {
  capability: AICapability;
  promptVersion: string;
  /** Which provider actually served it (may be the fallback). */
  servedBy: AIProviderId;
  usedFallback: boolean;
  costUsd?: number;
}

export interface AIRuntimeMetricsSnapshot {
  byCapabilityProvider: {
    capability: AICapability;
    provider: AIProviderId;
    promptVersion: string;
    requests: number;
    cacheHits: number;
    failures: number;
    avgLatencyMs: number | null;
    totalTokens: number;
    estCostUsd: number;
  }[];
}

export interface AIRuntime {
  run<T = unknown>(req: AIRuntimeRequest<T>): Promise<AIRuntimeResult<T>>;
  /** Developer tool: same request across providers, off the hot path. */
  benchmark(req: AIRuntimeRequest, providers: AIProviderId[]): Promise<BenchmarkResult>;
  metrics(): AIRuntimeMetricsSnapshot;
  policies(): AIRuntimePolicies;
}

export function resolveProvider(
  capability: AICapability,
  policies: AIRuntimePolicies,
): ProviderPolicy;

export function estimateCost(
  usage: AIUsage,
  provider: AIProviderId,
  model: string,
): number;
```

### Default policy (from PRODUCT_VISION §"Future AI Runtime")

| Capability | Primary | Fallback |
| --- | --- | --- |
| Explanation / Summarization / Conversation (Text) | OpenAI | Gemini |
| Vision | Gemini | OpenAI |
| Image Generation | OpenAI | Gemini |
| Embeddings (future) | — | — |

Until a real OpenAI `AIProvider` exists, the shipped default keeps **Gemini** as
primary for every capability (today's behaviour); the policy table is the single
place that changes when OpenAI is wired.

## 10. Acceptance Criteria

This RFC is **Approved-ready** when it defines all of the below (it does):

- [ ] Capability-centric routing: `AICapability`, `ProviderPolicy`,
      `AIRuntimePolicies`, and pure `resolveProvider`.
- [ ] Provider policies with **primary + fallback**, overridable by config/env,
      with the documented default table.
- [ ] Prompt versioning (a registry binding builders → versions) and prompt
      **experiments** (deterministic bucketing).
- [ ] Metrics keyed by provider × capability × prompt version (latency, cost,
      tokens, cache-hit, failure) and a metrics sink + `AIRuntimeMetricsSnapshot`.
- [ ] Provider benchmarking (off the hot path) and the Developer-Mode dashboard
      (`/developer/ai-runtime`).
- [ ] Structured outputs as a first-class option (schema → validate → re-validate
      on fallback), reusing `ResponseParser`.
- [ ] The runtime **wraps** the existing AI layer, preserves the `AIService`
      façade, and is backward compatible.
- [ ] Clear non-goals (no business logic / recommendation / vision decisions /
      shopping / anything deterministic; AI never decides).
- [ ] Schema impact documented as **additive/none** (reuse `ai_cache`; optional
      `ai_runtime_metrics`).
- [ ] A testing plan, risks, and future extensions.

Implementation-time acceptance criteria (tracked in that PR — not this RFC):
- [ ] **Provider swap** — changing a capability's policy re-routes it with no
      caller change.
- [ ] **Capability routing** — each capability resolves to its policy's provider.
- [ ] **Fallback** — a failing primary deterministically falls back to the
      secondary; `usedFallback` reflects it.
- [ ] **Metrics** — latency / cost / tokens / cache-hit / failure recorded per
      provider × capability × prompt version.
- [ ] **Benchmarking** — a capability runs across providers with a comparison.
- [ ] **Prompt versioning** — responses + metrics carry the prompt version;
      experiments bucket deterministically.
- [ ] Removing the runtime's routing leaves engine decisions unchanged (AI still
      only explains).

## 11. QA / Testing Plan

- **Unit tests (Vitest, pure) — the core:**
  - `resolveProvider`: each capability → its policy provider; unknown capability
    errors; env/config override applies.
  - Fallback: a fake primary that throws → the router serves the fallback;
    `usedFallback: true`; a fake where both fail → typed failure.
  - Prompt versioning + experiments: version recorded on the result; deterministic
    bucketing (same `bucketKey` + config ⇒ same version every time).
  - Cost model: `estimateCost` matches the price table for known provider/model;
    unknown model → 0 / flagged.
  - Metrics sink: records per provider × capability × prompt version; snapshot
    aggregates latency/cost/tokens/cache-hit/failure correctly.
  - Structured output: schema validates on primary; on fallback the fallback's
    output is re-validated; invalid output → parse failure surfaced.
  - Determinism: fixed policy + version + cache ⇒ same routing decision (latency
    aside).
- **Integration guard:** the `AIService` façade over the runtime reproduces
  current explanation/chat/vision behaviour with the Gemini-only default policy
  (equivalence); no feature code changes shape.
- **No real provider calls in the automated suite** — providers are fakes; the
  runtime's control flow is fully exercised without network/keys (as the existing
  orchestrator tests already do).
- **Developer dashboard** — preview verification of `/developer/ai-runtime`
  (policies, metrics, benchmark, experiments).
- **Release gate:** `npm test`, `npm run lint`, `npm run build` green (ADR-008).

## 12. Risks & Trade-offs

- **Over-abstraction.** A capability/policy layer atop a single live provider can
  look like ceremony. *Mitigation:* it directly enables the roadmap's provider
  work; keep it thin (wrap `AIOrchestrator`, don't replace it); default policy =
  today's behaviour so nothing regresses.
- **Cost-estimate accuracy.** A static price table drifts from real billing.
  *Trade-off:* estimates are directional (for comparison/benchmarking), clearly
  labelled "estimated"; the table is one tunable constant file.
- **Metrics volume / privacy.** Persisting every call could grow unbounded and
  store prompt-adjacent data. *Mitigation:* in-memory by default; the optional
  table stores only counters/usage (no prompt text); retention is a later concern.
- **Fallback masking failures.** Silent fallback can hide a broken primary.
  *Mitigation:* `usedFallback` + failure-rate metric surface it on the dashboard.
- **Prompt-experiment nondeterminism.** Random bucketing would break
  reproducibility. *Mitigation:* bucketing is a pure hash of a stable `bucketKey`
  — deterministic and testable.
- **Scope creep toward "AI decides".** A capability router could tempt
  model-chosen routing or business logic. *Mitigation:* hard non-goals; policies
  are declarative config; ADR-005 holds.
- **Migration risk.** Rewrapping the AI façade could change outputs. *Mitigation:*
  the façade is preserved and equivalence-tested; the runtime is additive until
  callers opt into capability routing.

## 13. Future Extensions

- **Real OpenAI / Claude providers** — implement their `AIProvider`s; the default
  policy table flips to the PRODUCT_VISION target (Text → OpenAI, Vision → Gemini,
  Image → OpenAI) with no caller changes.
- **Embeddings capability** — wire the reserved slot to a vector store for
  semantic wardrobe search (its own RFC).
- **Image Generation** — a real capability once a provider is available (e.g.
  outfit/lookbook imagery), still infrastructure-only.
- **Adaptive policies** — pick primary by rolling latency/cost/failure metrics
  (still declarative bounds, never model-chosen).
- **AI Gateway integration** — route through a hosted gateway (unified billing,
  observability) behind the same capability contract.
- **Prompt experiment analytics** — promote a candidate prompt version
  automatically when its metrics beat control over a window.
- **Budget guards** — per-capability cost ceilings surfaced on the dashboard.

## 14. Open Questions

1. **Location** — does the runtime live in `src/runtime/ai` (mirroring
   `src/runtime/weather`), or stay inside `src/ai` as a new sub-layer? (Leaning
   `src/runtime/ai` for parity with Weather Runtime.)
2. **Capability granularity** — are Explanation / Summarization / Conversation
   distinct capabilities with distinct policies, or one "Text" capability with
   sub-tasks? (The brief lists them separately; a shared Text policy may suffice
   initially.)
3. **Cost table source** — hardcoded constants, an env-config file, or a small
   `ai_prices` table? How often does it need updating for a hobby project?
4. **Metrics persistence** — ship in-memory only (like `WeatherMetrics`), or the
   additive `ai_runtime_metrics` table from day one for trend history?
5. **Experiment bucketing key** — what stable key buckets traffic (entity id,
   session, request hash) so a given subject sees a consistent prompt version?
6. **Streaming under policies** — `stream()` isn't retried/failed-over today
   (a partial stream can't replay). Does conversation streaming get fallback at
   connection time only, or stay single-provider?
7. **Façade vs direct** — do features migrate to `runtime.run({capability})`
   incrementally, or does the `AIService` façade map its three methods onto
   default capabilities permanently?
8. **`AI_PROVIDER` vs policies** — does the single `AI_PROVIDER` env var become a
   per-capability policy config (e.g. `AI_POLICY_EXPLANATION=openai,gemini`), and
   how is that validated at boot?
