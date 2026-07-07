# RFC-005: Intelligence Orchestrator

Status: Draft
Owner: Sanchit Bhatnagar
Author: ChatGPT
Target Release: v1.0.0
Epic: Intelligence
Priority: Critical
Effort: XL
Dependencies:
- StyleDNAEngine `deriveStyleDNA` (`src/domain/style-dna`) — existing
- OutfitEngine `evaluateOutfit` → `OutfitAnalysis` (`src/domain/outfit`) — existing
- OutfitGenerationEngine `generateOutfits` (`src/domain/generation`) — existing
- WardrobeHealthEngine `analyzeWardrobeHealth` → `WardrobeHealth` (`src/domain/analytics`) — existing
- UsageAnalyticsEngine / InsightEngine `generateInsights` (`src/domain/analytics`) — existing
- RecommendationContext + `buildRecommendationContext` + `recommendUnifiedOutfits` (`src/domain/recommendation`) — existing
- BuyVsSkipEngine `evaluateBuyVsSkip` (`src/domain/acquisition`, RFC-001) — existing
- ShoppingImageInterpreter `interpretShoppingImage` (`src/domain/acquisition`, RFC-003) — existing
- Vision Engine `normalizeVision` → `VisionAnalysis` (`src/domain/vision`, RFC-002) — existing
- PersonalizationEngine `derivePreferenceProfile` → `UserPreferenceProfile` (`src/domain/personalization`, RFC-004) — existing
- AI explanation layer (`src/ai`) — existing; consumes orchestration results, never part of orchestration
- ADR-005 (AI does not decide), ADR-006 (caching), ADR-007 (AI tool calling), ADR-008 (release/versioning)

---

## Orchestration Philosophy

One responsibility, cleanly separated — the same discipline as every prior RFC,
applied to *coordination*:

- **Engines decide.** Each pure domain engine (StyleDNA, Outfit, Analytics,
  Recommendation, Acquisition, Vision, Personalization) owns its own scoring,
  eligibility, and ranking. That does not change.
- **The Orchestrator composes.** It resolves which engines a request needs, in
  what order, feeds each its slice of context, runs them, and aggregates the
  outputs into one report. It holds **no** business logic of its own — it makes
  no scoring, eligibility, or ranking decision, and it invents no taste.
- **AI explains.** Natural-language narration of an orchestration result stays in
  the AI layer, which *consumes* the finished `ExecutionResult` and never
  participates in planning or execution (ADR-005).

So: **Request → plan → execute engines → `ExecutionResult` → (optional) AI
explanation.** The Orchestrator is glue, not brains. If you removed every engine
it would have nothing to do; if you removed the Orchestrator, each engine would
still work exactly as today — callers would just wire them by hand (as they do
now). It is a *deterministic composition* layer, not a workflow engine.

**Engines never call each other.** Today, when the recommendation service needs
health + usage + preferences + generated outfits, *the service* fetches and
wires them. The Orchestrator formalises that wiring into one deterministic,
testable, reusable place — but it never lets one engine reach into another.
Cross-engine data flows only through the Orchestrator, as declared capability
dependencies.

## 1. Problem Statement

Wardrobe OS now has many independent deterministic engines — Inventory,
StyleDNA, Outfit, Analytics, Recommendation, Acquisition, Vision, and
Personalization. Each is pure and self-contained, which is exactly right. But
**nothing owns how they compose.**

Every consumer orchestrates by hand. `recommendations.service.ts` alone fetches
wardrobe data, health, usage, purchase analytics, *and* the preference profile,
then builds a `RecommendationContext`, then runs generation + unified
recommendation. The acquisition service repeats a similar dance for Buy vs Skip
(wardrobe + health + usage + preferences). The screenshot flow chains Vision →
interpreter → Buy vs Skip. Each of these hand-wires overlapping subsets of the
same engines in slightly different orders.

As the roadmap adds **Travel, Packing, Weather, Calendar, and Shopping** (v1.0+),
every one of them will need to compose the same engines plus new ones — and each
will re-implement dependency wiring, execution order, context assembly, failure
handling, and result shaping. That orchestration logic would be **duplicated
across every consumer**, drift out of sync, and become the place bugs hide
(wrong order, a missing dependency, an unhandled engine failure silently
dropping a section of the result).

