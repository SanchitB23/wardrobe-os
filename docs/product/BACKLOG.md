# Product Backlog

The forward-looking backlog, organised by **epic** and mapped to roadmap phases
([ROADMAP.md](../../ROADMAP.md)). Each backlog item reserves an **RFC number**;
every major item must have an approved RFC ([docs/rfc/](../rfc/README.md)) before
implementation begins.

**RFC numbers are permanent and assigned sequentially at authoring time** — an
RFC gets the next free number when it is written, regardless of epic. The epic
tables below are the **plan**; titles are fixed but the numbers on not-yet-written
items are tentative and are claimed in authoring order.

Authored so far:
- **RFC-001 — Buy vs Skip** (Acquisition) — ✅ Completed.
- **RFC-002 — Vision Engine** (Vision foundation) — ✅ Completed. The universal
  computer-vision capability that produces one standardized `VisionAnalysis`;
  the other Vision items below consume it.
- **RFC-003 — Shopping Screenshot Understanding** (Vision / Acquisition) —
  ✅ Completed. Screenshot → `VisionAnalysis` → `ProspectiveItemCandidate` →
  Buy vs Skip verdict, at `/acquisition/screenshot`.
- **RFC-004 — Personalization Engine** (Intelligence, v0.9) — 🚧 **In Progress.**
  Deterministically derives a `UserPreferenceProfile` from behaviour (wears,
  outfits, purchases, favourites, feedback, edits, acquisition decisions),
  superseding the static `DEFAULT_PREFERENCES` in `RecommendationContext`. The
  engine derives; AI only explains.
- **RFC-005 — Intelligence Orchestrator** (Intelligence, v1.0) — ✅ Implemented.
  A deterministic composition layer (`src/domain/orchestrator`) that resolves
  capability dependencies, plans execution, runs the existing engines with
  failure isolation, and returns one `ExecutionReport`. It composes engines;
  it holds no business logic and never calls AI. Reachable by AI via the
  `runIntelligence` tool. Future Travel / Packing / Weather / Calendar /
  Shopping / AI Chat become consumers.

Guiding principle (unchanged): **deterministic engines decide, AI explains.** New
capabilities should be solved with a domain engine first; AI is layered on for
explanation/conversation only. See [DECISIONS.md](../../DECISIONS.md) and
[ADR-005](../adr/ADR-005-ai-does-not-decide.md).

---

## Epic 1 — Acquisition Engine (v0.7) ✅ Completed

Turn wardrobe gaps, duplicates, and cost-per-wear into deterministic buy/skip
guidance. AI explains the advice; the engine decides it.

| RFC | Title | Status |
| --- | --- | --- |
| [RFC-001](../rfc/RFC-001-Acquisition-Engine-Buy-vs-Skip.md) | Buy vs Skip | ✅ Completed |
| _(TBD)_ | Duplicate Detection | Not started |
| _(TBD)_ | Gap Analysis | Not started |
| _(TBD)_ | Wishlist | Not started |
| _(TBD)_ | Price Tracking | Not started |
| _(TBD)_ | Credit Card Optimization | Not started |

## Epic 2 — Vision + Shopping Screenshot (v0.8) ✅ Completed

Image understanding to enrich the wardrobe. The **Vision Engine** is the
universal capability: it turns any image into one standardized `VisionAnalysis`;
every other Vision item consumes that output. Vision perceives/proposes; the
deterministic engines still decide.

| RFC | Title | Status |
| --- | --- | --- |
| [RFC-002](../rfc/RFC-002-Vision-Engine.md) | Vision Engine (foundation → `VisionAnalysis`) | ✅ Completed |
| [RFC-003](../rfc/RFC-003-Shopping-Screenshot-Understanding.md) | Shopping Screenshot Understanding | ✅ Completed |
| _(TBD)_ | Closet Photo Recognition | Not started |
| _(TBD)_ | Outfit Recognition | Not started |
| _(TBD)_ | Auto Add Item | Not started |

## Epic 3 — Personalization Engine (v0.9) 🚧 Current

Learn the owner's taste from their own behaviour and feed it back into every
engine. Deterministic derivation with **confidence** and **stability** (two
distinct concepts) plus user overrides; preferences are re-derived from behaviour
every run, never incrementally mutated. AI explains the profile, never derives it.

| RFC | Title | Status |
| --- | --- | --- |
| [RFC-004](../rfc/RFC-004-Personalization-Engine.md) | Personalization Engine (behaviour → `UserPreferenceProfile`) | 🚧 In Progress |
| [RFC-005](../rfc/RFC-005-Intelligence-Orchestrator.md) | Intelligence Orchestrator (composition layer, v1.0) | ✅ Implemented |

Documented future concepts (not built in RFC-004): Preference Timeline,
Preference Lifecycle (core / emerging / declining / avoided), `since` metadata,
and `PreferenceEvolution`.

## Epic 4 — Lifestyle Engine (v1.0)

Trip- and context-scoped planning built on the outfit, recommendation, and
personalization engines.

| RFC | Title | Status |
| --- | --- | --- |
| _(TBD)_ | Travel | Not started |
| _(TBD)_ | Packing | Not started |
| _(TBD)_ | Weather | Not started |
| _(TBD)_ | Capsule Wardrobe | Not started |

## Epic 5 — AI Runtime (v1.1)

Turn the AI layer into a configurable runtime — the provider is an interchangeable
detail behind the deterministic engines.

| RFC | Title | Status |
| --- | --- | --- |
| _(TBD)_ | Capability Routing | Not started |
| _(TBD)_ | Provider Routing | Not started |
| _(TBD)_ | Primary / Fallback Providers | Not started |
| _(TBD)_ | Provider Benchmarking | Not started |
| _(TBD)_ | Cost Analytics | Not started |
| _(TBD)_ | Latency Analytics | Not started |
| _(TBD)_ | Prompt Versioning | Not started |

Target configuration (future): **Text** → OpenAI (fallback Gemini); **Vision** →
Gemini; **Image Generation** (future) → OpenAI.

## Epic 6 — Wardrobe Intelligence (v1.2)

Compose the engines into higher-order reasoning.

| RFC | Title | Status |
| --- | --- | --- |
| _(TBD)_ | Cross-engine orchestration | Not started |
| _(TBD)_ | Long-horizon planning | Not started |
| _(TBD)_ | Multi-step reasoning | Not started |

## Removed from scope

Permanently removed — **low ROI for a single-user product**:

- **Chrome / Browser Extension** — upload flows cover the shopping use case.
- **Notification Engine** — no recurring push/notification surface.

---

### Status legend

`Not started` → `RFC drafting` → `RFC approved` → `In progress` → `Done`

When you begin an item, author its RFC from
[docs/rfc/TEMPLATE.md](../rfc/TEMPLATE.md), set this row to `RFC drafting`, and
keep the RFC's own `Status:` header as the detailed source of truth.
