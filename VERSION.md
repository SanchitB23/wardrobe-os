# Version

## Current: v2.1.0 — Wear Logs, Acquisitions Pipeline & Observability

- **Version:** v2.1.0
- **Release name:** Wardrobe OS 2.1.0 — Wear Logs, Acquisitions Pipeline & Observability
- **Status:** Stable (minor on Lifestyle Intelligence Platform)
- **Date:** 2026-07-12

### What this release is

Ships the post–v2.0.1 product and ops wave:

1. **Ad-hoc Wear Logs & Outfit Promotion (RFC-023)** — log what you wore without
   creating a Saved Outfit; promote repeated combinations with confirmation.
2. **Acquisition-to-Inventory Pipeline (RFC-018C)** — Buy/Skip → wishlist →
   purchased → confirmed inventory (+ Decision History polish).
3. **Category Optimization (RFC-015A)** — guided Optimize workflow from the
   Intelligence Center.
4. **Logging & Observability (RFC-022 + audit follow-up)** — structured JSON
   logs, production AI via AIRuntime, developer hub surfaces (trace, graph,
   flags, runtime stats, replay).

Deterministic engines still decide; AI explains. Never auto-creates inventory or
auto-promotes outfits.

640 unit tests green. See [CHANGELOG.md](CHANGELOG.md),
[docs/releases/v2.1.0.md](docs/releases/v2.1.0.md), and [ROADMAP.md](ROADMAP.md).

### Prior releases

- **v2.0.1 — Inventory Image Intelligence** (2026-07-12): RFC-020 primary image →
  VisualStyleAttributes → Accept → StyleDNA gap-fill.
- **v2.0.0 — Vision and Acquisitions Intelligence** (2026-07-12): Trip Planner,
  Shopping / Acquisitions Intelligence, Vision Intelligence v2.
- **v1.1.0 — Intelligence Refinement** (2026-07-10): RFC-011 … RFC-015
  (Weather Runtime, Recommendation v2, Personalization v2, AI Runtime v2,
  Intelligence Center).
- **v1.0.2 — Access Guard** (2026-07-09): RFC-010 application access guard.
- **v1.0.1 — Stabilization** (2026-07-09): RFC-009 quality pass.
- **v1.0.0 — One Assistant** (2026-07-08): Today home, Orchestrator, Lifestyle,
  RFC-008 hardening.

### Included modules (cumulative)

**Foundation & Inventory** — schema, CRUD, images, bulk import, filters,
visual StyleDNA from primary photos (RFC-020).

**Analytics & Intelligence** — health, usage, insights, Intelligence Center,
category optimization (RFC-015A).

**Outfits & Wear** — outfit builder/scorer, ad-hoc wear events + promotion
(RFC-023), legacy wear_logs dual-write.

**Recommendations & AI** — recommendation engine, AI Runtime, stylist,
structured logging / observability (RFC-022).

**Acquisition & Shopping** — Buy vs Skip, wishlist, acquisitions hub,
018B intelligence, 018C inventory handoff.

**Vision & Lifestyle** — vision workflows, trip planner, Today home.

### Schema notes for this release

Apply additive migrations if not already applied:

- `docs/migrations/RFC-018C-acquisition-to-inventory-pipeline.sql`
- `docs/migrations/RFC-023-ad-hoc-wear-logs.sql`

(Category optimization and logging are app-layer only.)
