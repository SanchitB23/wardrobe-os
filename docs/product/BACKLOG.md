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
- **RFC-004 — Personalization Engine** (Intelligence, v0.9) — ✅ **Implemented.**
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
- **RFC-006 — Lifestyle Engine** (Lifestyle, v1.0) — ✅ Implemented. One
  deterministic engine (`src/domain/lifestyle`) that turns a trip into a
  `LifestylePlan` (TripPlan / PackingPlan / LaundryPlan / ShoppingPlan + planScore
  - packingConfidence + trade-offs + warnings) by composing the existing engines
    across time, requesting recommendations/acquisition through the Orchestrator
    (never directly). Weather is a normalized provider input (Open-Meteo + manual).
    Surfaced at `/lifestyle/trip`. The engine plans; AI only explains.
- **RFC-007 — Today Experience & v1.0 Product Polish** (Product Experience, v1.0)
  — ✅ Implemented. The v1.0 cohesion pass: an assistant-style Today home (the
  default route), finalized navigation IA, real Settings + About (`/about`), a
  gated Developer Mode hub (`/developer`), and an accessibility / performance /
  release-readiness sweep. No new engines or AI — it composes existing surfaces
  so the app feels like one assistant. Prepares the **v1.0.0 Release Candidate**.

Guiding principle (unchanged): **deterministic engines decide, AI explains.** New
capabilities should be solved with a domain engine first; AI is layered on for
explanation/conversation only. See [DECISIONS.md](../../DECISIONS.md) and
[ADR-005](../adr/ADR-005-ai-does-not-decide.md).

---

## Epic 1 — Acquisition Engine (v0.7) ✅ Completed

Turn wardrobe gaps, duplicates, and cost-per-wear into deterministic buy/skip
guidance. AI explains the advice; the engine decides it.

| RFC                                                         | Title                    | Status       |
| ----------------------------------------------------------- | ------------------------ | ------------ |
| [RFC-001](../rfc/RFC-001-Acquisition-Engine-Buy-vs-Skip.md) | Buy vs Skip              | ✅ Completed |
| _(TBD)_                                                     | Duplicate Detection      | Not started  |
| _(TBD)_                                                     | Gap Analysis             | Not started  |
| _(TBD)_                                                     | Wishlist                 | Not started  |
| _(TBD)_                                                     | Price Tracking           | Not started  |
| _(TBD)_                                                     | Credit Card Optimization | Not started  |

## Epic 2 — Vision + Shopping Screenshot (v0.8) ✅ Completed

Image understanding to enrich the wardrobe. The **Vision Engine** is the
universal capability: it turns any image into one standardized `VisionAnalysis`;
every other Vision item consumes that output. Vision perceives/proposes; the
deterministic engines still decide.

| RFC                                                            | Title                                         | Status       |
| -------------------------------------------------------------- | --------------------------------------------- | ------------ |
| [RFC-002](../rfc/RFC-002-Vision-Engine.md)                     | Vision Engine (foundation → `VisionAnalysis`) | ✅ Completed |
| [RFC-003](../rfc/RFC-003-Shopping-Screenshot-Understanding.md) | Shopping Screenshot Understanding             | ✅ Completed |
| _(TBD)_                                                        | Closet Photo Recognition                      | Not started  |
| _(TBD)_                                                        | Outfit Recognition                            | Not started  |
| _(TBD)_                                                        | Auto Add Item                                 | Not started  |

## Epic 3 — Personalization Engine (v0.9) 🚧 Current

Learn the owner's taste from their own behaviour and feed it back into every
engine. Deterministic derivation with **confidence** and **stability** (two
distinct concepts) plus user overrides; preferences are re-derived from behaviour
every run, never incrementally mutated. AI explains the profile, never derives it.

| RFC                                                    | Title                                                        | Status         |
| ------------------------------------------------------ | ------------------------------------------------------------ | -------------- |
| [RFC-004](../rfc/RFC-004-Personalization-Engine.md)    | Personalization Engine (behaviour → `UserPreferenceProfile`) | ✅ Implemented |
| [RFC-005](../rfc/RFC-005-Intelligence-Orchestrator.md) | Intelligence Orchestrator (composition layer, v1.0)          | ✅ Implemented |

Documented future concepts (not built in RFC-004): Preference Timeline,
Preference Lifecycle (core / emerging / declining / avoided), `since` metadata,
and `PreferenceEvolution`.

## Epic 4 — Lifestyle Engine (v1.0)

