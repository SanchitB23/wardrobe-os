# Roadmap

Wardrobe OS ships in versioned phases. Each phase adds a coherent capability and
follows the release discipline in [CONTRIBUTING.md](CONTRIBUTING.md). The guiding
rule throughout: **deterministic engines first, AI explanation second.**

Legend: ✅ shipped · 🚧 current · 🔜 planned

## Completed so far

- ✅ Database
- ✅ Inventory
- ✅ Outfit Engine
- ✅ Analytics Engine
- ✅ Recommendation Engine
- ✅ AI Platform
- ✅ AI Stylist
- ✅ Acquisition Engine
- ✅ Vision Engine
- ✅ Shopping Screenshot Understanding
- ✅ Personalization Engine
- ✅ Intelligence Orchestrator
- ✅ Lifestyle Engine (Trip Planner)

- ✅ Today Experience & v1.0 Product Polish (RFC-007)

**Current:** **v2.3.0 — Item Relations Editor & Status Page** shipped
([docs/releases/v2.3.0.md](docs/releases/v2.3.0.md)). Prior: **v2.2.0**
Catalog Review v2.

## Phases

| Version    | Name                                  | Status    | Theme                                                                                                                                                   |
| ---------- | ------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0.1–v0.6  | Foundation → AI Stylist               | ✅        | Inventory, analytics, outfits, recommendations, AI stylist                                                                                              |
| v0.7       | Acquisition Engine                    | ✅        | Deterministic buy/skip guidance                                                                                                                         |
| v0.8       | Vision + Shopping Screenshot          | ✅        | Understand item photos and shopping screenshots                                                                                                         |
| v0.9       | Personalization Engine                | ✅        | Learn preferences from behaviour                                                                                                                        |
| v1.0       | Lifestyle Engine + Today Experience   | ✅        | Trip planning, and the assistant-style Today home that unifies every surface                                                                            |
| **v1.0.1** | **Stabilization (RFC-009)**           | **✅**    | **Quality only: performance, accessibility, DX, resilience — no new features**                                                                          |
| **v1.1**   | **Intelligence Refinement + Runtime** | **✅**    | **Weather Runtime, Recommendation v2, Personalization v2, AI Runtime v2, Intelligence Center (RFC-011…015)**                                            |
| **v2.0**   | **Lifestyle Intelligence Platform**   | **✅**    | **Trip Planner (017), Shopping Intelligence (018), Acquisitions hub + 018B, Vision Intelligence v2 (019)**                                               |
| **v2.0.1** | **Inventory Image Intelligence**      | **✅**    | **RFC-020 — primary image → VisualStyleAttributes → Accept → StyleDNA gap-fill**                                                                        |
| **v2.1.0** | **Wear Logs, Acquisitions & Ops**     | **✅**    | **RFC-023 wear logs; RFC-018C pipeline + Decision History polish; RFC-015A Optimize; RFC-022 observability**                                           |
| **v2.2.0** | **Catalog Review v2**                 | **✅**    | **RFC-024 — metadata-aware duplicates, similar items, completeness sections, dismissals, quality score**                                              |
| **v2.3.0** | **Item Relations & Status**           | **✅**    | **RFC-026 relations editor + suggest + bulk; RFC-028 status page; RFC-025A color-family gate; RFC-023 wear-log UX follow-up**                        |
| ~~v1.2~~   | ~~Wardrobe Intelligence~~             | ⏸️ Parked | Cross-engine orchestration + higher-order reasoning — superseded / absorbed by RFC-005/013/014 (see [FUTURE.md](docs/product/FUTURE.md))                |

---

### v0.7 — Acquisition Engine ✅

Deterministic buy/skip guidance from wardrobe gaps, duplicates, and
cost-per-wear. AI explains the recommendation; the engine decides it.

- **RFC-001 Buy vs Skip — implemented** (`BuyVsSkipEngine` + `/acquisition/advisor`).

### v0.8 — Vision + Shopping Screenshot ✅

Image understanding that feeds the deterministic engines. Vision observes; the
engines still decide.

- **RFC-002 Vision Engine — implemented** (`src/domain/vision` +
  `GeminiVisionProvider`; standardized `VisionAnalysis`; dev Vision tab in the
  AI Playground).
- **RFC-003 Shopping Screenshot Understanding — implemented**
  (`interpretShoppingImage` maps `VisionAnalysis` → editable
  `ProspectiveItemCandidate`; `/acquisition/screenshot` wires screenshot →
  Vision Engine → user correction → Buy vs Skip verdict, with an optional AI
  explanation). First consumer of the Vision Engine.

### v0.9 — Personalization Engine ✅

Learn the owner's taste from their own behaviour (wears, outfits, purchases,
favourites, feedback, edits, acquisition decisions) and feed it back into every
engine. Deterministic derivation with confidence and stability, plus user
overrides. The engine derives; AI only explains.

