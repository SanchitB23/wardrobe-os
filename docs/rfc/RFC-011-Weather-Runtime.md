# RFC-011: Weather Runtime

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Claude (Opus 4.8)
Target Release: v1.1.0
Epic: Runtime
Priority: Critical
Effort: M
Dependencies:
- RFC-005 Intelligence Orchestrator (`src/domain/orchestrator`) — weather becomes a registered capability
- RFC-006 Lifestyle Engine (`src/domain/lifestyle`, `src/features/weather` — relocated to `src/runtime/weather`) — the existing partial weather provider this RFC promotes
- ADR-002 (RecommendationContext), ADR-004 (provider abstraction pattern), ADR-005 (AI does not decide)

> **Revision (review comments applied):** (1) `WeatherForecast → WeatherSnapshot →
> RecommendationContext`, recommendation consumes the snapshot only; (2)
> standardized enum-style `WeatherLabel`s; (3) `RecommendationContext.weather` is a
> `WeatherSnapshot`; (4) graceful degradation to a seasonal-fallback snapshot that
> the AI explains (never hallucinated); (5) documented future Runtime Metrics
> (cache hit/miss, provider, latency); (6) runtime relocated to
> `src/runtime/weather` (not `features`). Documentation only — no implementation.

---

## 1. Problem Statement

Wardrobe OS cannot reason about **live weather** as a first-class input. Today:

- A partial weather provider exists but is **owned by the Lifestyle Engine**
  (RFC-006): `src/features/weather/provider/*` returns a `WeatherForecast` whose
  types live in `@/domain/lifestyle/types`, and it is called **directly** by
  `LifestyleService` — not through the orchestrator.
- The **Recommendation** path does **not** use live weather at all:
  `RecommendationContext.weather` is derived from a **static Delhi seasonal
  profile** (`deriveWeather` / `SEASON_WEATHER` in `RecommendationContextBuilder`).
- The orchestrator **reserves** a `"weather"` `CapabilityId` (`Capability.ts`) but
  **does not register or run it**.

The consequence: when the AI Stylist is asked weather-dependent questions ("what
should I wear today given it's raining?"), there is **no deterministic weather
source feeding the engines**, so the answer leans on the model's guesswork. That
violates the core philosophy — **AI explains; engines decide** (ADR-005).

## 2. Goals

- A **provider-agnostic Weather Runtime**: fetch → normalize → cache → return a
  canonical, richer `WeatherForecast`.
- Make **weather a first-class orchestrator capability** (register the reserved
  `"weather"` id) that other capabilities can depend on.
- Feed **`RecommendationContext.weather`** from live weather (replacing the static
  seasonal profile), and route **Lifestyle** through the same runtime.
- **Recommendation consumes a narrow `WeatherSnapshot` only** — a small,
  engine-facing projection of the full `WeatherForecast`. The engine never sees
  the rich forecast (hourly arrays, provider metadata) or any provider.
- **Degrade gracefully** — if the Weather Runtime fails, recommendation falls back
  to **seasonal defaults**, the `WeatherSnapshot` marks itself as a fallback, and
  the **AI explains that a seasonal estimate was used**. Weather is never
  hallucinated.
- **AI never generates weather** — it only consumes what the runtime produced.
- **Swapping providers requires zero business-logic changes** (engines depend on
  the normalized `WeatherSnapshot`, never a provider or the raw forecast).

## 3. Non-Goals

- **No AI** in the runtime (no model calls to invent or "estimate" weather).
- **No database / no persistence** — caching is in-memory only (weather is
  ephemeral; this deliberately does **not** reuse the Supabase `ai_cache`).
- No new UI surface (the Lifestyle wizard's manual-weather entry stays; a
  weather widget is a future extension, not this RFC).
- No geocoding service beyond what a provider already offers (Open-Meteo's
  geocoding is used as-is; a dedicated geocoder is future).
- No historical/forecast-beyond-provider-horizon modeling.

## 4. User Stories

- As the owner, when I ask the stylist "what do I wear today?", the outfit
  recommendation should already account for **today's real conditions** (temp,
  rain, wind) — deterministically — and the AI should only explain that choice.
- As the owner planning a trip, packing should use the **same** weather source as
  daily recommendations, so advice is consistent.
- As the developer, I want to swap Open-Meteo for another provider (or force
  manual entry) by changing **one env var**, with no engine edits and no test
  churn in the domain layer.

## 5. UX Flow

