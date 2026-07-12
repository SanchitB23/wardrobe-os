# Changelog

All notable changes to Wardrobe OS are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.0] — 2026-07-12

**Wear Logs, Acquisitions Pipeline & Observability.** Ships ad-hoc wear events
with outfit promotion (RFC-023), the acquisition-to-inventory handoff and
Decision History polish (RFC-018C), category optimization (RFC-015A), structured
logging (RFC-022), and developer observability follow-ups. 640 unit tests green.

### Changed — RFC-018C Recent Decisions UI polish

Finishes Decision History presentation without changing Buy vs Skip scoring or
conversion guards.

- **Wishlist on cards:** show wishlist item name with deep link
  (`/acquisitions/wishlist?highlight=…`); View Wishlist / toasts use the same
  highlight; wishlist rows scroll + ring when highlighted.
- **Lifecycle:** DecisionCardModel joins hub ROI wears / cost-per-wear so cards
  reach First Wear and ROI; stepper wording Analyzed → Wishlist → Purchased →
  Inventory Created → First Wear → ROI.
- **Images:** snapshot `imagePreviewUrl` + screenshot durable preview upload for
  unlinked image-source decisions; image placeholder when no URL yet.
- **Badges:** shared Buy / Consider / Skip styling (`DecisionVerdictBadge`).
- **Details:** human-readable analysis summary; raw JSON under Developer
  disclosure.
- **Convert:** never silently mark purchased — Mark Purchased dialog (then
  wizard) or wizard when already purchased.
- **Visual polish:** spacing, icons, hover, empty state CTAs.
- Tests for card model, lifecycle labels, and wishlist navigation helpers.

### Changed — Developer Observability audit follow-up

Closes remaining gaps from the Developer Observability audit without rewriting
the Logging Runtime.

- **Production AI → AIRuntime:** recommendation / lifestyle / buy-vs-skip
  explanations, playground, and `/api/ai/test` call `getServerAIRuntime().run()`.
  Vision + chat record into shared `aiRuntimeMetrics` so the dashboard reflects
  real traffic.
- **Metrics:** fallback counts, cache savings, per-model buckets; cost dashboard
  shows MTD spend, budget remaining, savings.
- **Weather:** structured `weather_request` logs (requestId, provider, latency,
  cache, errors).
- **Proxy:** access guard emits structured `api_request` lines when enabled.
- **Developer hub:** Request Trace, Execution Graph, Feature Flags, Runtime
  Statistics, Request Replay (`REPLAY_CAPTURE`, process-local only).
- Tests for fallback/savings metrics, weather logs, replay store, feature flags,
  requestId helpers.

### Added — Ad-hoc Wear Logs & Outfit Promotion (RFC-023)

Separates historical wear events from curated Saved Outfits. Users can log what
they wore from inventory / recommendations without creating an outfit; repeated
ad-hoc combinations can be promoted to a saved outfit with explicit confirmation.

- **Domain** (`src/domain/wear-logs`): combination fingerprint, promote threshold
  (default 3, ≥2 items), outfit draft mapping.
- **Persistence:** additive `wear_events` + `wear_event_items` + `wear_log_source`
  enum; legacy `wear_logs` kept and dual-written for analytics continuity.
  Migration `docs/migrations/RFC-023-ad-hoc-wear-logs.sql`.
- **Service:** event create (ad-hoc / outfit / recommendation), promote to outfit
  (name + favorite + tags-in-notes), list/detail/edit/delete.
- **UI:** `/wear-logs` event cards; `/wear-logs/new` Quick Log (Top/Bottom/
  Footwear/Accessories); `/wear-logs/[id]` detail + Save as Outfit; inventory
  multi-select → Log Wear; recommendation + saved-outfit wear paths updated.
- **Developer:** `/developer/wear-logs` — source counts, combo frequency,
  promotion candidates.
- **RFC-023** marked Implemented.

### Added — Acquisition-to-Inventory Pipeline (RFC-018C)

Connects Buy/Skip → wishlist → purchased → confirmed inventory → image →
optional Visual StyleDNA. Handoffs only — does not rewrite BuyVsSkipEngine,
Wishlist ranking, or Inventory CRUD. Never auto-creates inventory.

- **Domain** (`AcquisitionPipeline`, extended `AcquisitionTimeline`): prefill
  draft, conversion guard, decision card actions/lifecycle; timeline stages
  Wishlist → Analysis → Purchased → Inventory Created → First Wear → ROI.
- **Persistence:** additive `wishlist_items` columns (`inventory_item_id`,
  `purchase_price`, `purchase_date`, `image_storage_path`); migration
  `docs/migrations/RFC-018C-acquisition-to-inventory-pipeline.sql`. Links
  `acquisition_decisions.wishlist_item_id` and `purchased_id` in app code.
- **Service** (`acquisitionPipeline.service`): add-to-wishlist, mark purchased,
  convert-with-confirm, image carry-forward (storage copy when possible).
- **UI:** BuyVsSkipResult CTAs; screenshot `inputSource: "image"`; conversion
  wizard `/acquisitions/convert/[wishlistId]`; polished Decision History cards;
  wishlist purchase dialog + convert actions.
- **RFC-018C** marked Implemented.

### Added — Category Optimization (RFC-015A)

Guided wardrobe category optimization from Intelligence Center **Optimize**
(typed `replace`) cards. Plans keep / protect / rotate / retire / ignore —
never auto-retires or deletes. Shopping opportunities are draft-only until the
user confirms wishlist add; Buy vs Skip remains the purchase decider.

- **Domain** (`src/domain/category-optimization`, pure):
  `buildCategoryOptimization` → CategoryAnalysis, ItemComparison[],
  OptimizationPlan, ReplacementOpportunity[].
- **Feature** (`src/features/category-optimization`): service, hooks, workflow UI.
- **Route:** `/intelligence/optimize?category=…&focus=…`
- **Intelligence Center:** Replace cards deep-link to Optimize; UI label shows
  “optimize” while `ActionType` stays `replace` for compatibility.
- **Shopping handoff:** `proposeWishlistFromOpportunity` (draft) + confirm via
  existing wishlist save path.