We need **one deterministic orchestration layer** that coordinates the engines,
so consumers request *capabilities* instead of hand-wiring engines.

## 2. Goals

- Provide a **deterministic Intelligence Orchestrator** that composes existing
  engines: given a set of requested **capabilities**, it resolves their
  dependencies, computes a stable **execution plan**, runs each engine with its
  scoped context, and returns one aggregated **`ExecutionResult`**.
- Keep the Orchestrator **free of business logic**: it makes no scoring,
  eligibility, or ranking decision and adds no taste. It only decides *which*
  engines run and *in what order* — never *what they conclude*.
- **Never call AI** in the planning or execution path. AI consumes the finished
  result (explanation only, ADR-005).
- Keep engines **independent and pure**: no engine calls another; cross-engine
  data flows only as declared capability dependencies routed by the Orchestrator.
- Make orchestration **reusable**: today's Recommendation / Acquisition /
  Screenshot flows and tomorrow's Travel / Packing / Weather / Calendar /
  Shopping / AI Chat all become *consumers* of the same layer.
- Be **observable**: the result reports executed capabilities, the execution
  graph, per-engine outputs, timing, confidence, failures, skipped engines, and
  explainability — enough to debug and to feed AI narration.
- Be **fully unit-testable**: deterministic planning + execution with injected
  time, so `same request + same context ⇒ same result` (timing aside).

## 3. Non-Goals

Explicitly **out of scope** for RFC-005:

- **AI reasoning / AI-driven planning.** The plan is computed deterministically
  from the capability registry, not by a model. AI never selects or orders
  capabilities. (An AI *chat* may later *request* capabilities — as a consumer —
  but the Orchestrator still plans deterministically; §13.)
- **Workflow automation.** No long-running, multi-step, stateful workflows,
  retries-with-backoff, sagas, or human-in-the-loop steps.
- **Scheduling.** No cron, no time-triggered runs.
- **Background jobs.** Execution is synchronous, in-request, in-process.
- **Notifications.** No push/email/reminders (also permanently out of product
  scope — see ROADMAP).
- **A new engine.** The Orchestrator adds no scoring/taste; it is composition
  only. It never becomes a source of truth for any decision.
- **Persistence.** Plans and results are computed on demand, not stored (a result
  cache is a future option; §13).
- **Cross-engine direct calls.** The Orchestrator does not enable engines to call
  each other; it routes declared dependency outputs between them.

## 4. User Stories

The Orchestrator is infrastructure; its value is realised through consumers.
Stories that motivate its shape:

- As the **Recommendation Center**, I want to request the `recommendation`
  capability and get outfits back, without hand-fetching health/usage/preferences
  or knowing they must run before context assembly.
- As the **Screenshot → Buy vs Skip** flow, I want to request `vision` then
  `acquisition` as a small graph and have the Orchestrator run them in order,
  passing the vision output into the interpreter/engine.
- As a future **Travel/Packing** consumer, I want to request a bundle of
  capabilities (weather + recommendation + personalization) and receive one
  aggregated result, reusing all existing wiring.
- As a developer, I want **one place** that knows engine dependencies and
  execution order, so adding a capability doesn't mean re-implementing
  orchestration in every caller.
- As a developer debugging a result, I want an **execution report** showing what
  ran, in what order, how long it took, what failed, and what was skipped.

## 5. UX Flow

**RFC-005 ships no end-user UX** — it is an internal capability layer, like the
Vision Engine (RFC-002). The only visible surface is an optional **developer
inspector** (an "Orchestrator" tab in the existing AI Playground, or a debug
panel) to submit a capability request and inspect the resolved plan, execution
graph, per-engine outputs, timing, and failures.

End-user experiences remain in the **consumer** features (Recommendation Center,
Advisor, Screenshot, and future Travel/Packing/etc.), each of which now calls the
Orchestrator instead of hand-wiring engines. Migrating those consumers is
incremental and behaviour-preserving (§12).

## 6. Architecture

The Orchestrator is a **pure domain layer** (`src/domain/orchestration`,
proposed) that composes existing engines. It adds no logic of its own.