- **RFC-004 Personalization Engine — In Progress** (`derivePreferenceProfile` →
  `UserPreferenceProfile`, superseding the static `DEFAULT_PREFERENCES` in
  `RecommendationContext`). Preferences are re-derived from behaviour every run,
  never incrementally mutated.

### v1.0 — Lifestyle Engine + Today Experience ✅ (v1.0.1 stabilization shipped)

The v1.0 release pairs the last deterministic engine with the cohesion pass that
turns every module into one assistant.

- **RFC-006 Lifestyle Engine — implemented** (`src/domain/lifestyle`;
  `/lifestyle/trip` Trip Planner). Trip- and context-scoped planning built on the
  outfit, recommendation, and personalization engines, composed through the
  Intelligence Orchestrator. Travel, Packing, Weather, and Capsule are
  capabilities of this one engine.
  - Travel · Packing · Weather (Open-Meteo + manual) · Capsule Wardrobe · Laundry
- **RFC-007 Today Experience & v1.0 Product Polish — implemented.** No new engines
  or AI — it composes existing surfaces. **Today** (`/`) is the default
  assistant-style home (Today's Outfit, Insight, Ask Stylist, Shopping
  Suggestions, Wardrobe Health, Quick Actions, Recent Activity). Navigation IA is
  finalized (Acquisition folded into Stylist; dev tools gated behind Developer
  Mode). Real Settings + About (`/about`) surfaces, a gated Developer hub
  (`/developer`), and an accessibility / performance / release-readiness sweep.

### v1.1 — Intelligence Refinement + Runtime ✅ Shipped

Turn the AI layer into a configurable runtime — the provider is an interchangeable
detail behind the engines.

- **Weather Runtime — shipped** (RFC-011: `src/runtime/weather` + `src/domain/weather`).
  Provider-agnostic (`OpenMeteo` / `Manual`, `WEATHER_PROVIDER`); recommendation
  consumes a normalized `WeatherSnapshot`; a first-class Orchestrator `weather`
  capability; in-memory cache + metrics; seasonal-fallback on failure (the AI
  explains it, never hallucinates); inspector at `/developer/weather`.
- **Recommendation Engine v2 — shipped** (RFC-012: `src/domain/recommendation/v2`).
  Multi-objective, weather- & personalization-aware scoring; hard-constraint
  eligibility; diversity reranking; full explainability (score breakdown, reason
  codes, trace) and per-run quality metrics. Deterministic; no AI ranking, no ML.
- **Personalization Engine v2 — shipped** (RFC-013: `src/domain/personalization/v2`).
  Preference lifecycle (core/emerging/declining/avoided), re-derivable timeline +
  evolution, sharper stability, and an explore/exploit control that feeds
  Recommendation Engine v2. Deterministic; no ML, no AI-derived preferences.
- **AI Runtime v2 — shipped** (RFC-014: `src/runtime/ai`). Capability-centric
  routing behind declarative provider policies (primary → fallback + retry),
  provider benchmarking, prompt versioning + deterministic experiments, and
  latency / cost / token metrics per capability × provider × prompt version;
  inspector at `/developer/ai-runtime`. Routes and measures; never decides
  (ADR-005). Delivers: Capability Routing, Provider Routing, Primary/Fallback,
  Benchmarking, Cost + Latency Analytics, Prompt Versioning.
  - **RFC-014A — shipped.** Real OpenAI provider + cost-first defaults (Gemini
    for text/vision; OpenAI for structured/classification), model policy, OpenAI
    budget guard.
  - **RFC-014B — shipped.** Cost-aware decision layer: `RuntimePolicyResolver`
    over `CapabilityPolicy` + `ModelPolicy` + `ProviderPreferenceResolver` +
    `RuntimeCostEstimator` + `RuntimeBudgetMonitor`; dashboard shows selected
    provider/model + active provider + budget. Gemini-first; OpenAI as an
    optimization layer.
- **Intelligence Center — shipped** (RFC-015: `src/domain/intelligence`). Product
  Intelligence: aggregates every deterministic engine into one deduplicated,
  impact-ranked list of typed actions (`/intelligence`, "Do this next" on Today,
  `getTopActions` stylist tool). Engines decide; the Center ranks; AI explains.
- **Category Optimization — shipped** (RFC-015A: `src/domain/category-optimization`).
  Turns Intelligence Center `replace` cards into an Optimize Category workflow
  (`/intelligence/optimize`): analysis → comparison → keep/protect/rotate/retire
  plan → shopping opportunities (wishlist confirm only). No auto-retire/delete.

**Target AI Runtime configuration** (future):

| Capability                | Primary | Fallback |
| ------------------------- | ------- | -------- |
| Text                      | OpenAI  | Gemini   |
| Vision                    | Gemini  | —        |
| Image Generation (future) | OpenAI  | —        |

### v2.0 — Lifestyle Intelligence Platform ✅ Shipped (v2.0.0 — 2026-07-12)