### Added — Logging & Observability Runtime (RFC-022)

Production-grade structured JSON logging for Vercel + AI observability. Observes
only — does not change routing, scoring, or domain decisions.

- **Runtime** (`src/runtime/logging/`): structured logger, request correlation
  (`x-request-id` / AsyncLocalStorage), redaction, `AIUsageLogger`,
  `withApiLogging`, orchestrator `engine_trace`, in-memory ring buffer.
- **Wiring:** all `app/api/**` routes; `AIRuntime` + legacy `AIService` + chat /
  vision edges; orchestrator service boundary (`LOG_ENGINE_TRACES`).
- **Developer:** `/developer/observability` (process-local recent lines).
- **Docs:** `docs/operations/VERCEL_LOGGING.md`; env flags in `.env.example`.
- **RFC-022** marked Implemented.

## [2.0.1] — 2026-07-12

**Inventory Image Intelligence (RFC-020).** Connects owned-item primary photos to
StyleDNA / RecommendationContext via user-confirmed visual attributes. Vision
proposes; Accept/Reject is manual; engines still decide (ADR-005). Reuses the
existing Vision Engine — no duplicated perception stack. 566 unit tests green.

### Added — Inventory Image Intelligence (RFC-020)

- **Domain** (`src/domain/inventory-image-intelligence`, pure):
  `analyzeInventoryImage`, `mergeVisualIntoStyleDNAItem`, `visualManualDiff`,
  `VisualStyleAttributes` + confidence threshold (0.5).
- **Persistence:** `item_visual_attributes` table (additive migration
  `docs/migrations/RFC-020-inventory-image-intelligence.sql`); repository +
  service; primary image change marks attrs `stale`.
- **UI:** Visual Analysis card on item detail (Analyze / Accept / Reject);
  Developer backfill at `/developer/inventory-images`.
- **Recommendations:** accepted visuals merge into StyleDNA before scoring
  (manual non-null fields always win).
- **Types:** `types/database.ts` includes `item_visual_attributes`.
- **Tests:** +7 Vitest cases (566 total).

## [2.0.0] — 2026-07-12

**Vision and Acquisitions Intelligence.** Lifestyle Intelligence Platform core:
Trip Planner (RFC-017), Shopping Intelligence (RFC-018), Acquisitions product
hub, Acquisitions Intelligence (RFC-018B), Vision Intelligence v2 (RFC-019), plus
the post-v1.1 AI Runtime cost layer (RFC-014A / RFC-014B). Engines decide; AI
explains (ADR-005). 559 unit tests green.

### Added — Acquisitions Intelligence (RFC-018B)

Continuous learning **on top of** Shopping Intelligence (RFC-018) — no engine
replacement. Acquisition still decides; 018 still ranks; 018B learns from
outcomes.

- **Domain** (`src/domain/shopping/v2`, pure): PurchaseLifecycleEngine,
  RecommendationAccuracyEngine (shallow + deep), NeedEvolution, ROIEvolution,
  OpportunityEngine (60% 018 priority + 20% need + 20% lifecycle urgency),
  StrategyEvolution (dynamic rules, distinct from 018 static top-N), composer
  `buildAcquisitionsIntelligence`.
- **Service:** `getAcquisitionsHub` now returns `intelligence` + optional 018
  dashboard snapshot; purchase records include category + purchase_date.
- **UI:** Hub Opportunity Queue + Strategy (learned); timeline lifecycle;
  history deep accuracy; ROI evolution; wishlist Opp badges + need panel;
  Developer `/developer/acquisitions`.
- **Tests:** +10 Vitest cases (559 total).

### Added — Vision Intelligence v2 (RFC-019)

Practical Vision workflows over the existing Vision Engine (RFC-002) — **no
duplicated perception stack**. Vision detects; the user confirms; nothing is
auto-added or auto-logged.

- **Domain** (`src/domain/vision-intelligence`, pure): visual attribute
  similarity, ClosetScanner, OutfitRecognition, DuplicateVision, ReviewQueue.
- **Feature** (`src/features/vision`): scan service (reuses `/api/ai/vision`),
  session-local review queue, hub / scan / review UI, Developer Vision Debug.
- **Routes:** `/vision`, `/vision/scan`, `/vision/review`, `/developer/vision`.
- **Nav:** Wardrobe → Vision; Developer → Vision Debug.
- Laundry / stain / OCR / auto-logging remain non-goals.

### Added — Acquisitions product experience (pre-intelligence shell)

Renames the **Shopping** product surface to **Acquisitions** and ships the
flagship hub UX without new Shopping Intelligence. Buy vs Skip (engine +
advisor/screenshot UI) is unchanged aside from a silent Decision History write.

- **Routes:** `/acquisitions` landing (KPIs + cards), `/wishlist`, `/decisions`,
  `/timeline`, `/roi`, `/history`, `/quick-analyze` → advisor, and secondary
  `/acquisitions/intelligence` (existing RFC-018 tabs). `/shopping` redirects to
  `/acquisitions`. Nav label: Acquisitions.
- **Wishlist CRUD:** notes, user priority (`low|medium|high`), status — no
  Need/Impact/Buy scoring on the product pages.
- **Decision History:** new `acquisition_decisions` table; analyses snapshot
  after `analyzeBuyVsSkip` (best-effort). List with filters + search.
- **Timeline / ROI / Shopping History:** lifecycle stages, dedicated ROI page,
  purchased + realized CPW + recommendation accuracy helper.
- **Schema (applied 2026-07-12 to Wardrobe `xleqmmpxlpuawzsnaftz`):**
  `docs/migrations/RFC-018-shopping-intelligence.sql` then
  `docs/migrations/acquisitions-product-experience.sql` (wishlist `priority` +
  `acquisition_decisions`).
- Shopping Intelligence engines untouched; intelligence UI moved to the
  secondary route.

### Changed — Cost-Aware AI Runtime decision layer (RFC-014B)

Refactors the AI Runtime's **decision-making** into named, testable modules —
no provider implementations changed, no deterministic engines touched. The
routing behaviour (Gemini-first; OpenAI for structured/classification; budget
hard-stop → Gemini) is unchanged; it's now owned by a clean resolver stack.