```
User Request (capabilities + inputs)
        ↓
Context Builder          (assemble the shared ExecutionContext from repositories/services, upstream)
        ↓
Capability Planner       (resolve dependencies → deterministic ExecutionPlan / graph)   ← PURE
        ↓
Execution Graph          (topologically ordered capability nodes)
        ↓
Engine Executor          (run each capability's pure engine with its CapabilityContext) ← PURE
        ↓
Execution Result         (aggregated outputs + graph + timing + failures + confidence)
        ↓
AI (optional explanation)  (consumes the result; never plans or executes)
```

### Domain Layer
- **`CapabilityRegistry`** (`src/domain/orchestration`, pure) — a static,
  declarative map of capability → `{ dependsOn, run }`. Each entry names its
  upstream capabilities and a pure adapter that invokes the corresponding engine
  with a scoped context. Adding a capability = adding one registry entry; no
  consumer changes.
- **`CapabilityPlanner`** (pure): `planExecution(request, registry) →
  ExecutionPlan`. Deterministic dependency resolution (topological sort with a
  stable tie-break, cycle detection) over the requested capabilities + their
  transitive dependencies.
- **`EngineExecutor`** (pure, time injected): `executePlan(plan, context,
  { now }) → ExecutionResult`. Runs capabilities in plan order, threading each
  one's declared upstream outputs into its `CapabilityContext`, isolating
  failures (a failed capability is recorded; its dependents are **skipped**, not
  crashed), and aggregating outputs.
- **`Orchestrator`** entry point (pure): `orchestrate(request, context, options?)
  → ExecutionResult` = plan then execute.
- Engines themselves are **unchanged** — the registry `run` adapters call the
  existing `deriveStyleDNA` / `evaluateOutfit` / `generateOutfits` /
  `analyzeWardrobeHealth` / `recommendUnifiedOutfits` / `evaluateBuyVsSkip` /
  `interpretShoppingImage` / `normalizeVision` / `derivePreferenceProfile`
  functions.

### Service Layer
_(Design only.)_ A thin orchestration service assembles the shared
`ExecutionContext` (reusing the recommendation-context data path + RFC-004's
preference profile), calls `orchestrate(...)`, and returns `{ data, error }`.
Existing consumers (recommendations, acquisition, screenshot) migrate to request
capabilities instead of wiring engines directly — incrementally, behaviour
preserved.

### Repository Layer
None new. The Orchestrator performs **no I/O**; the context is assembled by the
service from existing repositories. No persistence in RFC-005.

### UI Layer
Only the optional developer inspector (§5). No production UI.

### AI Layer
- AI is a **downstream consumer** of `ExecutionResult`, never a participant. An
  explanation prompt builder can narrate "what ran and why this result" from the
  report (mirroring RFC-001/003/004 explanation patterns) — schema-validated,
  decision-free.
- The AI **tool-calling** layer (ADR-007) is a natural future consumer: a chat
  turn maps a user ask to a capability request, the Orchestrator plans/executes
  deterministically, and the chat narrates the result. The model requests; it
  does not plan. (§13.)
- **AI never plans, orders, or executes capabilities, and never edits outputs.**

## 7. Data Flow

```
consumer → orchestrationService.run(request)                     { data, error }
  → Context Builder: assemble ExecutionContext
      (wardrobe + health + usage + purchase + preferences + request inputs, via existing repos/services)
  → CapabilityPlanner.planExecution(request, registry)           ← PURE
      • expand requested capabilities → + transitive dependencies
      • topological sort (stable tie-break); detect cycles → error
      • → ExecutionPlan { order, graph }
  → EngineExecutor.executePlan(plan, context, { now })           ← PURE (time injected)
      for each capability in order:
        • build CapabilityContext = shared context ∩ this capability's needs + upstream outputs
        • run the registry adapter → the pure engine
        • record output, timing, confidence; on throw → record failure, mark dependents skipped
      • aggregate → ExecutionResult
  → ExecutionResult (executed, graph, outputs, timing, confidence, failures, skipped, explainability)
  → [optional] AI explanation of the result (no re-execution, no decisions)
```

