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
  AI runs through the **AI Runtime** (`src/runtime/ai`, RFC-014/014A), which routes
  each capability to a provider + model by policy — **cost-first**: Gemini for
  conversation/explanation/summarization/vision, OpenAI only for structured +
  classification (cheap gpt-5.4 mini/nano), with a Gemini fallback and an OpenAI
  budget guard. This is orthogonal to the deterministic graph below — it changes
  *who narrates*, never *what is decided*.

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
- **Trip Planner (RFC-017)** — `src/features/trips` (+ pure `src/domain/trips`
  helpers), `/trips`. A *feature* layer, **not a new engine**: it persists trips
  as data and reuses the Lifestyle Engine (`planTrip`) to derive the plan, so
  Recommendation + Acquisition are still reached through the orchestrator and no
  planning logic is duplicated. `src/domain/trips` adds only pure projections
  (templates, clone, multi-city day resolution, packing checklist, timeline);
  multi-city merges per-leg forecasts from the Weather Runtime (RFC-011) into one
  forecast the engine plans over. Engines decide; AI explains.
- **Shopping Intelligence (RFC-018)** — `src/features/shopping` (+ pure
  `src/domain/shopping` aggregation), `/acquisitions` hub + `/acquisitions/intelligence`.
  Like the Intelligence Center, it **aggregates, never decides**: the Acquisition
  engine (Buy vs Skip, RFC-001) decides each wishlist item, and Shopping
  Intelligence ranks the queue (Need × Impact × Buy), computes ROI, and clusters
  duplicates. It reuses the acquisition context once (`loadAcquisitionContext` →
  `evaluateWithContext`) so Recommendation + Personalization still flow through
  Buy vs Skip; the wishlist↔wardrobe duplicate axis reuses the acquisition
  `similarExistingItems`. No new verdict, no duplicated scoring. Engines decide;
  AI explains.
- **Acquisitions Intelligence (RFC-018B)** — `src/domain/shopping/v2` (+ hub
  panels / `/developer/acquisitions`). Letter-suffix evolution of RFC-018:
  purchase lifecycle, shallow+deep recommendation accuracy, need/ROI timelines,
  opportunity queue, and dynamic strategy from outcomes. Composes 018 dashboard
  outputs; never reimplements Buy vs Skip or PriorityEngine.
- **Vision Intelligence v2 (RFC-019)** — `src/features/vision` (+ pure
  `src/domain/vision-intelligence`), `/vision`. Workflow layer over the Vision
  Engine (RFC-002): Closet Scan, Assisted Outfit Recognition, Visual Duplicate
  Detection, Review Queue. Perception stays in `analyzeImage` / `/api/ai/vision`;
  Intelligence only matches to inventory and builds confirmation actions. Never
  auto-adds or auto-logs. Engines detect; user confirms; AI may explain.
- **Inventory Image Intelligence (RFC-020)** — `src/domain/inventory-image-intelligence`
  (+ inventory feature service/repo/UI). Primary image → Vision → pending
  `VisualStyleAttributes` → Accept/Reject → StyleDNA gap-fill into
  RecommendationContext. Item detail card + `/developer/inventory-images`.
  Manual fields always win; never auto-accepts; does not duplicate RFC-019.
- **Future (RFC per feature):** Calendar and more — each registers capabilities
  and is *requested*, reusing all wiring. The existing Recommendation /
  Acquisition / Screenshot flows can migrate to request capabilities
  incrementally (behaviour-preserving).