- **`RuntimePolicyResolver`** (`src/runtime/ai`) — the single place that turns a
  _capability_ into a full routing decision (provider policy + per-provider model
  - availability). The resolver **decides**; `ProviderRouter` **executes**.
    `AIRuntime.run` now delegates to it instead of inlining the logic.
- Composed from focused modules: **`CapabilityPolicy`** (capability → provider
  policy), **`ModelPolicy`** (capability × provider → model), **`ProviderPreferenceResolver`**
  (ordered primary → fallback with availability + `activeProvider`),
  **`RuntimeCostEstimator`** (per-call + month-to-date estimated cost), and
  **`RuntimeBudgetMonitor`** (wraps the budget guard; gates only OpenAI).
- **Dashboard** (`/developer/ai-runtime`) now renders `resolver.describe(capability)`:
  capability → provider → **model** → fallback → **active-provider** (flagged when
  the budget hard-stop degrades to the fallback), alongside the budget card and
  metrics. Model / selected-provider / selected-model / budget all visible.
- No OpenAI billing APIs; deterministic engines untouched. 531 unit tests green
  (+10 for the resolver stack). **RFC-014B implemented.**

### Added — OpenAI provider + cost-aware AI Runtime policy (RFC-014A)

Wires a **real OpenAI provider** into the AI Runtime v2 (RFC-014) and makes the
runtime **cost-first** (this is a single-user personal project with a $5 OpenAI
budget). Gemini stays the default; OpenAI is used selectively.

- **Provider** (`src/ai/providers/openai-provider.ts`): real `generate()` on the
  official `openai` SDK (chat completions), lazy + injectable client. Server-side
  key only; missing `OPENAI_API_KEY` ⇒ provider unavailable ⇒ non-retryable error
  ⇒ router falls straight through to Gemini (no crash). Errors normalized to
  `ProviderError`; one transient retry. Capabilities: generate + structured
  output; no vision/image-gen/embeddings.
- **Cost-first provider policy (`DEFAULT_POLICIES`):** Gemini primary for
  conversation / explanation / summarization / vision; **OpenAI** primary (Gemini
  fallback) only for the new **structured** + **classification** capabilities.
  `GEMINI_ONLY_POLICIES` kept for zero-spend rollback. Override via
  `AI_POLICY_<CAPABILITY>=primary,fallback`.
- **Model policy layer** (`ModelPolicy.ts`): capability → provider → **model**,
  resolved separately from the provider policy. Classification → gpt-5.4-nano,
  structured/text → gpt-5.4-mini. `GPT-5.5` is defined as premium but **never a
  default**. Models are read from env, never hard-coded in feature code.
- **OpenAI budget guard** (`BudgetGuard.ts`): tracks estimated month-to-date
  OpenAI spend (tokens × price table; best-effort, process-local). At the hard
  stop OpenAI is marked unavailable and routing falls back to Gemini — **Gemini is
  never blocked**. Env: `OPENAI_MONTHLY_BUDGET_USD` / `OPENAI_SOFT_ALERT_USD` /
  `OPENAI_HARD_STOP_USD` (default 5 / 2 / 5).
- **Dashboard** (`/developer/ai-runtime`): capability → provider → model (+ fallback)
  table, an OpenAI budget card (est. spend, thresholds, available/unavailable), and
  the per-capability metrics (latency / cache / tokens / est. cost).
- **New capabilities** `structured` + `classification` added to the runtime enum.
- **Tests:** provider contract (mapping, structured/nano model selection, error
  normalization, transient retry, missing-key unavailability), model-policy +
  provider-policy resolution, Gemini-default for conversation/explanation, OpenAI
  for structured/classification, **budget hard stop → Gemini fallback**, and
  metrics recording — all with a **mocked** OpenAI client (no real calls).
- Installed the `openai` SDK; updated `.env.example`, README, `src/ai/README.md`,
  ARCHITECTURE, PRODUCT_VISION, ENGINE_GRAPH. **RFC-014A complete.** 521 unit tests
  green.

### Added — Shopping Intelligence (RFC-018)

Turns the single-purchase evaluator (RFC-001) into a continuous shopping system:
a persisted wishlist, a deterministic priority queue, wardrobe ROI, duplicate
intelligence, a shopping timeline, and a strategy. **Acquisition decides each
item; Shopping Intelligence ranks + aggregates; AI explains** (ADR-005) — no
buy/skip verdict is re-computed here.

- **Domain** (`src/domain/shopping`, pure, 10 Vitest cases): `PriorityEngine`
  (`computeNeedScore` from wardrobe gaps, `priorityScore` blending Need × Impact ×
  Buy, `rankWishlist`), `ROIEngine` (`computeShoppingROI` — realized + projected
  cost-per-wear, utilization signal; reuses `@/domain/wardrobe` money helpers),
  `DuplicateEngine` (`analyzeDuplicates` — reuses acquisition `similarExistingItems`
  for wishlist↔wardrobe + a field overlap for wishlist↔wishlist), `WishlistEngine`,
  `ShoppingInsights`, and `ShoppingEngine` (`buildShoppingDashboard` composer).
- **Reuse, no duplication:** the Acquisition service was refactored to split
  `loadAcquisitionContext()` (one shared snapshot) from `evaluateWithContext()`;
  Shopping Intelligence loads the context once and runs Buy vs Skip per active
  wishlist item — Recommendation + Personalization flow through it as before.
- **Feature** (`src/features/shopping`): `wishlist_items` repository, a service
  producing the `ShoppingDashboard`, TanStack Query hooks, and a tabbed
  `/shopping` view (Priority · Wishlist · ROI · History · Duplicates · Strategy),
  with a "From screenshot" hook into the RFC-003 Vision capture flow. Nav gains a
  **Shopping** entry under Stylist.
- **Outputs:** `ShoppingDashboard`, `ShoppingRecommendation`, `ShoppingPriority`,
  `ShoppingROI`, `DuplicateAnalysis`, `WishlistInsights`.
