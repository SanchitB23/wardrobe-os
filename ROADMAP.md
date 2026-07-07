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

**In progress:** RFC-004 Personalization Engine (v0.9) — *In Progress*.

## Phases

| Version | Name | Status | Theme |
| --- | --- | --- | --- |
| v0.1–v0.6 | Foundation → AI Stylist | ✅ | Inventory, analytics, outfits, recommendations, AI stylist |
| v0.7 | Acquisition Engine | ✅ | Deterministic buy/skip guidance |
| v0.8 | Vision + Shopping Screenshot | ✅ | Understand item photos and shopping screenshots |
| **v0.9** | **Personalization Engine** | **🚧 current** | **Learn preferences from behaviour** |
| v1.0 | Lifestyle Engine | 🔜 | Travel, packing, weather, capsule wardrobe |
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

### v0.9 — Personalization Engine 🚧 (current)
Learn the owner's taste from their own behaviour (wears, outfits, purchases,
favourites, feedback, edits, acquisition decisions) and feed it back into every
engine. Deterministic derivation with confidence and stability, plus user
overrides. The engine derives; AI only explains.
- **RFC-004 Personalization Engine — In Progress** (`derivePreferenceProfile` →
  `UserPreferenceProfile`, superseding the static `DEFAULT_PREFERENCES` in
  `RecommendationContext`). Preferences are re-derived from behaviour every run,
  never incrementally mutated.

### v1.0 — Lifestyle Engine 🔜
Trip- and context-scoped planning built on the outfit, recommendation, and
personalization engines.
- Travel
- Packing
- Weather
- Capsule Wardrobe

### v1.1 — AI Runtime 🔜
Turn the AI layer into a configurable runtime — the provider is an interchangeable
detail behind the engines.
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
- Cross-engine orchestration
- Long-horizon planning
- Multi-step reasoning

---

## Explicitly out of scope (removed)

These were considered and **permanently removed** — low ROI for a single-user
product:

- **Chrome / Browser Extension** — upload flows cover the shopping use case.
- **Notification Engine** — no recurring push/notification surface.
