# Product Backlog

The forward-looking backlog, organised by **epic** and mapped to roadmap phases
([ROADMAP.md](../../ROADMAP.md)). Each backlog item reserves an **RFC number**;
every major item must have an approved RFC ([docs/rfc/](../rfc/README.md)) before
implementation begins.

**RFC numbers are permanent and sequential** — claim the next free one here when
starting an RFC. Reserved so far: **RFC-001 … RFC-014**.

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
| RFC-001 | Buy vs Skip | Not started |
| RFC-002 | Duplicate Detection | Not started |
| RFC-003 | Gap Analysis | Not started |
| RFC-004 | Wishlist | Not started |
| RFC-005 | Price Tracking | Not started |
| RFC-006 | Credit Card Optimization | Not started |

## Epic 2 — Vision AI (v0.8)

Image understanding to enrich the wardrobe. Vision extracts signals; those still
feed the deterministic engines.

| RFC | Title | Status |
| --- | --- | --- |
| RFC-007 | Closet Photo Recognition | Not started |
| RFC-008 | Shopping Screenshot Understanding | Not started |
| RFC-009 | Outfit Recognition | Not started |
| RFC-010 | Auto Add Item | Not started |

## Epic 3 — Travel Engine (v0.9)

Trip-scoped capsule generation built on the outfit and recommendation engines.

| RFC | Title | Status |
| --- | --- | --- |
| RFC-011 | Packing Engine | Not started |
| RFC-012 | Weather Integration | Not started |
| RFC-013 | Laundry Planning | Not started |
| RFC-014 | Trip Capsule Wardrobe | Not started |

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