- **Schema (documented, not applied):** additive `wishlist_items` table + anon RLS
  — [`docs/migrations/RFC-018-shopping-intelligence.sql`](docs/migrations/RFC-018-shopping-intelligence.sql).
  The derived dashboard is never stored (recomputed on demand). 499 unit tests
  green (10 new for `src/domain/shopping`).

### Added — Trip Planner (RFC-017)

The first **v2.0** feature. Promotes the one-shot trip _wizard_ into a
first-class, persisted, reusable **Trip Planner**. Trip is _data_; the Lifestyle
Engine (RFC-006) still derives the plan — no planning logic is duplicated
(engines decide, AI explains; ADR-005).

- **Domain** (`src/domain/trips`, pure): trip templates (`expandTemplate`),
  cloning (`cloneTripSpec`), multi-city day resolution (`cityForDate`), the
  packing-checklist projection (`buildPackingChecklist`), and the timeline /
  outfit-calendar projection (`buildTimeline`). Deterministic; no I/O, no scoring.
- **Feature** (`src/features/trips`): repository (Supabase CRUD over the new
  tables), a service that reuses `planTrip` (Lifestyle Engine → Recommendation /
  Acquisition through the Orchestrator) and merges per-leg forecasts for
  multi-city trips via the Weather Runtime (RFC-011), TanStack Query hooks, and
  the views.
- **Features:** Trip CRUD, Trip Templates (weekend city / week beach /
  business 3-day), Trip History (upcoming + past, clone), multi-city itineraries,
  an interactive **Packing Checklist** with persisted **progress** (`N / M`), a
  **Timeline / outfit calendar**, **Weather Refresh** (re-plan), and
  trip-anchored **Shopping / Missing Items** from the plan.
- **Surfaces:** `/trips` (list), `/trips/new`, `/trips/templates`, `/trips/[id]`
  (plan: timeline · packing · laundry · shopping, + AI explanation), and
  `/trips/[id]/edit`. The Lifestyle nav item is now **Trips** (→ `/trips`); the
  Today "Plan a trip" quick action and the Intelligence Center trip actions point
  here too. The old `/lifestyle/trip` wizard route remains for now.
- **Schema (documented, not applied):** additive `trips`, `trip_cities`,
  `trip_events`, `trip_packing_progress` tables with anon RLS —
  [`docs/migrations/RFC-017-trip-planner.sql`](docs/migrations/RFC-017-trip-planner.sql).
  The derived `LifestylePlan` is never stored (recomputed on demand); only trip
  inputs + packing progress persist. 489 unit tests green (9 new for
  `src/domain/trips`).

## [1.1.0] — 2026-07-10

**Intelligence Refinement + Runtime.** Sharpens the deterministic engine stack
and turns the AI layer into a runtime — engines decide, AI explains (ADR-005).
Five RFCs (011–015): the Weather Runtime, Recommendation Engine v2,
Personalization Engine v2, AI Runtime v2, and the Intelligence Center. No schema
changes; 480 unit tests green.

### Added — Intelligence Center (RFC-015)

Lead with **prioritised actions**, not analytics. One Intelligence Center
aggregates every deterministic engine into a single, deduplicated, impact-ranked
list of typed actions — **what to do next**. Engines decide the actions; the
Center ranks; AI explains (ADR-005). No new verdicts, no schema changes.

- **Domain** (`src/domain/intelligence`, pure): `buildIntelligenceCenter(sources)`
  → generate (per-source mappers over normalized inputs) → dedupe by
  (type, subject) → impact score → rank → `TopActions`. Modules: `ActionTypes`,
  `ActionGenerator`, `ImpactScoring`, `ActionRanking`, `PriorityEngine`,
  `IntelligenceCenter`.
- **Typed actions:** `wear`, `buy`, `skip`, `clean`, `rotate`, `pack`,
  `replace`, `explore` — mapped from recommendation, health, usage, acquisition,
  personalization, lifestyle, weather, and vision. Each card carries priority,
  **impact** (0–1, drives ranking), confidence, reason + reason codes, and its
  source engine(s).
- **Impact** = provisional signal × source reliability × confidence; priority
  buckets from impact; deterministic ranking + dedup.
- **Surfaces:** an Intelligence Center at `/intelligence` (with a Developer debug
  view showing source, impact calculation, and priority per card), a "Do this
  next" lead section on the Today home, and a `getTopActions` AI stylist tool.
  Existing analytics surfaces remain as supporting detail.
- Live sources today: recommendation (Wear), health (Buy/Replace), usage
  (Rotate); acquisition/lifestyle/weather/vision are contextual and feed in as
  their context is present (the domain supports all eight). Deterministic; **no
  schema changes**. 480 tests green (+17).

### Added — AI Runtime v2 (RFC-014)

Evolve the AI layer into a **capability-centric runtime**: callers request a
_capability_, declarative **provider policies** choose the provider (primary →
fallback), and the runtime benchmarks, versions prompts, and records latency /
cost / token metrics. It **routes and measures; it never decides** (ADR-005).
Additive — no AI feature, recommendation, or business-logic changes.

- **Runtime** (`src/runtime/ai`, wraps `src/ai`): `AIRuntime.run({ capability })`
  resolves a `ProviderPolicy`, routes via `ProviderRouter` (primary → fallback +
  retry), validates structured output, reads/writes the AI cache, and records
  metrics. Modules: `CapabilityRouter`, `ProviderPolicy`, `ProviderRouter`,
  `PromptRegistry` + `PromptVersion` (versioning + deterministic experiments),
  `CostTracker`, `LatencyTracker`, `RuntimeMetrics`, `ProviderBenchmark`.
- **Capabilities:** explanation, vision, image generation, conversation,
  summarization, and a reserved embeddings slot. Vision routes to `vision()`,
  the rest to `generate()`.
- **Policies:** capability → `{ primary, fallback }`, overridable via
  `AI_POLICY_<CAPABILITY>=primary,fallback`. Default keeps Gemini primary
  everywhere (the only fully-wired provider); `TARGET_POLICIES` documents the
  PRODUCT_VISION target (Text → OpenAI/Gemini, Vision → Gemini/OpenAI). Gemini,
  OpenAI, and Claude providers are all registered so fallback works the moment
  OpenAI/Claude become real.
