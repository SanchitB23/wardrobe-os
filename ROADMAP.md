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

**Current:** **v1.0.1 — Stabilization** (shipped). v1.0.0 (RFC-004 Personalization,
RFC-005 Intelligence Orchestrator, RFC-006 Lifestyle Engine, RFC-007 Today
Experience, and the RFC-008 hardening pass) is tagged; **v1.0.1 (RFC-009)** is a
quality-only patch — performance, accessibility, developer-experience, and
resilience improvements, no new features.

## Phases

| Version | Name | Status | Theme |
| --- | --- | --- | --- |
| v0.1–v0.6 | Foundation → AI Stylist | ✅ | Inventory, analytics, outfits, recommendations, AI stylist |
| v0.7 | Acquisition Engine | ✅ | Deterministic buy/skip guidance |
| v0.8 | Vision + Shopping Screenshot | ✅ | Understand item photos and shopping screenshots |
| v0.9 | Personalization Engine | ✅ | Learn preferences from behaviour |
| v1.0 | Lifestyle Engine + Today Experience | ✅ | Trip planning, and the assistant-style Today home that unifies every surface |
| **v1.0.1** | **Stabilization (RFC-009)** | **✅** | **Quality only: performance, accessibility, DX, resilience — no new features** |
| v1.1 | AI Runtime | 🔜 | Capability/provider routing, benchmarking, cost/latency analytics, prompt versioning |
| v1.2 | Wardrobe Intelligence | 🔜 | Cross-engine orchestration, long-horizon planning, multi-step reasoning |

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

### v1.1 — AI Runtime 🔜
Turn the AI layer into a configurable runtime — the provider is an interchangeable
detail behind the engines.
- **Weather Runtime — shipped** (RFC-011: `src/runtime/weather` + `src/domain/weather`).
  Provider-agnostic (`OpenMeteo` / `Manual`, `WEATHER_PROVIDER`); recommendation
  consumes a normalized `WeatherSnapshot`; a first-class Orchestrator `weather`
  capability; in-memory cache + metrics; seasonal-fallback on failure (the AI
  explains it, never hallucinates); inspector at `/developer/weather`.
- Capability Routing
- Provider Routing
- Primary / Fallback Providers
- Provider Benchmarking
- Cost Analytics
- Latency Analytics
- Prompt Versioning

**Target AI Runtime configuration** (future):

| Capability | Primary | Fallback |
| --- | --- | --- |
| Text | OpenAI | Gemini |
| Vision | Gemini | — |
| Image Generation (future) | OpenAI | — |

### v1.2 — Wardrobe Intelligence 🔜
Compose the engines into higher-order reasoning.
- **Cross-engine orchestration — foundation shipped** (RFC-005 Intelligence
  Orchestrator: `src/domain/orchestrator`; deterministic capability planning +
  execution + reporting; AI reaches it via `runIntelligence`). Consumers
  (Travel/Packing/Weather/Calendar/Shopping/Chat) build on it.
- Long-horizon planning
- Multi-step reasoning

See [ENGINE_GRAPH.md](ENGINE_GRAPH.md) for the engine dependency graph and the
orchestrator capabilities.

---

## Explicitly out of scope (removed)

These were considered and **permanently removed** — low ROI for a single-user
product:

- **Chrome / Browser Extension** — upload flows cover the shopping use case.
- **Notification Engine** — no recurring push/notification surface.