Planning and execution are deterministic and side-effect-free: identical
`request` + `context` (+ injected `now`) yield an identical `ExecutionResult`
except for wall-clock timing, which is metadata (see §12).

## 8. Data Model / Schema Impact

**No database schema changes in RFC-005.** The Orchestrator is compute-only; the
`ExecutionContext` is assembled from existing tables and the `ExecutionResult` is
returned to callers, not persisted.

Future (separate RFC, noted for planning only): an optional additive
`orchestration_cache` (request-signature → `ExecutionResult`, TTL) mirroring the
AI response cache (ADR-006), to skip re-running identical requests. Documented
then, not now.

## 9. API / Domain Contracts

Illustrative (final names settled at implementation). Confidence is 0–1.

```ts
// src/domain/orchestration/types.ts  (design)

export type CapabilityId =
  // Available now (compose existing engines):
  | "styleDNA"
  | "health"
  | "usage"
  | "analytics"
  | "outfit"
  | "recommendation"
  | "acquisition"
  | "vision"
  | "personalization"
  // Reserved for future consumers (declared, not registered in this RFC):
  | "travel"
  | "packing"
  | "weather"
  | "calendar"
  | "shopping";

/** What a consumer asks for. Deterministic — no AI selects these. */
export interface CapabilityRequest {
  capabilities: CapabilityId[];
  /** Capability-specific inputs (e.g. prospective item, image, occasion filters). */
  inputs?: Record<string, unknown>;
}

/** One registry entry: dependencies + a pure adapter over an existing engine. */
export interface CapabilityDefinition<Output = unknown> {
  id: CapabilityId;
  /** Capabilities whose outputs this one needs (drives ordering). */
  dependsOn: CapabilityId[];
  /** Pure: invokes the engine with the scoped context + upstream outputs. */
  run(ctx: CapabilityContext): Output;
}

export type CapabilityRegistry = Record<CapabilityId, CapabilityDefinition>;

/** Shared, read-only context every capability draws its slice from. */
export interface ExecutionContext {
  generatedAt: string;
  recommendation: RecommendationContext; // the assembled wardrobe/usage/health/preferences snapshot
  inputs: Record<string, unknown>;       // request inputs
}

/** The narrowed context handed to a single capability's `run`. */
export interface CapabilityContext {
  shared: ExecutionContext;
  /** Outputs of already-executed upstream capabilities this one declared. */
  upstream: Partial<Record<CapabilityId, unknown>>;
}

export interface ExecutionPlan {
  /** Capabilities in a deterministic, dependency-respecting order. */
  order: CapabilityId[];
  /** Adjacency (capability → its dependencies) for display/debug. */
  graph: Record<CapabilityId, CapabilityId[]>;
}

export type CapabilityStatus = "executed" | "failed" | "skipped";

export interface CapabilityOutcome {
  id: CapabilityId;
  status: CapabilityStatus;
  output: unknown | null;
  /** 0–1, surfaced by the engine when it reports one (else null). */
  confidence: number | null;
  /** Wall-clock duration; metadata only (see §12). */
  durationMs: number | null;
  /** Present when status = "failed". */
  error?: string;
  /** Present when status = "skipped" — the failed dependency that caused it. */
  skippedBecause?: CapabilityId;
}

/** THE standardized output. AI and consumers read this. */
export interface ExecutionResult {
  executed: CapabilityId[];
  skipped: CapabilityId[];
  failed: CapabilityId[];
  plan: ExecutionPlan;
  outcomes: Record<CapabilityId, CapabilityOutcome>;
  /** Aggregate confidence (mean over executed capabilities that report one). */
  confidence: number | null;
  /** Human-facing "what ran and why" trace, decision-free (for AI + debug). */
  explainability: string[];
  metadata: {
    orchestratorVersion: string;
    generatedAt: string;
    totalDurationMs: number | null;
  };
}

export function planExecution(
  request: CapabilityRequest,
  registry: CapabilityRegistry,
): ExecutionPlan;

export function orchestrate(
  request: CapabilityRequest,
  context: ExecutionContext,
  options?: { now?: string; registry?: CapabilityRegistry },
): ExecutionResult;
```

### Context layering (deterministic)