- **Metrics + dashboard:** latency, cost (from a price table), tokens, cache-hit,
  and failure per capability × provider × prompt version; surfaced at
  `/developer/ai-runtime` (Developer Mode), with provider policies and a metrics
  table.
- Deterministic routing (same request + policy ⇒ same decision); prompt
  experiments bucket deterministically by a stable key. **No schema changes**
  (reuses `ai_cache`; metrics in-memory). 463 tests green (+16). Existing AI
  features keep using `getServerAIService()` unchanged.

### Added — Personalization Engine v2 (RFC-013)

Refine the deterministic preference profile with **lifecycle, timeline,
evolution, sharper stability, and an explore/exploit control** — promoting the
RFC-004 reserved shapes from _declared_ to _produced_. Behaviour is the source of
truth; the engine derives; AI only explains. **No ML, no AI-derived preferences,
no chat memory.**

- **Domain** (`src/domain/personalization/v2`, pure) — `derivePreferenceProfileV2`
  re-runs the pure v1 derivation over rolling historical windows to compute, per
  preference, a **lifecycle** (`core` / `emerging` / `declining` / `avoided`), a
  **timeline** (weight series + trend), sharper **stability** (cross-window spread
  - persistence), and a **`since`** date; plus a **`PreferenceEvolution`** audit
    (before → after / signal / reason / timestamp) and the net-negative **avoided
    preferences**. Overrides still win (a pin keeps its stability and source).
- **Explore/exploit** — `resolveExploreExploit(mode)` maps `explore` / `balanced`
  / `exploit` to deterministic weight adjustments; the default is `balanced`.
- **Recommendation integration** — `RecommendationContext.personalization` carries
  the mode weights, per-value lifecycle, and avoided values; Recommendation Engine
  v2 (RFC-012) re-weights preference fit + rotation and nudges diversity
  accordingly, penalises owner-avoided values, and applies small core/declining
  lifecycle nudges (anti-overfitting) — hard constraints and diversity are never
  bypassed. `balanced` reproduces the prior v2 ranking exactly.
- **Taste Profile UI** (`/settings/preferences`) — lifecycle badges, a "Taste over
  time" timeline with trend arrows, confidence/stability + `since`, an
  explore/exploit selector (persisted), and a Debug preference-evolution section.
- Deterministic (same signals + overrides + mode + `generatedAt` + window ⇒
  identical output). **No schema changes** (timelines/evolution re-derived; the
  explore/exploit mode is a localStorage setting). 447 tests green (+21).

### Changed — Recommendation Engine v2 (RFC-012)

Replace the v1 two-term unified ranking with a **multi-objective, weather- and
personalization-aware, diversity-ranked, fully explainable** recommendation
pipeline. Same philosophy — **engines decide, AI explains** — better quality. No
AI ranking, no ML, no schema changes.

- **Pipeline** (`src/domain/recommendation/v2`, pure) — Candidate Generation
  (reuses the existing saved + generated engines) → Eligibility (hard
  constraints) → Scoring (weighted multi-objective) → Diversity Rerank → Trace →
  `RecommendationResult`.
- **Scoring** — a weighted sum over nine named dimensions (base `OutfitAnalysis`,
  weather suitability from the RFC-011 `WeatherSnapshot`, occasion, formality,
  personal-preference fit from the RFC-004 profile, colour harmony, texture,
  comfort/commute, wardrobe-health contribution) plus recency / over-rotation
  penalties and a favourite boost. Weather influence scales with snapshot
  confidence (a seasonal-fallback snapshot moves the ranking less).
- **Hard constraints** (reject before scoring) — avoided items, retired items,
  severe weather mismatch (only when weather is confident enough), occasion
  mismatch, missing required slots, invalid formality combinations. Mild
  mismatches are penalties, not rejections, so the engine degrades gracefully.
- **Protected items** are exempt from recency / over-rotation penalties (never
  penalised for underuse).
- **Diversity** — the top-K avoid repeating the same skeleton, dominant colour
  palette, or footwear; the threshold relaxes for thin wardrobes so a full list
  is still returned.
- **Explainability** — every recommendation carries a per-dimension score
  breakdown, applied boosts/penalties, machine-readable reason codes, the hard
  constraints it passed, a diversity decision, and a confidence.
- **Quality metrics** — per run: eligible/rejected counts, diversity score,
  average confidence, saved-vs-generated mix, and weather/personalization
  **influence** (a deterministic zeroed-weight counterfactual).
- **Integration** — the Recommendation Center, the Today outfit widget, the AI
  stylist `getRecommendations` tool, and the Orchestrator `recommendation`
  capability all use v2; the v1 unified engine remains exported as a temporary
  fallback. Developer Mode on the Recommendation Center surfaces the quality
  metrics, rejection reasons, per-card diversity, reason codes, and top
  dimensions. Deterministic; 426 tests green (+12).

### Added — Weather Runtime (RFC-011)

Promote weather to a **provider-agnostic runtime** — the single deterministic
weather source. Core principle: **weather is data; the engines decide; AI
explains.** The Weather Runtime never performs recommendation, the Recommendation
Engine never fetches weather, and AI never generates weather.

- **Domain** (`src/domain/weather`, pure) — `WeatherForecast` (rich, provider
  output), `WeatherSnapshot` (the narrow, engine-facing projection recommendation
  consumes), deterministic enum-style `WeatherLabel`s (`HOT`, `WARM`, `MILD`,
  `COOL`, `COLD`, `RAINY`, `HUMID`, `WINDY`, `SUNNY`, `LAYER_REQUIRED`,
  `LIGHTWEIGHT`, `WATERPROOF`, `FORMAL_SAFE`, `SNEAKER_SAFE`), forecast
  confidence, and `seasonalFallbackSnapshot()`.
