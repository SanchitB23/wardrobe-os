# Engines

The domain engines are the **source of truth** for Wardrobe OS. They live in
`src/domain/**`, are pure TypeScript (no React, Supabase, AI, or I/O), and are
deterministic — the same inputs always produce the same output, with any "now"
injected explicitly. Every engine is unit-tested with Vitest (`npm test`).

AI never participates in any of these computations; it only explains their
results ([ADR-005](docs/adr/ADR-005-ai-does-not-decide.md)).

---

## OutfitEngine
**`src/domain/outfit/outfit-engine.ts`** → `evaluateOutfit(...)` producing
`OutfitAnalysis`.

Rule-based scoring of a set of items across dimensions — colour, formality,
season, occasion, texture, and (when data allows) weather and footwear. Each
rule returns a 0–10 score, a confidence, and human-readable
reason/strengths/weaknesses/suggestions; the engine combines them into a
weighted `overallScore` and `confidence`. This is the scoring primitive the
generation and recommendation engines build on.

## StyleDNAEngine
**`src/domain/style-dna/StyleDNA.ts`** → derives a `StyleDNA` per item.

Turns sparse item metadata into a normalised style profile: colour (temperature,
lightness, contrast, boldness, neutrality), texture (family, fabric weight, care
complexity), weather suitability per season, occasion suitability, style
(formality/professionalism), and compatibility (versatility, travel/commute
friendliness, a `protected` flag for scuff-prone pieces). Every item is
analysable via safe fallbacks. Downstream engines consume Style DNA, not raw
fields. See [ADR-003](docs/adr/ADR-003-style-dna.md).

## WardrobeHealthEngine
**`src/domain/analytics/WardrobeHealthEngine.ts`** → `WardrobeHealth`.

Scores overall wardrobe health plus per-category, per-occasion, and per-season
sub-scores, and surfaces strengths, weaknesses, **gaps** (missing staples), and
**duplicates** (over-owned clusters). Calibrated to the owner's profile.

## UsageAnalyticsEngine
**`src/domain/analytics/UsageAnalyticsEngine.ts`** → `UsageAnalytics`.

From wear logs: total wears, most/least worn, never-worn and stale items,
recently worn, per-category and per-occasion usage, optional cost-per-wear
highlights, and text insights/recommendations.

## InsightEngine
**`src/domain/analytics/InsightEngine.ts`** → `generateInsights(context)` →
`InsightReport`.

Combines wardrobe health, usage, and purchase analytics into prioritised
insights (strength / weakness / opportunity / warning / action), an overall
summary, and top actions/warnings/strengths — the data behind the Insight Center.

## OutfitGenerationEngine
**`src/domain/generation/OutfitGenerationEngine.ts`** → `generateOutfits(...)`.

Assembles candidate outfits from the wardrobe (respecting slots, eligibility,
and Style DNA compatibility) and scores each with the OutfitEngine, returning
ranked `GeneratedOutfit`s. Deterministic and bounded for performance.

## UnifiedRecommendationEngine
**`src/domain/recommendation/UnifiedOutfitRecommendationEngine.ts`** →
`recommendUnifiedOutfits(context, options)`.

Merges **saved** outfits and freshly **generated** combinations into one ranked
list: normalises scores, dedupes, applies eligibility and favourite caps and
recent-wear penalties, and attaches per-recommendation debug (rejection reasons,
penalties, boosts). Runs against the assembled `RecommendationContext`
([ADR-002](docs/adr/ADR-002-recommendation-context.md)). RFC-004: outfits
containing an owner-**avoided** item are excluded.

---

## PersonalizationEngine
**`src/domain/personalization/PersonalizationEngine.ts`** →
`derivePreferenceProfile(input, options)` (RFC-004).