```
RecommendationContext        (existing snapshot: wardrobe + usage + health + purchase + preferences)
   ↓ wrapped by
ExecutionContext             (+ request inputs + generatedAt) — shared, read-only
   ↓ narrowed per capability
CapabilityContext            (shared slice + declared upstream outputs)
   ↓ handed to
Engine                       (the existing pure function — unchanged)
```

### Execution model (deterministic)

```
CapabilityRequest
   ↓  expand to requested + transitive dependencies
Dependency Resolution        topological sort, stable tie-break (by CapabilityId), cycle → error
   ↓
Execution Plan               ordered list + dependency graph
   ↓  run in order, thread upstream outputs into CapabilityContext
Execute                      each capability's pure engine; failures isolated, dependents skipped
   ↓
Aggregate Results            collect outcomes, confidence, timing
   ↓
Execution Report             ExecutionResult (executed / skipped / failed / graph / explainability)
```

Ordering, resolution, and cycle detection are pure and reproducible. A failed
capability is **contained**: it is recorded as `failed`, its transitive
dependents are marked `skipped` (with `skippedBecause`), and unrelated branches
still execute — the Orchestrator never throws mid-graph for a single engine
failure.

## 10. Acceptance Criteria

This RFC is **Approved-ready** when it defines all of the below (it does):

- [ ] A deterministic orchestration model: capability registry, dependency
      resolution (topological order + stable tie-break + cycle detection),
      execution planner, executor, and aggregated `ExecutionResult`.
- [ ] Domain contracts: `CapabilityId`, `CapabilityRequest`,
      `CapabilityDefinition`/`CapabilityRegistry`, `ExecutionContext`,
      `CapabilityContext`, `ExecutionPlan`, `CapabilityOutcome`,
      `ExecutionResult`, and the `planExecution` / `orchestrate` signatures.
- [ ] The context layering (`RecommendationContext → ExecutionContext →
      CapabilityContext → Engine`) and the execution model (request → resolve →
      plan → execute → aggregate → report).
- [ ] Clear boundary: **no engine business logic inside the Orchestrator**, no
      AI in the plan/execute path, engines stay pure, no engine calls another.
- [ ] Explicit non-goals (AI reasoning, workflow automation, scheduling,
      background jobs, notifications).
- [ ] A testing plan, risks, and future extensions.

Implementation-time acceptance criteria (tracked in that PR — not this RFC):
- [ ] `planExecution` is pure and deterministic (same request + registry ⇒
      identical plan); requesting a capability pulls in its transitive deps.
- [ ] Cycles in the registry are detected and reported (never infinite-loop).
- [ ] `orchestrate` is deterministic given `{ now }` — identical result except
      wall-clock timing metadata.
- [ ] A failed capability is isolated: it is `failed`, its dependents are
      `skipped` with `skippedBecause`, unrelated capabilities still `executed`.
- [ ] The Orchestrator contains **no** scoring/eligibility/ranking logic — every
      such value comes verbatim from an engine output.
- [ ] Removing AI leaves plans and results unchanged (AI explains only).
- [ ] Migrated consumers (recommendation/acquisition/screenshot) produce the same
      user-facing results as before the migration.

## 11. QA / Testing Plan

- **Unit tests (Vitest, pure) — the core:**
  - Dependency resolution: requesting `recommendation` pulls `health` + `usage` +
    `personalization` (etc.) into the plan; order respects dependencies.
  - Topological determinism: same request ⇒ identical `order` (stable tie-break).
  - Cycle detection: a registry with a cycle → a clear error, no hang.
  - Executor aggregation: outputs collected under the right `CapabilityId`;
    aggregate confidence = mean of reported confidences.
  - Failure isolation: a capability whose `run` throws → `failed`; its dependents
    → `skipped` (`skippedBecause`); independent capabilities still `executed`.
  - Determinism: same request + context + `now` ⇒ identical `ExecutionResult`
    (excluding `durationMs`/`totalDurationMs`).
  - Registry: unknown/unregistered capability → error; reserved-but-unregistered
    future capabilities (`travel`, …) are not runnable yet.
  - No business logic: a fake registry proves the Orchestrator only *routes* —
    given canned engine adapters, outputs pass through unchanged.