```
User asks a weather-dependent question / opens Today / plans a trip
        │
        ▼
Weather Capability  (orchestrator resolves it as a dependency/source)
        │
        ▼
Weather Runtime  (src/runtime/weather)  →  selects provider (env)  →  cache check
        │                                        │ hit → cached forecast
        ▼                                        ▼ miss → fetch
Weather Provider (Open-Meteo | Manual | future)
        │
        ▼
Weather Normalizer (pure)
        │
        ▼
WeatherForecast ──(project)──▶ WeatherSnapshot ──▶ RecommendationContext.weather
        │                              │                    │
        └──────────▶ Lifestyle         │                    ▼
        (full forecast)                │            Recommendation Engine (decides)
                                        │                    │
                        runtime fails ──┘                    ▼
                        → seasonal-fallback snapshot   AI Explanation
                          (source flagged)             (explains only; states
                                                        "seasonal estimate" on fallback)
```

There is no dedicated screen: the runtime is infrastructure. Existing surfaces
(Today's outfit, `/chat`, `/lifestyle/trip`) consume its output.

## 6. Architecture

Split along the **pure-domain vs. I/O-feature** boundary CLAUDE.md requires.

### Domain Layer — `src/domain/weather` (pure, new)
Promote weather from a lifestyle sub-type into its own pure domain:
- **Types**: `WeatherForecast` (the full, rich object), `WeatherConditions`
  (current), `HourlyForecast`, `DailyForecast`, the standardized `WeatherLabel`
  **enum-style union** (see comment 2 / § Output), and **`WeatherSnapshot`** — the
  narrow, engine-facing projection the Recommendation Engine consumes.
  `WeatherForecast` / `WeatherForecastDay` **move here from
  `@/domain/lifestyle/types`**; lifestyle re-exports for backward compatibility.
- **`WeatherSnapshot` (comments 1 & 3):** a small, flat value that carries only
  what outfit scoring needs — `condition`, `season`, `temperatureC`,
  `feelsLikeC`, `rainRisk`, `windKph`, `labels: WeatherLabel[]`, plus a
  provenance flag `source: "live" | "manual" | "seasonal-fallback"` and
  `confidence`. **The engine never receives the full `WeatherForecast`** (no
  hourly arrays, no provider metadata).
- **Pure functions** (no I/O): `normalize*` (raw provider shape → forecast),
  `feelsLike(...)`, `conditionFor(...)`, `seasonFor(dateIso, latitude)`,
  `weatherLabels(...): WeatherLabel[]`, `forecastConfidence(...)`, and
  **`toWeatherSnapshot(forecast, { at }): WeatherSnapshot`** (projects the day/hour
  relevant to the request). These are the existing `WeatherNormalizer` helpers,
  relocated and extended. Deterministic; time and latitude injected.
- **`seasonalFallbackSnapshot(dateIso, location): WeatherSnapshot`** — builds a
  `source: "seasonal-fallback"` snapshot from the existing seasonal profile (the
  current `SEASON_WEATHER`), used when the runtime yields no live/manual data
  (comment 4).

### Runtime Layer — `src/runtime/weather` (I/O; comment 6)
Weather I/O lives in a dedicated **runtime** module, `src/runtime/weather`
(conceptually a peer of `src/ai`, **not** a feature). The existing
`src/features/weather/provider/*` relocates here.
- **`WeatherProvider` interface** (exists; extend): a provider fetches raw data
  for a location + date range and hands it to the pure normalizer. Never imports
  an engine.
- **Providers**: `OpenMeteoProvider` (primary, exists), `ManualWeatherProvider`
  (always-available; builds a forecast from user-entered days), future
  `WeatherApiProvider` / `TomorrowIoProvider` (stubs, like the AI provider stubs).
- **`WeatherRuntime`** (new service): the composition root — selects the provider
  (via `WEATHER_PROVIDER` env, default `open-meteo`), fetches, calls the pure
  normalizer, applies caching, records metrics (§ Runtime Metrics), and returns a
  `WeatherForecast` as `{ data, error }`. Mirrors `src/ai`'s orchestrator/provider
  split (ADR-004).
- **Cache**: in-memory, short TTL (default ~1h), keyed by
  `provider + rounded(lat,lon) + dateRange + granularity`. A `WeatherCache`
  interface with an in-memory implementation (no Supabase).

### Orchestrator integration — `src/domain/orchestrator`
- Register the reserved **`weather`** capability in `CapabilityRegistry`. It is a
  **source** capability (`dependsOn: []`) whose engine call resolves a
  `WeatherForecast` from the `ExecutionContext` (the feature service injects it,
  keeping the domain pure — same pattern as the other capabilities).
- `recommendation` and `lifestyle` capabilities may declare `weather` as a
  dependency so the orchestrator runs it first and hands the forecast downstream;
  failure isolation applies (no weather ⇒ recommendation still runs on a
  seasonal-fallback snapshot, never blocks).

### Service Layer
- A runtime service assembles weather into the `ExecutionContext` and into
  `buildRecommendationContext({ weather })`. It calls
  `toWeatherSnapshot(forecast)` and stores the **`WeatherSnapshot`** on
  `RecommendationContext.weather` (comment 3) — the full `WeatherForecast` is
  **not** put on the context. This replaces the static `deriveWeather` seasonal
  profile while keeping the engine signature unchanged.
- `LifestyleService` obtains the **full `WeatherForecast`** from the runtime (it
  needs per-day/hourly detail), while recommendation only ever sees the snapshot.

### Graceful degradation (comment 4)
If `WeatherRuntime.getForecast` returns `{ data: null, error }` (provider down,
timeout, no location), the service builds a **`seasonalFallbackSnapshot`** from the
existing seasonal profile and sets `WeatherSnapshot.source = "seasonal-fallback"`.

- Recommendation proceeds normally on that snapshot — it never blocks and never
  waits on a hung provider.
- The explanation path **must surface the fallback**: when `source ===
  "seasonal-fallback"`, the AI states it used a **seasonal estimate because live
  weather was unavailable** (e.g. "Based on typical July conditions — live weather
  wasn't available"). The AI **never fabricates specific values** (no invented
  temperature/rain numbers); it only relays the snapshot's fields and their
  provenance. Reinforces ADR-005.

### AI Layer
Unchanged in spirit: the AI receives the **snapshot** (and, for lifestyle, a
forecast summary) as **context to explain**. No prompt builder, tool, or model
call produces weather values; on fallback it explains the estimate rather than
inventing readings. Reinforces ADR-005.

### Runtime Metrics (documented future — comment 5)
The `WeatherRuntime` is the natural place to emit operational metrics. **Not built
in this RFC**; documented so the runtime is designed with hooks for them:

- **Cache Hit** / **Cache Miss** (per key / overall ratio).
- **Provider** (which provider served the request; fallback occurrences).
- **Latency** (provider fetch time; end-to-end `getForecast` time).

Intended as a lightweight, in-memory `WeatherMetrics` sink behind an interface
(no DB), later surfaced in the Developer hub / a Playground "Weather" tab
alongside the AI runtime metrics envisioned for the v1.1 AI-Runtime epic.

## 7. Data Flow

```
buildContext / orchestrator plan
  → WeatherRuntime.getForecast({ location, range })        [src/runtime/weather]
      → cache.get(key) ── hit ─▶ WeatherForecast          (metrics: cache hit)
      └ miss → provider.fetch(...) → normalize(raw) → cache.set(key, forecast)
                                                          (metrics: miss, provider, latency)
  → ok:   toWeatherSnapshot(forecast) ─▶ RecommendationContext.weather  (WeatherSnapshot)
  → fail: seasonalFallbackSnapshot()  ─▶ RecommendationContext.weather  (source: seasonal-fallback)
  → recommendUnifiedOutfits(context)             [engine decides — snapshot only]
  → explanation service reads snapshot           [AI explains; notes fallback if any]
Lifestyle: planLifestyle consumes the full WeatherForecast per trip day (not the snapshot).
```

Provider selection and failure: `WEATHER_PROVIDER` chooses the primary; on
provider error the runtime tries `manual`/last-good-cache, else returns
`{ data: null, error }`. Recommendation then falls back to a **seasonal-fallback
snapshot** (never blocks, never waits on a hung provider); the AI explains the
estimate. Lifestyle degrades to manual entry.

## 8. Data Model / Schema Impact

**No schema changes. No database.** Caching is in-memory and process-local. No
tables, no migrations, no `ai_cache` reuse. Weather is never persisted.

**Environment:** add `WEATHER_PROVIDER` (optional, default `open-meteo`) and any
future provider API keys (server-side only, e.g. `WEATHERAPI_KEY`) to
`.env.example`. Open-Meteo needs no key.

## 9. API / Domain Contracts

```ts
// src/domain/weather/types.ts (pure)

// Comment 2: standardized, enum-style labels — never free-form strings.
export type WeatherLabel =
  | "hot" | "warm" | "mild" | "cool" | "cold"
  | "rainy" | "humid" | "windy" | "high-uv"
  | "layer-up" | "waterproof";
export type WeatherCondition = "hot" | "warm" | "mild" | "cool" | "cold" | "rainy";

export interface WeatherConditions {
  temperatureC: number | null;
  feelsLikeC: number | null;
  condition: WeatherCondition;
  rainRisk: number | null;          // 0..1
  humidity: number | null;          // 0..1
  windKph: number | null;
  uvIndex: number | null;
}
export interface HourlyForecast extends WeatherConditions { time: string }
export interface DailyForecast {
  date: string;
  season: SeasonLabel;
  high: WeatherConditions;
  low: WeatherConditions;
  labels: WeatherLabel[];           // enum-style, not free-form
}
// The full, rich object — produced by the runtime, consumed by Lifestyle.
export interface WeatherForecast {
  location: { name: string; latitude: number; longitude: number };
  current: WeatherConditions | null;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  confidence: number;               // 0..1 (coverage/provider quality)
  metadata: { provider: string; fetchedAt: string; source: "live" | "manual" | "cache" };
}

// Comments 1 & 3: the narrow, engine-facing projection. This — NOT WeatherForecast
// — is what RecommendationContext.weather holds and what the Recommendation Engine
// consumes. Flat, minimal, provenance-tagged.
export interface WeatherSnapshot {
  season: SeasonLabel;
  condition: WeatherCondition;
  temperatureC: number | null;
  feelsLikeC: number | null;
  rainRisk: number | null;          // 0..1
  windKph: number | null;
  labels: WeatherLabel[];
  confidence: number;               // 0..1
  source: "live" | "manual" | "seasonal-fallback";
}

// Pure projections (no I/O):
export function toWeatherSnapshot(forecast: WeatherForecast, opts: { at: string }): WeatherSnapshot;
export function seasonalFallbackSnapshot(dateIso: string, location: { latitude: number }): WeatherSnapshot;

// RecommendationContext (ADR-002): the `weather` field is a WeatherSnapshot.
//   interface RecommendationContext { …; weather: WeatherSnapshot; … }

// src/runtime/weather (I/O — comment 6)
export interface WeatherProvider {
  readonly id: string;
  forecast(input: WeatherQuery): Promise<RawWeather>;   // provider-shaped
}
export interface WeatherRuntime {
  getForecast(query: WeatherQuery): Promise<{ data: WeatherForecast | null; error: Error | null }>;
}

// Documented future (comment 5) — in-memory, no DB:
export interface WeatherMetrics {
  record(event:
    | { type: "cache_hit" | "cache_miss"; key: string }
    | { type: "fetch"; provider: string; latencyMs: number; fallback: boolean }
  ): void;
}
```

- **Recommendation contract change:** `RecommendationContext.weather` becomes a
  `WeatherSnapshot` (previously a broader `WeatherSnapshot`-shaped seasonal value).
  The engine keeps consuming `context.weather` — only the producer and provenance
  change — so no scoring-engine signature churn.
- **Backward compatibility:** the existing lifestyle `WeatherForecast` /
  `WeatherForecastDay` are re-exported from `@/domain/weather` so RFC-006 code
  keeps compiling; the richer fields and `WeatherLabel`/`WeatherSnapshot` are
  additive.
- **No route/tool contract changes.** (A read-only `/api/weather` debug endpoint
  is optional/future, not required.)

## 10. Acceptance Criteria

- [ ] **Weather works independently** — `WeatherRuntime.getForecast(...)` returns
      a normalized `WeatherForecast` from Open-Meteo (and from Manual) with no
      engine or AI involvement; covered by unit tests.
- [ ] **Recommendation consumes `WeatherSnapshot` only** — `RecommendationContext.weather`
      is a `WeatherSnapshot` projected from the live forecast (not the full
      `WeatherForecast`, not the static Delhi seasonal profile); outfit scoring
      reflects real conditions.
- [ ] **Lifestyle uses `WeatherForecast`** — `LifestyleService` sources the full
      forecast from the runtime/orchestrator, not a direct `OpenMeteoProvider` call.
- [ ] **Standardized labels** — every weather label is a `WeatherLabel` enum value;
      no free-form label strings anywhere in the produced forecast/snapshot.
- [ ] **Graceful degradation** — when the runtime fails, recommendation runs on a
      `source: "seasonal-fallback"` snapshot (never blocks), and the AI explains it
      used a seasonal estimate; it never invents specific weather values (ADR-005).
- [ ] **AI only consumes weather** — no prompt builder/tool/model produces weather
      values; the explanation path receives the snapshot/forecast as context.
- [ ] **Provider swap requires zero business-logic changes** — changing
      `WEATHER_PROVIDER` (or adding a provider) touches only `src/runtime/weather`;
      `src/domain/**` engines and their tests are untouched.
- [ ] **Orchestrator** registers and runs the `weather` capability; recommendation/
      lifestyle can depend on it; failure isolation holds (no weather ⇒ still runs
      on the fallback snapshot).
- [ ] Gate: `npm test` green (new pure-normalizer/snapshot/fallback + runtime
      tests), `npm run lint` ≤ baseline, `npm run build` passes.

## 11. QA / Testing Plan

- **Domain (Vitest, pure):** `normalize*`, `feelsLike`, `conditionFor`,
  `seasonFor` (northern + southern hemisphere), `weatherLabels` (asserts only
  `WeatherLabel` enum values — no free-form strings), `forecastConfidence`,
  `toWeatherSnapshot` (correct day/hour projection; forecast fields excluded), and
  `seasonalFallbackSnapshot` (`source === "seasonal-fallback"`). Deterministic,
  injected time/lat. Migrate + extend the existing `weather-normalizer.test.ts`.
- **Runtime:** cache hit/miss/expiry; provider selection by env; provider-error
  fallback to manual/cache; `{ data, error }` contract; metrics sink records
  hit/miss/provider/latency (comment 5).
- **Integration:** a context built with live weather yields weather-sensitive
  recommendation differences (rainy vs. clear); a **failed** runtime yields a
  seasonal-fallback snapshot and a recommendation that still returns; lifestyle
  plan consumes the full forecast; orchestrator `ExecutionReport` includes
  `weather` and downstream capabilities see the snapshot.
- **AI boundary check:** grep/test that `src/ai` and prompt builders never
  synthesize weather values; on fallback the explanation names the estimate.

## 12. Risks & Trade-offs

- **Type ownership move** (`WeatherForecast` lifestyle → weather domain) risks
  churn. Mitigation: re-export from the old path; additive fields only.
- **Provider latency / rate limits** on the hot path (Today, chat). Mitigation:
  in-memory cache + short TTL + graceful degradation (recommendation runs without
  weather rather than blocking).
- **Location source.** Recommendation currently assumes Delhi NCR; live weather
  needs a location. Trade-off: default to a configured home location (env/profile)
  and let Lifestyle pass the trip destination. A full location picker is future.
- **In-memory cache is process-local** (not shared across serverless instances).
  Acceptable for a single-user app; a shared cache is a future extension and would
  reopen the "no database" decision.
- **Confidence semantics.** `confidence` is coverage/quality, not probability of
  correctness — documented so the AI never over-claims certainty. On a
  `seasonal-fallback` snapshot, confidence is low and the AI must say so.
- **Snapshot ⇄ forecast drift.** The `WeatherSnapshot` projection must stay in
  sync with what outfit scoring actually reads. Mitigation: `toWeatherSnapshot`
  is a single pure function with tests; adding a field the engine needs is a
  one-line projection change, never an engine reach into the full forecast.

## 13. Future Extensions

- Additional providers (`WeatherAPI`, `Tomorrow.io`) behind the same interface;
  primary/fallback routing like the AI runtime.
- **Runtime Metrics (comment 5):** implement the `WeatherMetrics` sink — cache
  hit/miss ratio, provider used + fallback count, provider/end-to-end latency —
  surfaced in the Developer hub / a Playground "Weather" tab (in-memory, no DB).
- A Today "weather" widget and a `/settings` home-location picker.
- Read-only `/api/weather` debug endpoint.
- Air quality / pollen as additional normalized fields.
- Shared/edge cache if the app ever scales beyond single-user.

## 14. Open Questions

- **Home location:** env var, a value on the (future) profile, or derived from the
  browser? (Needed for non-trip recommendation weather.)
- **Cache TTL:** 1h default acceptable, or per-granularity (current vs daily)?
- **Capability dependency vs. context pre-fill:** should `recommendation` declare
  `weather` as an orchestrator dependency, or should the feature service always
  pre-fill `context.weather` before planning? (Both are viable; pick one for
  consistency.)
- **Manual provider trigger:** explicit `WEATHER_PROVIDER=manual`, or automatic
  fallback when live fetch fails?