Derives a `UserPreferenceProfile` purely from the owner's own behaviour — wears,
outfits, purchases, favourites, feedback, edits, and acquisition decisions —
normalised into weighted `PreferenceSignal`s. Each derived preference carries a
**weight**, **confidence**, and **stability**, plus the owner's explicit
**protected** / **avoided** item ids and per-dimension **overrides**. Preferences
are **re-derived from scratch every run** (never incrementally mutated), so the
profile is a pure function of current behaviour + `generatedAt`. It supersedes the
static `DEFAULT_PREFERENCES` in the `RecommendationContext`; `toPreferenceSnapshot`
reshapes it for the recommendation/generation engines. Protected items are never
surfaced as removal candidates and avoided items are never recommended. The engine
derives; AI only explains ([ADR-005](docs/adr/ADR-005-ai-does-not-decide.md)).

---

## IntelligenceOrchestrator
**`src/domain/orchestrator/`** → `orchestrate(request, context, options)` (RFC-005).

A deterministic composition layer: resolves capability dependencies (topological
order + cycle detection), runs each capability's engine with failure isolation,
and returns an `ExecutionReport`. It composes engines only — no business logic,
never calls AI, and engines never call each other. See
[ENGINE_GRAPH.md](ENGINE_GRAPH.md).

## LifestyleEngine
**`src/domain/lifestyle/`** → `planLifestyle(input, options)` (RFC-006).

Plans a trip deterministically by composing the engines across a time horizon:
expands the trip into days, selects each day's outfit by requesting the
`recommendation` capability **through the orchestrator** (never directly),
derives a capsule, packing list, laundry schedule, and — via the `acquisition`
capability — shopping suggestions for missing items. Returns a `LifestylePlan`
(TripPlan / PackingPlan / LaundryPlan / ShoppingPlan + planScore +
packingConfidence + tradeoffs + warnings). Weather arrives as a normalized
`WeatherSnapshot` from the **Weather Runtime** (below).

---

## Weather Runtime
**`src/domain/weather/` (pure) + `src/runtime/weather/` (I/O)** (RFC-011).

The single deterministic weather source — **weather is data; the engines decide;
AI explains.** The pure domain half defines `WeatherForecast` (rich provider
output), the narrow engine-facing `WeatherSnapshot` (temperature, feels-like,
rain risk, humidity, wind, UV, season, deterministic enum `WeatherLabel`s,
confidence, source), `deriveWeatherLabels`, `forecastConfidence`, and
`seasonalFallbackSnapshot`. The runtime half (`WeatherRuntime`) selects a provider
(`OpenMeteo` / `Manual`, via `WEATHER_PROVIDER`), fetches, normalizes into a
`WeatherForecast`, projects a `WeatherSnapshot`, and caches (60-min TTL; key =
provider + location + date range) with `WeatherMetrics`. It **never throws** and
**never recommends**; `getForecast` returns `{ data, error }` and `getSnapshot`
returns a seasonal-fallback snapshot (`source = seasonal_fallback`) on failure.
The Recommendation context consumes the snapshot; the orchestrator exposes a
`weather` capability. Not a domain engine — a runtime sibling to the AI layer.

---

## AI Tool Router
**`src/ai/tools/`** — not a domain engine, but the bridge that lets the AI stylist
use the engines above **through services** rather than querying data.

- **ToolRegistry** — holds `AITool`s and emits Gemini/OpenAI tool declarations.
- **ToolExecutor** — validates model args against each tool's JSON schema, runs
  it, and returns a structured result (never throws to the model).
- **ToolRouter** — routes one or many tool calls (concurrent, isolated) and
  exposes the provider definitions.
- **Wardrobe tools** (`src/ai/tools/wardrobe`) — 8 tools
  (`getRecommendations`, `getWardrobeHealth`, `getUsageAnalytics`,
  `getInsights`, `getOutfit`, `getItem`, `searchInventory`, `getShoppingAdvice`)
  that call feature services, which call the engines/repositories.

Flow: `model → ToolRouter → ToolExecutor → AITool → service → repository →
Supabase`. See [ADR-007](docs/adr/ADR-007-ai-tool-calling.md).