- **Runtime** (`src/runtime/weather`, I/O) — `WeatherRuntime` selects a provider
  (`WEATHER_PROVIDER`, default `open-meteo`), fetches, normalizes, projects a
  `WeatherSnapshot`, and caches. It **never throws** — `{ data, error }` on
  forecast; a seasonal-fallback snapshot on `getSnapshot` failure. Providers:
  `OpenMeteoProvider`, `ManualWeatherProvider`, plus `WeatherApi`/`Tomorrow`
  stubs. In-memory cache (60-min TTL, key = provider + location + date range)
  with `WeatherMetrics` (cache hit/miss, provider, latency, provider errors).
- **Integration** — the Intelligence Orchestrator registers `weather` as a
  first-class capability (recommendation & outfit depend on it; failure is
  isolated so recommendation still runs on the fallback snapshot). The
  recommendation builder consumes a `WeatherSnapshot`; when live weather is
  unavailable it falls back to seasonal defaults marked
  `source = seasonal_fallback` (which the AI explains, never hallucinates).
- **Developer Mode** — a Weather Runtime page (`/developer/weather`) surfacing the
  current provider, TTL, cache hit/miss & latency metrics, and the live
  `WeatherSnapshot`.
- The previous partial `src/features/weather` provider is relocated into the
  runtime. Additive; **no schema changes**. 414 tests green (+14).

## [1.0.2] — 2026-07-09

### Added — Application Access Guard (RFC-010)

Gate the entire application behind a **single shared access code**. This is
**application-level access control, not authentication** — no users, no database,
no auth provider, no Supabase Auth, no JWT.

- **Proxy** (`proxy.ts` — Next.js 16's renamed middleware) verifies an HMAC-signed
  cookie on every request. Valid ⇒ allow; otherwise pages redirect to `/unlock`
  and API routes return `401`. Protects all pages, `/api/*`, Developer pages, and
  AI routes; static assets (`_next`, favicon, public files) and `/unlock` +
  `/api/access/*` are excluded.
- **Unlock** (`/unlock`) — a minimal code entry; `POST /api/access/unlock`
  constant-time compares to `APP_ACCESS_CODE` and issues the cookie.
- **Cookie** `wos_access` — **HttpOnly · Secure (prod) · SameSite=Lax ·
  HMAC-SHA256 signed** (Web Crypto), carrying only an expiry. **30-day** session.
  No `localStorage`/`sessionStorage`.
- **Logout** — Settings → Access → "Lock app" clears the cookie
  (`POST /api/access/logout`) and returns to `/unlock`.
- **Config** — `APP_ACCESS_CODE` + `APP_COOKIE_SECRET` (server-only). Guard is
  **disabled when `APP_ACCESS_CODE` is blank** (local dev) and **fails closed**
  if the code is set without a secret. See [SECURITY.md](SECURITY.md).

No schema changes. Verified end-to-end (page redirect, API 401, static assets
pass, HttpOnly cookie, unlock/logout). 400 tests green; lint at baseline; build
passes.

## [1.0.1] — 2026-07-09

Stabilization release (RFC-009) — **quality only, no new features**. Pays down
the highest-value deferred audit debt across performance, accessibility,
developer experience, and resilience.

### Performance

- **CommandPalette no longer taxes every route (H11):** it is lazy-loaded
  (`next/dynamic`, `ssr:false`) and its wardrobe query is gated on open — the
  Supabase client and a full wardrobe fetch are no longer pulled into the shared
  First-Load JS or fired on pages like `/about`, `/settings`, `/developer`.
- **Bulk JSON import (M5):** items now sync with bounded concurrency instead of
  fully sequentially, cutting wall-clock on large imports (per-item logic
  unchanged).

### Accessibility

- **Labeled form controls (H10):** the shared `Field` helpers (Lifestyle wizard,
  Playground) associate their label with the control, and all Inventory filter /
  sort selects expose an accessible name.
- **Chat is no longer silent to screen readers (M1):** the message log is a
  `role="log"` `aria-live` region and the composer has an accessible name.
- **Headings + landmarks (M2, N7):** `CardTitle` renders a real `<h2>`; added a
  "Skip to main content" link and `id="main"`; labeled the developer tool links
  (with an "opens in a new tab" cue) and the previously-unlabeled progress bars.
- **Contrast (carried from v1.0.0):** focus-ring / muted-text / form-border
  tokens meet WCAG AA in light and dark.

### Developer Experience

- **Single-source version (N10):** the About page reads the version from
  `package.json` instead of a hardcoded string.
- **Modern TS target (N2a):** `tsconfig` `target` bumped ES2017 → ES2022.
- **Docs (N9):** documented the "push branch + tag" release step in CLAUDE.md.

### Resilience

- **Chat retries transient failures (H5):** the opening turn retries once on a
  429/503/timeout instead of surfacing a raw error.
- **Vision retries transient failures (N17a):** `GeminiVisionProvider.analyze`
  now retries once, mirroring the text provider.
- **Safer API surface (M6, M7):** the chat and vision routes cap request size
  (message count/length; image ≤ ~8 MB + JPEG/PNG/WebP allow-list) and return
  generic client-facing errors while logging detail server-side.

### Deferred to v1.0.2

- **next/image migration (M4)** — needs verification of signed-URL/next-image
  cache interaction; kept out of a stabilization patch.
- **`server-only` guards (N8)** — runtime guards already exist; adds a dependency.
- **Architecture-group items** (H8, M10, M16, M9, N11) — out of the stated
  Perf/A11y/DX/Resilience focus and would touch layering.

## [1.0.0] — 2026-07-08

The v1.0 release: an assistant-style **Today** home, the deterministic
**Intelligence Orchestrator** and **Lifestyle Engine**, the **Personalization
Engine**, and the RFC-008 release-candidate hardening pass. AI explains; the
engines decide.

### RFC-008 — Release-candidate hardening (audit remediation)

- **Data integrity (RLS):** added the missing anon `DELETE` policies on the six
  item-relation junction tables and `SELECT`/`DELETE` on `care_profiles` — item
  edits no longer silently accumulate stale relations, and care info now saves
  and displays correctly (`docs/migrations/RFC-008-rls-policies.sql`).
- **Personalization now bites (RFC-004):** owner-**avoided** items are excluded
  from recommendations, and **protected** items are never flagged for removal —
  plumbed through `RecommendationContext` and consumed by the unified recommender
  and the Insight Engine.
- **Determinism:** engine live paths take a single injected `generatedAt`; the
  Lifestyle Engine no longer falls back to wall-clock time.
- **Correctness:** Buy-vs-Skip now matches single-word **category** gaps; occasion
  resolution (incl. `brunch`) is a single shared module used by every engine.
- **Accessibility:** WCAG-AA contrast for focus rings, muted text, and form-field
  borders in light and dark.
- **Types/tests:** `tsc --noEmit` is clean (including test files); 394 unit tests
  green. RFC-004 marked Implemented; ENGINE.md documents the Personalization
  Engine; added a LICENSE (MIT).

### Today Experience, Intelligence Orchestrator & Lifestyle Engine

- **Today Experience & v1.0 Product Polish (RFC-007)** — the cohesion pass that
  makes the existing engines feel like one daily assistant. **No new engines,
  no new AI.**
  - **Today** is now the default route (`/`) — an assistant-style home that
    _composes_ existing deterministic outputs into widgets: Today's Outfit
    (top recommendation), Today's Insight, Ask Stylist (deep-links into `/chat`
    via `?q=`), Shopping Suggestions (health gaps), Wardrobe Health, Quick
    Actions, and Recent Activity. Each widget degrades independently
    (loading / error / empty). It surfaces engine output; it decides nothing.
  - **Navigation IA finalized** — Acquisition folded into the Stylist group
    ("Buy vs Skip", "Screenshot"); developer tools removed from the normal
    sidebar and moved behind **Developer Mode** into a dedicated **Developer
    Section** (shown only when Developer Mode is on).
  - **Settings** rebuilt as sectioned surfaces — Profile (display name),
    Preferences, AI Runtime (provider wiring), Appearance (theme), Developer
    Mode toggle, and About.
  - **About** (`/about`) — release, architecture (engine list), current AI
    provider wiring, credits, and links to the source + docs.
  - **Developer Mode** (`/developer`) — a gated hub for the AI Playground,
    Prompt Viewer, Cache Viewer, Execution Graph, Runtime Statistics, and
    Feature Flags (Playground + AI test live; the rest listed as planned).
  - **Polish** — accessibility (labels, `aria-pressed`, focus), empty/loading/
    error states across the new surfaces, and hydration-safe client reads.
  - Prepares the **v1.0.0 Release Candidate**. No schema changes.

