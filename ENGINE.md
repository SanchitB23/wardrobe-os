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

## Inventory Image Intelligence
**`src/domain/inventory-image-intelligence/`** → `analyzeInventoryImage`,
`mergeVisualIntoStyleDNAItem` (RFC-020).

Maps a Vision Engine `VisionAnalysis` (RFC-002) for an inventory primary image
into durable `VisualStyleAttributes` (pending until the owner Accepts). The
merge fills StyleDNA gaps only — manual colour / material / formality / tags
always win; confidence below 0.5 contributes nothing. Perception stays in
Vision; this module never reimplements detection. Surfaced on item detail +
`/developer/inventory-images`.

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

## RecommendationEngine v2
**`src/domain/recommendation/v2/`** → `recommendV2(context, options)` (RFC-012).

The current recommendation engine — a pure, deterministic, multi-objective
pipeline that supersedes the v1 `recommendUnifiedOutfits` (still exported as a
fallback). Stages: **Candidate Generation** (reuses the saved + generated
engines) → **Eligibility** (hard constraints, reject before scoring) →
**Scoring** (weighted sum over nine dimensions: base `OutfitAnalysis`, weather
suitability from the RFC-011 `WeatherSnapshot`, occasion, formality,
personal-preference fit from the RFC-004 profile, colour harmony, texture,
comfort/commute, wardrobe-health contribution — plus recency/over-rotation
penalties and a favourite boost) → **Diversity Rerank** (top-K not near-duplicate
by skeleton/palette/footwear) → **Trace**. Returns a `RecommendationResult`
(ranked `RecommendationV2[]` + per-run quality metrics + metadata). Every
recommendation carries a per-dimension score breakdown, boosts/penalties, reason
codes, the hard constraints it passed, a diversity decision, and a confidence.
Avoided/retired items and severe weather/occasion mismatches are **rejected**;
protected items are never penalised for underuse; weather influence scales with
snapshot confidence. Deterministic; **no AI ranking, no ML**. Runs against the
assembled `RecommendationContext`
([ADR-002](docs/adr/ADR-002-recommendation-context.md)); the Orchestrator's
`recommendation` capability, the Recommendation Center, the Today widget, and the
AI stylist tool all consume it.

The v1 **UnifiedRecommendationEngine**
(`src/domain/recommendation/UnifiedOutfitRecommendationEngine.ts` →
`recommendUnifiedOutfits`) remains as the temporary fallback contract.

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

## PersonalizationEngine v2
**`src/domain/personalization/v2/`** → `derivePreferenceProfileV2(input, options)`
(RFC-013).

Refines the v1 point-in-time profile by **re-running the pure v1 derivation over
rolling historical windows** — adding no new signal model. Per preference it
produces a **lifecycle** (`core` / `emerging` / `declining` / `avoided`), a
**timeline** (weight series + trend), sharper **stability** (cross-window spread +
persistence), and a **`since`** date; plus a `PreferenceEvolution` audit
(before → after / signal / reason / timestamp) and the net-negative **avoided
preferences**. `resolveExploreExploit(mode)` maps the owner's `explore` /
`balanced` / `exploit` setting to deterministic weight adjustments consumed by
Recommendation Engine v2 (re-weighting preference fit vs rotation and nudging
diversity — never bypassing hard constraints). Overrides still win. Deterministic
(same signals + overrides + mode + `generatedAt` + window ⇒ identical output); no
ML, no AI-derived preferences. Surfaced on the Taste Profile (`/settings/preferences`).

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

## Shopping Intelligence
**`src/domain/shopping/`** → `buildShoppingDashboard(...)` (RFC-018).

Ranks and aggregates a wishlist of Acquisition verdicts: Need × Impact × Buy
priority queue, wardrobe ROI, duplicate clusters, static top-N strategy, and
timeline. Never re-decides buy/skip — every verdict is a `BuyVsSkipAnalysis`.
Surfaced at `/acquisitions/intelligence`.

## Acquisitions Intelligence
**`src/domain/shopping/v2/`** → `buildAcquisitionsIntelligence(...)` (RFC-018B).

Continuous learning **over** Shopping Intelligence: Purchase Lifecycle,
Recommendation Accuracy (shallow + deep: bought → worn → ROI), Need Evolution,
ROI Evolution (timeline + category cohorts), OpportunityEngine (composes 018
priority with need + lifecycle urgency), and StrategyEvolution (dynamic rules,
distinct from 018's static top-N). Reuses 018 outputs; no duplicated Priority /
Buy vs Skip scoring. Hub panels + `/developer/acquisitions`. AI explains only.

## Acquisition-to-Inventory Pipeline
**`src/domain/shopping/AcquisitionPipeline.ts` + `AcquisitionTimeline`**
(RFC-018C) with **`src/features/shopping/services/acquisitionPipeline.service.ts`**.

Lifecycle handoffs only: Buy vs Skip result → wishlist (link
`wishlist_item_id`) → mark purchased (price/date intent) → confirmed inventory
conversion wizard → optional image attach → optional RFC-020 Visual StyleDNA.
Timeline stages: Wishlist → Analysis → Purchased → Inventory Created → First
Wear → ROI. Never auto-creates inventory; manual edits win; AI explains only.

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

## IntelligenceCenter
**`src/domain/intelligence/`** → `buildIntelligenceCenter(sources, options)`
(RFC-015).

Aggregates every deterministic engine's output (as normalized sources) into one
deduplicated, impact-ranked list of **typed actions** — `wear` / `buy` / `skip` /
`clean` / `rotate` / `pack` / `replace` / `explore` — the product's "what to do
next". Per source it maps the engine's conclusion to candidate actions
(`ActionGenerator`), scores a deterministic **impact** (provisional signal ×
source reliability × confidence, `ImpactScoring`), dedupes by (type, subject) and
ranks (`ActionRanking` / `PriorityEngine`), and returns `TopActions` with
priority, impact, confidence, reason + reason codes, and the source engine(s).
It **invents no verdict** — it aggregates + ranks what engines already decided;
AI only explains (ADR-005). Surfaced at `/intelligence`, as "Do this next" on the
Today home, and via the `getTopActions` stylist tool. Pure and deterministic.

**Category Optimization (RFC-015A)** — `src/domain/category-optimization/` →
`buildCategoryOptimization(context, options)`. Extends the Center's `replace`
actions into a guided Optimize Category workflow (`/intelligence/optimize`):
CategoryAnalysis, ItemComparison, OptimizationPlan (keep / protect / rotate /
retire / ignore), and ReplacementOpportunity stubs for Shopping Intelligence.
No destructive mutations; wishlist add is user-confirmed only.

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
