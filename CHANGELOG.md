# Changelog

All notable changes to Wardrobe OS are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
    *composes* existing deterministic outputs into widgets: Today's Outfit
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

[Unreleased]: https://github.com/SanchitB23/wardrobe-os/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/SanchitB23/wardrobe-os/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/SanchitB23/wardrobe-os/compare/v0.6.0...v1.0.0
[0.6.0]: https://github.com/SanchitB23/wardrobe-os/releases/tag/v0.6.0