- **Lifestyle Engine (RFC-006)** — deterministic trip planning. A new pure
  domain module (`src/domain/lifestyle`) turns a trip into a `LifestylePlan`
  composed of four sub-plans — **TripPlan** (per-day outfits + capsule),
  **PackingPlan** (packing list + `packingConfidence`), **LaundryPlan**
  (schedule + re-wears), **ShoppingPlan** (missing items + buy/skip suggestions)
  — plus a 0–100 **planScore**, **tradeoffs**, and **warnings**. It composes the
  existing engines across a time horizon, requesting per-day recommendations and
  missing-item buy/skip verdicts **through the Intelligence Orchestrator**
  (RFC-005) — never by calling those engines directly. Planning strategies
  (minimal / balanced / luxury / business; default balanced) tune the plan;
  weather is a normalized input behind a vendor-neutral **WeatherProvider**
  (Open-Meteo live fetch + manual entry; `historical`/future reserved). Surfaced
  at **`/lifestyle/trip`** as a 3-step wizard (trip → weather → plan) with an
  Explain placeholder. The engine plans deterministically; AI only explains.
  No schema changes.

- **Intelligence Orchestrator (RFC-005)** — a deterministic composition layer
  (`src/domain/orchestrator`) that coordinates the existing engines. Given a
  `CapabilityRequest`, it resolves capability dependencies (topological order,
  stable tie-break, cycle detection), plans execution, runs each capability's
  pure engine with **failure isolation** (a failed capability is recorded; its
  dependents are skipped; independent capabilities still run), and returns one
  `ExecutionReport` (executed / skipped / failed capabilities, execution order,
  dependency graph, per-capability timings + confidence, explainability,
  metadata). Registered capabilities compose real engines — health, usage,
  analytics (`generateInsights`), outfit (`generateOutfits`), recommendation
  (`recommendUnifiedOutfits`), personalization, vision (`interpretShoppingImage`),
  and acquisition (`evaluateBuyVsSkip`, using an upstream vision candidate when
  present). It holds **no business logic**, never calls AI, and engines stay
  pure and never call each other. A feature service assembles the
  `ExecutionContext` from repositories; AI reaches it via a new `runIntelligence`
  tool (the model requests capabilities; the orchestrator plans/executes
  deterministically). Timing is injected (deterministic tests). No schema
  changes. Future Travel / Packing / Weather / Calendar / Shopping / AI Chat
  become orchestration consumers.

### v0.9.0 — Personalization Engine

