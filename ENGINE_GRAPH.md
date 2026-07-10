# Engine Graph

How Wardrobe OS's deterministic engines compose, and how the **Intelligence
Orchestrator** (RFC-005) coordinates them. See [ENGINE.md](ENGINE.md) for each
engine's internals and [ARCHITECTURE.md](ARCHITECTURE.md) for the layering.

## Principle

Engines are **pure and independent** — none imports or calls another. When a
result needs several engines, a caller composes them. Historically each service
hand-wired that composition; the **Intelligence Orchestrator**
(`src/domain/orchestrator`) makes it one deterministic, testable place.

- **Engines decide.** Scoring, eligibility, ranking, taste — all inside engines.
- **The Orchestrator composes.** It owns *which* engines run and *in what order*.
  It has no business logic, never calls AI, and never lets engines call each other.
- **AI explains.** It consumes an `ExecutionReport`; it never plans or executes.

## Capabilities → engines

Each capability is a thin adapter over an existing engine (`src/domain/orchestrator/CapabilityRegistry.ts`):

| Capability | Composes engine | Output |
| --- | --- | --- |
| `health` | WardrobeHealthEngine (`analyzeWardrobeHealth`) | wardrobe health snapshot |
| `usage` | UsageAnalyticsEngine | usage analytics |
| `personalization` | PersonalizationEngine v2 (`derivePreferenceProfileV2`, RFC-004/013) | preference snapshot (+ lifecycle / explore-exploit) |
| `analytics` | InsightEngine (`generateInsights`) | insight report |
| `weather` | Weather Runtime (`WeatherSnapshot`, RFC-011) | current weather snapshot |
| `outfit` | OutfitGenerationEngine (`generateOutfits`) | generated outfits |
| `recommendation` | RecommendationEngine v2 (`recommendV2`, RFC-012) | ranked outfits (+ quality metrics) |
| `vision` | ShoppingImageInterpreter (`interpretShoppingImage`, RFC-003) | prospective-item candidate |
| `acquisition` | BuyVsSkipEngine (`evaluateBuyVsSkip`, RFC-001) | buy/skip verdict |

The `weather` capability surfaces the `WeatherSnapshot` already resolved into the
`RecommendationContext` (weather is data — it never recommends); the runtime that
fetches it lives outside the pure engine graph in `src/runtime/weather`.

Reserved (declared, not yet registered): `travel`, `packing`, `calendar`,
`shopping`.

## Dependency graph

```
health ─┐
        ├─► analytics
usage ──┘

weather ────────┐
outfit ─────────┤
                ├─► recommendation
personalization ┘

weather ─► outfit

personalization ─► acquisition   (uses an upstream `vision` candidate when present)

vision   (leaf)
```

The planner expands the requested capabilities to include transitive
dependencies, then resolves a deterministic order (Kahn's algorithm, smallest-id
tie-break). Cycles are detected and raised, never looped.

## Execution flow

```
CapabilityRequest
   ↓  ExecutionPlanner: buildDependencyGraph → resolveExecutionOrder
Execution Plan (order + graph)
   ↓  EngineExecutor: run each capability with its CapabilityContext
      • upstream outputs threaded to dependents
      • a failed capability → its dependents are skipped; siblings still run
      • timing captured via an injected clock (metadata only)
Execution Result (per-capability outcomes)
   ↓  buildExecutionReport
ExecutionReport
   ↓  (optional) AI narration — routed by AI Runtime v2 (RFC-014); consumes the report, never decides
```

## ExecutionReport

`orchestrate(request, context)` returns an `ExecutionReport`:

- `executedCapabilities`, `skippedCapabilities`, `failedCapabilities`
- `executionOrder`, `dependencyGraph`
- `timings` (per capability + `__total`)
- `confidence` (evidence-mean of executed capabilities that report one)
- `outcomes` (per-capability status / output / confidence / error / skippedBecause)
- `explainability` (decision-free "what ran and why")
- `metadata` (orchestrator version, generatedAt, total duration, capability count)

## Determinism

Same `request` + `context` (+ injected clock) ⇒ identical report, wall-clock
timing aside. Timing is metadata, explicitly outside the determinism guarantee;
`generatedAt` and the timing clock are injected so tests pin them.

## Consumers

- **Now:** AI chat via the `runIntelligence` tool; the orchestrator feature
  service assembles context from repositories.
- **Lifestyle Engine (RFC-006)** — the first real orchestrator consumer. Trip
  planning (`src/domain/lifestyle`, `/lifestyle/trip`) requests the
  `recommendation` capability per trip-day and the `acquisition` capability for
  missing items **through the orchestrator**, never calling those engines
  directly — composing them across a time horizon into a `LifestylePlan`.
- **Intelligence Center (RFC-015)** — `src/domain/intelligence`,
  `/intelligence`. Aggregates every engine's output into one deduplicated,
  impact-ranked list of typed actions ("what to do next"). It consumes engine
  conclusions and ranks them; it decides nothing new; AI explains.
- **Future (RFC per feature):** Calendar, Shopping, and more — each registers
  capabilities and is *requested*, reusing all wiring. The existing
  Recommendation / Acquisition / Screenshot flows can migrate to request
  capabilities incrementally (behaviour-preserving).