Trip- and context-scoped planning built on the outfit, recommendation, and
personalization engines, and delivered as Intelligence Orchestrator (RFC-005)
capabilities. One deterministic Lifestyle Engine plans across time; AI only
explains the plan.

| RFC                                           | Title                                                                               | Status         |
| --------------------------------------------- | ----------------------------------------------------------------------------------- | -------------- |
| [RFC-006](../rfc/RFC-006-Lifestyle-Engine.md) | Lifestyle Engine (trip → `LifestylePlan`: packing, capsule, laundry, missing items) | ✅ Implemented |
| _(TBD)_                                       | Calendar integration                                                                | Not started    |

## Epic 5 — AI Runtime (v1.1)

Turn the AI layer into a configurable runtime — the provider is an interchangeable
detail behind the deterministic engines.

| RFC                                                    | Title                                                                                                                                | Status                                                                                                                      |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [RFC-011](../rfc/RFC-011-Weather-Runtime.md)           | Weather Runtime (provider-agnostic; weather as a first-class capability)                                                             | ✅ Implemented                                                                                                              |
| [RFC-012](../rfc/RFC-012-Recommendation-Engine-v2.md)  | Recommendation Engine v2 (multi-objective, weather- & preference-aware, diverse, explainable)                                        | ✅ Implemented                                                                                                              |
| [RFC-013](../rfc/RFC-013-Personalization-Engine-v2.md) | Personalization Engine v2 (lifecycle, timeline, evolution, explore/exploit)                                                          | ✅ Implemented                                                                                                              |
| [RFC-014](../rfc/RFC-014-AI-Runtime-v2.md)             | AI Runtime v2 — capability routing, provider policies (primary/fallback), benchmarking, prompt versioning, latency + cost metrics    | ✅ Implemented · **RFC-014A complete** (real OpenAI provider, cost-first Gemini default, model policy, OpenAI budget guard) |
| [RFC-014B](../rfc/RFC-014B-Cost-Aware-AI-Runtime.md)   | Cost-Aware AI Runtime — capability/model routing, cost awareness, OpenAI budget guard; Gemini-first, OpenAI as an optimization layer | ✅ Implemented (RuntimePolicyResolver decision layer + dashboard)                                                           |

Cost-first configuration (RFC-014B): **Gemini** default for conversation /
explanation / summarization / vision; **OpenAI** (Gemini fallback) for structured

- classification (GPT-5.4 mini/nano). GPT-5.5 is premium, never auto-selected.

## Epic 6 — Wardrobe Intelligence (v1.2) ⏸️ Parked

Higher-order reasoning — **parked**. Cross-engine orchestration is already
delivered by the Intelligence Orchestrator (RFC-005); long-horizon planning /
multi-step reasoning are absorbed into AI Runtime v2 (RFC-014), Personalization v2
(RFC-013), and the Orchestrator. Full reasoning in
[FUTURE.md](FUTURE.md) (Parking Lot).

| RFC                  | Title                                        | Status                                        |
| -------------------- | -------------------------------------------- | --------------------------------------------- |
| ~~RFC-020~~          | ~~Cross-Engine Orchestration~~               | ⏸️ Number reassigned → Inventory Image Intelligence (✅ v2.0.1) |
| [RFC-021](FUTURE.md) | Long-Horizon Planning & Multi-Step Reasoning | ⏸️ Parked (absorbed — RFC-013/014/005)        |

## Epic 7 — Product Experience & v1.0 Polish (v1.0)

The cohesion pass that turns the modules into one assistant — no new engines.
Today home, finalized IA, Settings/About, gated Developer Mode, and the
accessibility / performance / release-readiness sweep.

| RFC                                                         | Title                                                    | Status                  |
| ----------------------------------------------------------- | -------------------------------------------------------- | ----------------------- |
| [RFC-007](../rfc/RFC-007-Today-Experience-and-v1-Polish.md) | Today Experience & v1.0 Product Polish                   | ✅ Implemented          |
| [RFC-008](../rfc/RFC-008-Release-Candidate.md)              | v1.0 Release Candidate — Audit Triage & Remediation      | ✅ Implemented (v1.0.0) |
| [RFC-009](../rfc/RFC-009-v1-0-1-Stabilization.md)           | v1.0.1 Stabilization Release (quality only, no features) | ✅ Implemented (v1.0.1) |
| [RFC-010](../rfc/RFC-010-Application-Access-Guard.md)       | Application Access Guard (single access code; not auth)  | ✅ Implemented (v1.0.2) |

## Epic 8 — Product Intelligence (v1.1)