- **Contract/integration guard:** a small end-to-end test composing real engines
  (e.g. `vision → acquisition`) via the registry produces the same result as the
  hand-wired screenshot path.
- **No AI and no I/O in the automated suite** — engines and context are provided
  as fixtures; timing is injected.
- **Release gate:** `npm test` green before any tag (ADR-008).

## 12. Risks & Trade-offs

- **Over-abstraction.** A generic orchestrator can be heavier than the hand-wiring
  it replaces. *Mitigation:* keep it a thin, pure planner+executor; only migrate
  consumers when they genuinely share wiring; measure before generalising.
- **Hidden coupling via upstream outputs.** Threading one capability's output into
  another risks re-creating cross-engine coupling by the back door.
  *Mitigation:* dependencies are **declared** in the registry and routed only by
  the Orchestrator; engines still receive plain inputs and never reference each
  other.
- **Timing is non-deterministic.** Wall-clock `durationMs` cannot be reproducible.
  *Trade-off:* timing is **metadata**, explicitly excluded from the determinism
  guarantee; `now` is injected so tests pin `generatedAt`. Result *outputs* are
  fully deterministic.
- **Failure semantics.** "Skip dependents, continue siblings" is a policy choice;
  some consumers may want all-or-nothing. *Mitigation:* document the default;
  a strictness option is a future extension, not v1.
- **Migration risk.** Rewiring shipped consumers (recommendation/acquisition/
  screenshot) could change results. *Mitigation:* migrate incrementally behind
  equivalence tests (same user-facing output); the Orchestrator is additive until
  a consumer opts in.
- **Scope creep toward workflow/scheduling/jobs.** *Mitigation:* hard non-goals;
  the Orchestrator is synchronous, in-request composition only.
- **Registry as a god-object.** *Mitigation:* the registry is declarative data
  (dependencies + a one-line engine adapter per capability), not logic.

## 13. Future Extensions

The Orchestrator is designed so that new capabilities are **registry entries**,
and new features are **consumers** (each its own RFC):

- **Travel / Packing / Weather / Calendar / Shopping** — new capabilities that
  compose existing engines plus their own; they register dependencies and are
  requested like any other. No consumer re-wiring.
- **AI Chat as a consumer** — a chat turn maps an ask to a `CapabilityRequest`
  via the tool-calling layer (ADR-007); the Orchestrator plans/executes
  deterministically and the chat narrates the `ExecutionResult`. The model
  requests; it never plans.
- **Orchestration result cache** — an ADR-006-style cache keyed on the request
  signature + context fingerprint.
- **Strictness / partial-result policies** — configurable failure handling
  (all-or-nothing vs best-effort) per request.
- **Parallel execution** — independent branches of the graph could run
  concurrently; the ordering/among-siblings result must stay deterministic.
- **Capability explanations** — a dedicated prompt builder that narrates the
  execution report for the developer inspector and (later) chat.

## 14. Open Questions

1. **Location** — does the Orchestrator live in `src/domain/orchestration`
   (pure), or in a dedicated non-domain layer since it coordinates rather than
   computes? (Leaning pure domain — it's deterministic and I/O-free.)
2. **Sync-only vs async engines** — all current engines are synchronous pure
   functions. Do we require capabilities to be sync (keeping the executor pure),
   or allow async adapters (for future engines that must await)? If async, how do
   we preserve determinism and testability?
3. **Failure policy default** — is "skip dependents, continue siblings" the right
   default, or should some requests be all-or-nothing? Per-request override?
4. **Context assembly ownership** — does the Orchestrator's *service* always
   build the full `RecommendationContext`, or can a request declare a lighter
   context when only some capabilities are needed (avoid over-fetching)?
5. **Capability granularity** — is `recommendation` one capability, or does it
   decompose into `generateOutfits` + `rankOutfits`? How fine-grained before the
   registry becomes noise?
6. **Confidence aggregation** — is a mean of per-capability confidences
   meaningful across heterogeneous engines, or should aggregate confidence be
   omitted and only per-outcome confidence reported?
7. **Migration order** — which consumer migrates first as the proof of value
   (likely the screenshot `vision → acquisition` chain, being the clearest graph)?
