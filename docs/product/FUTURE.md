# Future & Parking Lot

The forward pipeline beyond **v1.1** (shipped), and the deliberate decisions about
what we will, might, and won't build. This is the single source of truth for the
status of not-yet-built RFCs; [ROADMAP.md](../../ROADMAP.md) and
[BACKLOG.md](BACKLOG.md) link here rather than duplicating the reasoning.

Every item lists a **Status**, a **Reason**, and a **Potential Version**.

> **Note on RFC numbers.** RFC-016 … RFC-021 are *reserved/planned* numbers — none
> is authored yet. Titles for RFC-020 / RFC-021 correspond to the former v1.2
> "Wardrobe Intelligence" concepts (cross-engine orchestration and higher-order
> reasoning); adjust when/if their RFCs are actually written.

---

## Planned

Will be built. **v2.0 — Lifestyle Intelligence Platform** grows Wardrobe OS beyond
the closet into the contexts a wardrobe serves. Engines decide; AI explains.

### RFC-017 — Trip Planner
- **Status:** RFC drafted ([Draft](../rfc/RFC-017-Trip-Planner.md)) — **the first
  v2.0 feature.**
- **Scope:** promote the one-shot trip wizard into a first-class, persisted Trip
  Planner — reusable/editable trips, templates, history, multi-city itineraries, a
  packing checklist with progress, a trip timeline / outfit calendar, trip-anchored
  shopping, and weather refresh. Builds on the Lifestyle Engine (RFC-006), Weather
  Runtime (RFC-011), and Recommendation Engine v2 (RFC-012) through the
  Intelligence Orchestrator; the engine still plans, AI explains.
- **Reason:** highest-value v2 direction — turns the ephemeral trip planner into a
  first-class travel experience with real, reusable day-by-day intelligence.
- **Potential Version:** v2.0.

### RFC-018 — Shopping Intelligence
- **Status:** Planned.
- **Scope (keep):** Wishlist · Shopping Strategy · Wardrobe ROI · Duplicate
  Detection · Purchase Prioritization.
- **Removed:** **Budget Planning** (see Rejected).
- **Reason:** sharpens acquisition (RFC-001 Buy vs Skip) into a full shopping
  workflow without turning the app into a budgeting tool.
- **Potential Version:** v2.0.

### RFC-019 — Vision Intelligence v2
- **Status:** Planned.
- **Scope (keep):** Closet Scan · Duplicate Detection · Assisted Outfit
  Recognition.
- **Deferred:** Laundry Detection (see Parking Lot).
- **Reason:** extends the Vision Engine (RFC-002) into wardrobe capture + assisted
  logging; laundry detection is a nice-to-have that can follow.
- **Potential Version:** v2.0.

---

## Parking Lot

Deliberately deferred — plausible later, not now.

### RFC-016 — Calendar Intelligence
- **Status:** Parked (cancelled from the active roadmap).
- **Reason:** **low ROI for a single-user application** — calendar-driven planning
  adds integration cost without proportional value for one owner. Travel
  Intelligence (RFC-017) covers the highest-value "plan for an event" need.
- **Potential Version:** revisit at v2.x+ only if a compelling single-user case
  emerges.

### RFC-020 — Cross-Engine Orchestration
- **Status:** Parked (cancelled).
- **Reason:** **architecture already sufficient** — the Intelligence Orchestrator
  (RFC-005) already resolves capability dependencies, plans execution, isolates
  failures, and returns one `ExecutionReport`. No separate orchestration RFC is
  warranted.
- **Potential Version:** n/a (superseded by RFC-005).

### RFC-021 — Long-Horizon Planning & Multi-Step Reasoning
- **Status:** Parked (cancelled).
- **Reason:** **capabilities absorbed into Runtime, Personalization, and the
  Orchestrator** — AI Runtime v2 (RFC-014, capability routing + policies),
  Personalization Engine v2 (RFC-013, lifecycle/timeline/explore-exploit), and the
  Intelligence Orchestrator (RFC-005) together cover the higher-order reasoning
  this RFC would have introduced.
- **Potential Version:** n/a (absorbed).

### Laundry Detection (from Vision Intelligence v2)
- **Status:** Parked — deferred sub-capability of RFC-019.
- **Reason:** lower value than closet scan / outfit recognition; can follow once
  the core Vision v2 capture flow ships.
- **Potential Version:** v2.x (after RFC-019).

---

## Rejected

Won't be built — conflicts with the product's principles or offers low ROI for a
single-user product.

### Budget Planning
- **Status:** Rejected (removed from RFC-018 Shopping Intelligence).
- **Reason:** a single owner does not need a budgeting tool; cost-per-wear and
  Wardrobe ROI already give the useful money signal without budget tracking.
- **Potential Version:** none.

### Chrome / Browser Extension
- **Status:** Rejected.
- **Reason:** the screenshot / upload flows already cover the shopping use case;
  a browser extension is disproportionate maintenance for one user.
- **Potential Version:** none.

### Notification Engine
- **Status:** Rejected.
- **Reason:** no recurring push/notification surface for a single-user, in-app
  product; the Intelligence Center's "what to do next" covers prompting in-app.
- **Potential Version:** none.

_(See [PRODUCT_VISION.md](PRODUCT_VISION.md) "Rejected Ideas" for the broader list —
social features, community, fashion feed, AI deciding scores, model-specific
architecture.)_
