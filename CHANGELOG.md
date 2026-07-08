# Changelog

All notable changes to Wardrobe OS are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### v1.0.0 — Intelligence Orchestrator (in progress)

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

### v0.9.0 — Personalization Engine (in progress)

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

### v0.8.0 — Vision Engine (in progress)

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

### v0.7.0 — Acquisition Engine (in progress)

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

[Unreleased]: https://github.com/SanchitB23/wardrobe-os/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/SanchitB23/wardrobe-os/releases/tag/v0.6.0