Grow beyond the closet into the contexts a wardrobe serves. Release notes:
[docs/releases/v2.0.0.md](docs/releases/v2.0.0.md). Full status + reasoning in
[FUTURE.md](docs/product/FUTURE.md):

- **Trip Planner (RFC-017) — ✅ shipped.** First-class, persisted, reusable
  trips: CRUD, templates, history/clone, multi-city, interactive packing
  checklist + progress, timeline / outfit calendar, weather refresh, and
  trip-anchored shopping. Trip is _data_; the Lifestyle Engine (RFC-006) still
  derives the plan. Surfaced at `/trips`.
- **Shopping Intelligence (RFC-018) — ✅ shipped.** Continuous shopping over Buy
  vs Skip: wishlist, priority queue, wardrobe ROI, duplicate intelligence,
  timeline, strategy. Surfaced at `/acquisitions/intelligence`.
- **Acquisitions Intelligence (RFC-018B) — ✅ shipped.** Purchase lifecycle,
  shallow+deep accuracy, need/ROI evolution, opportunity queue, dynamic
  strategy. Domain at `src/domain/shopping/v2`; hub panels + `/developer/acquisitions`.
- **Vision Intelligence v2 (RFC-019) — ✅ shipped.** Closet Scan, Assisted Outfit
  Recognition, Visual Duplicate Detection, Review Queue over Vision Engine
  (RFC-002). Surfaces at `/vision`. Never auto-adds or auto-logs.
- **Acquisitions product hub (UX shell) — ✅ shipped.** Flagship `/acquisitions`
  landing with wishlist CRUD, Decision History, timeline, ROI, shopping history.
  `/shopping` redirects. Intelligence stays secondary.
- **Inventory Image Intelligence (RFC-020) — ✅ shipped (v2.0.1).** Primary image
  → Vision Engine → pending `VisualStyleAttributes` → Accept/Reject → StyleDNA
  gap-fill into RecommendationContext. Surfaces on item detail +
  `/developer/inventory-images`. Manual fields always win.
- **Acquisition-to-Inventory Pipeline (RFC-018C) — ✅ shipped (v2.1.0).**
  Buy/Skip CTAs → wishlist link → purchase intent → confirmed inventory wizard
  → image carry-forward → optional Visual StyleDNA. Timeline includes Inventory
  Created. Decision History polish (wishlist deep links, First Wear/ROI,
  human-readable details). Never auto-creates inventory.
- **Ad-hoc Wear Logs & Outfit Promotion (RFC-023) — ✅ shipped (v2.1.0).**
  Event-centric wear logs separate from curated outfits; Quick Log / inventory
  multi-select / recommendation wear; repeated-combo suggest + user-confirmed
  Save as Outfit; dual-write to legacy `wear_logs` for analytics.
- **Category Optimization (RFC-015A) — ✅ shipped (v2.1.0).** Optimize workflow
  from Intelligence Center Replace cards; draft-only shopping handoffs.
- **Logging & Observability (RFC-022) — ✅ shipped (v2.1.0).** Structured JSON
  logging + developer hub (trace, graph, flags, runtime stats, replay); production
  AI routed through AIRuntime metrics.

### ~~v1.2 — Wardrobe Intelligence~~ ⏸️ Parked

The former "higher-order reasoning" epic is parked: **cross-engine orchestration**
is already delivered by the Intelligence Orchestrator (RFC-005), and
**long-horizon planning / multi-step reasoning** are absorbed into AI Runtime v2
(RFC-014), Personalization v2 (RFC-013), and the Orchestrator. See
[FUTURE.md](docs/product/FUTURE.md) (RFC-020 / RFC-021).

### Parked / cancelled

- **Calendar Intelligence (RFC-016)** — parked: low ROI for a single-user app.
- See [FUTURE.md](docs/product/FUTURE.md) for the full Parking Lot + Rejected list.

See [ENGINE_GRAPH.md](ENGINE_GRAPH.md) for the engine dependency graph and the
orchestrator capabilities.

---

## Explicitly out of scope (removed)

These were considered and **permanently removed** — low ROI for a single-user
product (see [FUTURE.md](docs/product/FUTURE.md) → Rejected):

- **Chrome / Browser Extension** — upload flows cover the shopping use case.
- **Notification Engine** — no recurring push/notification surface.
- **Budget Planning** — dropped from Shopping Intelligence (RFC-018); cost-per-wear
  - Wardrobe ROI already give the useful money signal.

**Parked** (deferred, not rejected — [FUTURE.md](docs/product/FUTURE.md) → Parking
Lot): Calendar Intelligence (RFC-016), Long-Horizon Planning & Multi-Step
Reasoning (RFC-021), Laundry Detection. Former “Cross-Engine Orchestration”
topic remains cancelled (covered by RFC-005); **RFC-020 number** is now Inventory
Image Intelligence (**Implemented** in v2.0.1).