Lead with **prioritised actions**, not analytics. One Intelligence Center
aggregates every deterministic engine into a single, deduplicated, impact-ranked
list of typed actions. Engines decide the actions; the Center ranks; AI explains.

| RFC                                              | Title                                                                                  | Status         |
| ------------------------------------------------ | -------------------------------------------------------------------------------------- | -------------- |
| [RFC-015](../rfc/RFC-015-Intelligence-Center.md) | Intelligence Center (aggregate all engines → prioritised, typed, deduped action cards) | ✅ Implemented |
| [RFC-015A](../rfc/RFC-015A-Category-Optimization.md) | Category Optimization — turn Replace cards into guided keep/rotate/retire + shopping opportunities | ✅ Implemented |

## Epic 9 — Lifestyle Intelligence Platform (v2.0) ✅ v2.0.0 + v2.0.1

Grow beyond the closet into the contexts a wardrobe serves. Engines decide; AI
explains. **v2.0.0** ships RFC-017 / 018 / 018B / 019 + the Acquisitions hub;
**v2.0.1** ships RFC-020 Inventory Image Intelligence. Full status + reasoning in
[FUTURE.md](FUTURE.md).

| RFC                                                | Title                                                                                                                                                                                                           | Status                           |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| [RFC-017](../rfc/RFC-017-Trip-Planner.md)          | Trip Planner — reusable/editable trips, templates, history, multi-city, packing checklist + progress, timeline / outfit calendar (**first v2.0 feature**)                                                       | ✅ Implemented                   |
| [RFC-018](../rfc/RFC-018-Shopping-Intelligence.md) | Shopping Intelligence — wishlist · priority queue · wardrobe ROI · duplicate intelligence · shopping timeline (no budget planning). Product hub: `/acquisitions`; intelligence UI: `/acquisitions/intelligence` | ✅ Implemented                   |
| [RFC-018B](../rfc/RFC-018B-Acquisitions-Intelligence.md) | Acquisitions Intelligence — purchase lifecycle · recommendation accuracy · need/ROI evolution · opportunity queue · dynamic strategy (evolution of RFC-018; no engine replacement) | ✅ Implemented |
| [RFC-019](../rfc/RFC-019-Vision-Intelligence-v2.md) | Vision Intelligence v2 — closet scan · assisted outfit recognition · visual duplicate detection · review queue (laundry deferred) | ✅ Implemented                   |
| [RFC-020](../rfc/RFC-020-Inventory-Image-Intelligence.md) | Inventory Image Intelligence — primary image → VisualStyleAttributes → Accept → StyleDNA (v2.0.1) | ✅ Implemented                   |
| [RFC-016](FUTURE.md)                               | Calendar Intelligence                                                                                                                                                                                           | ⏸️ Parked (low ROI, single-user) |

## Epic 10 — Platform / Observability (v2.0.x)

Production debugging and AI cost visibility without changing product logic or
deterministic engines. Structured JSON → Vercel Runtime Logs; optional Developer
Mode viewer.

| RFC                                                                    | Title                                                                                              | Status        |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------- |
| [RFC-022](../rfc/RFC-022-Logging-and-Observability-Runtime.md)         | Logging & Observability Runtime — correlation IDs, structured API/AI/engine logs, redaction, cost visibility | Done ✅ (Implemented)  |

## Removed / parked from scope

**Rejected** — low ROI for a single-user product ([FUTURE.md](FUTURE.md) → Rejected):

- **Chrome / Browser Extension** — upload flows cover the shopping use case.
- **Notification Engine** — no recurring push/notification surface.
- **Budget Planning** — dropped from Shopping Intelligence; cost-per-wear +
  Wardrobe ROI already give the money signal.

**Parked** — deferred, revisit later ([FUTURE.md](FUTURE.md) → Parking Lot):
Calendar Intelligence (RFC-016), Long-Horizon Planning & Multi-Step Reasoning
(RFC-021), Laundry Detection. Former Cross-Engine Orchestration topic remains
cancelled (RFC-005); RFC-020 number is Inventory Image Intelligence (✅ v2.0.1).
Next free sequential after parked RFC-021 / implemented RFC-022: **RFC-023**.

---

### Status legend

`Not started` → `RFC drafting` → `RFC approved` → `In progress` → `Done`

When you begin an item, author its RFC from
[docs/rfc/TEMPLATE.md](../rfc/TEMPLATE.md), set this row to `RFC drafting`, and
keep the RFC's own `Status:` header as the detailed source of truth.