- **Personalization Engine (RFC-004)** — deterministic user-preference learning.
  A new pure domain module (`src/domain/personalization`) derives a
  `UserPreferenceProfile` from behaviour (wears, saved outfits, favourites,
  purchases; feedback/edits/acquisition are future capture) via signal-type
  weighting + exponential recency decay. Each preference carries a **confidence**
  ("how sure are we now?") and a distinct **stability** ("how consistently has it
  held?"), plus an explainable derivation reason. Supports user **overrides**
  (pin / adjust / suppress) and **protected** / **avoided** items; falls back to
  a labelled cold-start prior when evidence is thin. Preferences are recalculated
  from the full history each run, never incrementally mutated — behaviour is the
  source of truth; AI only consumes the profile (ADR-005). Surfaced at
  **`/settings/preferences`** (Settings → Preferences) with confidence/stability,
  reasons, override controls, protected/avoided lists, a debug view, a cold-start
  banner, and an Explain placeholder. `toPreferenceSnapshot` maps the profile onto
  `RecommendationContext.preferences`, superseding the static `DEFAULT_PREFERENCES`.
  Lifecycle, `since`, timeline, and `PreferenceEvolution` are documented future
  concepts (declared, not built).
- **Schema (additive):** `wardrobe_items.protected` / `.avoided` boolean columns
  (default false; inherit existing anon RLS) and a new `preference_overrides`
  table (pin/adjust/suppress per dimension+value; single `mvp_anon_all_*` policy).
  SQL in `docs/migrations/RFC-004-personalization.sql`. Reversible; no destructive
  changes.

### v0.8.0 — Vision Engine

- **Vision Engine (RFC-002)** — the universal computer-vision capability. A new
  pure domain module (`src/domain/vision`) turns any image into ONE standardized
  `VisionAnalysis` (detected items, colours, material/texture/pattern, brand,
  segmentation, `StyleDNACandidate`s, confidence + quality band, `imageHash`
  metadata) via the pipeline **Preprocess → Provider → Normalize → Validate**.
  Provider-agnostic (`VisionProvider` interface; `GeminiVisionProvider`
  implemented in `src/ai/vision`, with OpenAI/Claude/Local stubs); normalization
  is deterministic. Exposed through a dev-only Vision tab in the AI Playground
  (`POST /api/ai/vision`). Vision observes, domain interprets, AI explains — no
  inventory, shopping, recommendations, or AI explanation here. No schema changes.
- **Shopping Screenshot Understanding (RFC-003)** — connects the Vision Engine to
  the Buy vs Skip Engine. A new pure interpreter (`interpretShoppingImage` in
  `src/domain/acquisition`) maps a `VisionAnalysis` + a chosen detected item into
  an editable `ProspectiveItemCandidate` (name, category, brand/colour/material
  guesses, style tags, formality, per-field confidence, low-confidence flags,
  alternatives, source-image provenance; price is left blank since vision doesn't
  read it). Surfaced at **`/acquisition/screenshot`** (Acquisition → Screenshot):
  upload a screenshot → the Vision Engine extracts candidate(s) → pick one if
  several are detected → correct the flagged fields → the deterministic
  `BuyVsSkipEngine` scores it. An optional ✨ Explain action narrates the verdict
  in plain language (AI explains, never decides). Vision observes, you edit,
  engines decide. No wishlist persistence, no browser extension, no schema changes.

### v0.7.0 — Acquisition Engine

- **Buy vs Skip (RFC-001)** — a deterministic purchase decision-support system.
  A new pure `BuyVsSkipEngine` (`src/domain/acquisition`) scores a prospective
  item against the wardrobe across eight dimensions (gap fill, outfit
  compatibility, usage projection, duplicate risk, cost efficiency, wardrobe
  health impact, practicality, preference fit), returning a `buy | consider |
skip` decision with a 0–100 score, confidence, per-dimension breakdown,
  reasons, similar items, potential outfits, cost-per-wear, wardrobe-impact
  score, a decision trace, and explainability codes. Surfaced at
  **`/acquisition/advisor`** (Acquisition → Advisor). Engines decide; AI is not
  involved. No schema changes.

## [0.6.0] — 2026-07-07

**AI Stylist Beta.** The deterministic wardrobe stack gains an AI layer that
explains and converses — without ever becoming the source of truth.

### Added

- **AI infrastructure** — a vendor-neutral AI layer (`AIProvider`, `AIService`,
  orchestrator with provider selection, retry, fallback, logging) and prompt /
  schema / parser primitives.
- **Gemini provider** — server-side `generate()` on `@google/genai`, key read
  from env (never bundled to the browser), retry-once on transient failures.
- **AI recommendation explanation** — an ✨ Explain action on recommendation
  cards that produces a validated, structured explanation grounded only in the
  already-computed recommendation and curated summaries.
- **AI response cache** — Supabase-backed `ai_cache` with in-memory fallback,
  deterministic key (prompt builder + version + model + input), TTL expiry,
  `forceRefresh`, and cached/fresh visibility.
- **AI Playground** (`/ai/playground`) — a developer tool to run prompt builders
  in isolation and inspect prompts, response, validation, latency, and cache.
- **AI tool-calling architecture** — `ToolRegistry` / `ToolExecutor` /
  `ToolRouter` with JSON-schema validation and Gemini/OpenAI adapters, plus 8
  wardrobe tools (recommendations, health, usage, insights, outfit, item,
  inventory search, shopping advice).
- **AI Stylist Chat** (`/chat`) — a streaming, tool-calling stylist with
  session-only memory, suggested prompts, a Debug mode showing every tool call,
  and latency + token-usage display.
- **Architecture Decision Records** — ADR-001 … ADR-008 under `docs/adr/`.

### Changed

- `GeminiProvider` / `GeminiChatModel` now honour a per-request `model`, so the
  model used matches the AI cache key.

### Notes

- No database schema changes beyond the additive `ai_cache` table (RLS-enabled,
  anon policy consistent with the rest of the app).
- AI remains explanation/conversation only — all scoring, eligibility, ranking,
  health, and cost decisions stay in the pure domain engines.

## [0.5.0]

- Outfit Generation Engine and Unified Recommendation Engine; Recommendation
  Center with debug tooling.

## [0.4.0]

- Outfit Builder and the deterministic Outfit Scoring Engine.

## [0.3.0]

- Dashboard analytics, Wardrobe Health Engine, Usage Analytics Engine,
  Purchase / cost-per-wear tracking, and the Insight Center.

## [0.2.0]

- Image upload, bulk JSON import, item detail pages, advanced inventory table.

## [0.1.0]

- Database schema and inventory CRUD.

[Unreleased]: https://github.com/SanchitB23/wardrobe-os/compare/v2.1.0...HEAD
[2.1.0]: https://github.com/SanchitB23/wardrobe-os/compare/v2.0.1...v2.1.0
[2.0.1]: https://github.com/SanchitB23/wardrobe-os/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/SanchitB23/wardrobe-os/compare/v1.1.0...v2.0.0
[1.1.0]: https://github.com/SanchitB23/wardrobe-os/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/SanchitB23/wardrobe-os/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/SanchitB23/wardrobe-os/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/SanchitB23/wardrobe-os/compare/v0.6.0...v1.0.0
[0.6.0]: https://github.com/SanchitB23/wardrobe-os/releases/tag/v0.6.0
