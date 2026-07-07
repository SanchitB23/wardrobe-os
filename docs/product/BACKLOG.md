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
- **RFC-001 — Buy vs Skip** (Acquisition) — Implemented.
- **RFC-002 — Vision Engine** (Vision foundation) — Implemented. The universal
  computer-vision capability that produces one standardized `VisionAnalysis`;
  the other Vision items below consume it.
- **RFC-003 — Shopping Screenshot Understanding** (Vision / Acquisition) —
  Draft. Screenshot → `VisionAnalysis` → `ProspectiveItemCandidate` →
  Buy vs Skip verdict.

Guiding principle (unchanged): **deterministic engines decide, AI explains.** New
capabilities should be solved with a domain engine first; AI is layered on for
explanation/conversation only. See [DECISIONS.md](../../DECISIONS.md) and
[ADR-005](../adr/ADR-005-ai-does-not-decide.md).

---

## Epic 1 — Acquisition Engine (v0.7)

Turn wardrobe gaps, duplicates, and cost-per-wear into deterministic buy/skip
guidance. AI explains the advice; the engine decides it.

| RFC | Title | Status |
| --- | --- | --- |
| [RFC-001](../rfc/RFC-001-Acquisition-Engine-Buy-vs-Skip.md) | Buy vs Skip | Implemented (pending release) |
| _(TBD)_ | Duplicate Detection | Not started |
| _(TBD)_ | Gap Analysis | Not started |
| _(TBD)_ | Wishlist | Not started |
| _(TBD)_ | Price Tracking | Not started |
| _(TBD)_ | Credit Card Optimization | Not started |

## Epic 2 — Vision AI (v0.8)

Image understanding to enrich the wardrobe. The **Vision Engine** is the
universal capability: it turns any image into one standardized `VisionAnalysis`;
every other Vision item consumes that output. Vision perceives/proposes; the
deterministic engines still decide.

| RFC | Title | Status |
| --- | --- | --- |
| [RFC-002](../rfc/RFC-002-Vision-Engine.md) | Vision Engine (foundation → `VisionAnalysis`) | Implemented (pending release) |
| [RFC-003](../rfc/RFC-003-Shopping-Screenshot-Understanding.md) | Shopping Screenshot Understanding | Draft |
| _(TBD)_ | Closet Photo Recognition | Not started |
| _(TBD)_ | Outfit Recognition | Not started |
| _(TBD)_ | Auto Add Item | Not started |

## Epic 3 — Travel Engine (v0.9)

Trip-scoped capsule generation built on the outfit and recommendation engines.

| RFC | Title | Status |
| --- | --- | --- |
| _(TBD)_ | Packing Engine | Not started |
| _(TBD)_ | Weather Integration | Not started |
| _(TBD)_ | Laundry Planning | Not started |
| _(TBD)_ | Trip Capsule Wardrobe | Not started |

## Epic 4 — Wardrobe OS Stable (v1.0)

Hardening pass toward a stable release. These are tracked as workstreams; some
may not need full RFCs, but any that changes architecture or adds a feature does.

- **Stability** — error handling, edge cases, resilience.
- **Performance** — query/rendering performance, bundle size, caching.
- **Polish** — UX consistency, empty/loading/error states, accessibility.
- **Release readiness** — coverage, docs, and the release checklist
  ([ADR-008](../adr/ADR-008-release-versioning.md)).

---

### Status legend

`Not started` → `RFC drafting` → `RFC approved` → `In progress` → `Done`

When you begin an item, author its RFC from
[docs/rfc/TEMPLATE.md](../rfc/TEMPLATE.md), set this row to `RFC drafting`, and
keep the RFC's own `Status:` header as the detailed source of truth.
