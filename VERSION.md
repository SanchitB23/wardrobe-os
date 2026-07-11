# Version

## Unreleased — Acquisitions product hub

Product rename Shopping → **Acquisitions** (`/acquisitions` hub: wishlist,
decision history, timeline, ROI, shopping history). Shopping Intelligence
(RFC-018) remains at `/acquisitions/intelligence`. Schema documented in
`docs/migrations/acquisitions-product-experience.sql` (applied 2026-07-12 to
Wardrobe). Not a version bump.

## Current: v1.1.0 — Intelligence Refinement

- **Version:** v1.1.0
- **Release name:** Wardrobe OS 1.1.0 — Intelligence Refinement
- **Status:** Stable (RFC-011 … RFC-015)

### What this release is

The **v1.1 Intelligence Refinement + Runtime** release. It sharpens the
deterministic engine stack and turns the AI layer into a runtime — the engines
still decide, AI still only explains (ADR-005). Five RFCs:

- **Weather Runtime (RFC-011)** — a provider-agnostic weather source
  (`src/runtime/weather`). Recommendation consumes a normalized `WeatherSnapshot`;
  a first-class Orchestrator `weather` capability; in-memory cache + metrics;
  seasonal fallback the AI explains; inspector at `/developer/weather`.
- **Recommendation Engine v2 (RFC-012)** — multi-objective, weather- &
  personalization-aware scoring; hard-constraint eligibility; diversity
  reranking; full explainability + per-run quality metrics
  (`src/domain/recommendation/v2`).
- **Personalization Engine v2 (RFC-013)** — preference lifecycle
  (core/emerging/declining/avoided), re-derivable timeline + evolution, sharper
  stability, and an explore/exploit control feeding recommendation
  (`src/domain/personalization/v2`).
- **AI Runtime v2 (RFC-014)** — capability-centric routing behind declarative
  provider policies (primary → fallback + retry), benchmarking, prompt
  versioning, and latency/cost metrics (`src/runtime/ai`); inspector at
  `/developer/ai-runtime`.
- **Intelligence Center (RFC-015)** — aggregates every deterministic engine into
  one deduplicated, impact-ranked list of typed actions ("what to do next";
  `/intelligence`, "Do this next" on Today, `getTopActions` stylist tool;
  `src/domain/intelligence`).

No schema changes across the release. 480 unit tests green. See
[CHANGELOG.md](CHANGELOG.md) and [ROADMAP.md](ROADMAP.md).

### Prior releases

- **v1.0.2 — Access Guard** (2026-07-09): RFC-010 application access guard
  (single shared code; HMAC cookie; not authentication).
- **v1.0.1 — Stabilization** (2026-07-09): RFC-009 quality pass (performance,
  accessibility, DX, resilience; no new features).
- **v1.0.0 — One Assistant** (2026-07-08): the Today home, Intelligence
  Orchestrator, Lifestyle & Personalization engines, RFC-008 hardening.

### What this release is

The v1.0 cohesion release. Every capability from v0.6–v0.9 already existed as a
separate, powerful module; **1.0 makes them feel like a single daily assistant.**
RFC-007 adds no new engines and no new AI — it introduces the **Today** home that
composes existing deterministic outputs, finalizes the navigation IA, ships real
Settings + About surfaces, and moves developer tooling behind a gated Developer
Mode. Underneath it, the deterministic engine stack is complete: the Intelligence
Orchestrator composes the engines, and the Lifestyle Engine plans trips across a
time horizon. AI still only explains and converses; it never decides.

### Included modules

**Foundation & Inventory**

- Database schema (Supabase Postgres + Storage)
- Inventory CRUD + advanced filters
- Image upload (primary / thumbnails / delete)
- Bulk JSON import
- Item detail pages

**Analytics**

- Dashboard analytics
- Wardrobe Health Engine
- Usage Analytics Engine
- Purchase / cost-per-wear tracking
- Insight Center

**Outfits & Recommendations**

- Outfit Builder
- Outfit Scoring Engine
- Outfit Generation Engine
- Unified Recommendation Engine
- Recommendation Center

**AI Stylist**

- AI Infrastructure (vendor-neutral provider abstraction)
- Gemini Provider (text + vision)
- AI Recommendation Explanation
- AI Response Cache (Supabase-backed, TTL, force-refresh)
- AI Playground (`/ai/playground`)
- AI Tool Calling Architecture (registry / executor / router + wardrobe tools)
- AI Stylist Chat (`/chat`) — streaming, tool-calling, session-only memory

**Acquisition & Vision**

- Acquisition Engine — Buy vs Skip (RFC-001, `/acquisition/advisor`)
- Vision Engine (RFC-002, `src/domain/vision` + `GeminiVisionProvider`)
- Shopping Screenshot Understanding (RFC-003, `/acquisition/screenshot`)

**Intelligence**

- Personalization Engine (RFC-004) — derives `UserPreferenceProfile` from
  behaviour with per-preference confidence + stability.
- Intelligence Orchestrator (RFC-005, `src/domain/orchestrator`) — deterministic
  composition layer: dependency resolution, failure isolation, one
  `ExecutionReport`.

**Lifestyle**

- Lifestyle Engine (RFC-006, `src/domain/lifestyle`) — deterministic trip
  planning (`TripPlan` / `PackingPlan` / `LaundryPlan` / `ShoppingPlan`) through
  the orchestrator, behind a vendor-neutral `WeatherProvider`. Surfaced at
  `/lifestyle/trip`.

**Product Experience (new in v1.0.0 — RFC-007)**

- **Today** (`/`) — the default assistant-style home; composes existing engine
  output into widgets (Today's Outfit, Insight, Ask Stylist, Shopping
  Suggestions, Wardrobe Health, Quick Actions, Recent Activity).
- Finalized navigation IA (Acquisition folded into Stylist; dev tools gated).
- Settings — sectioned Profile / Preferences / AI Runtime / Appearance /
  Developer Mode / About.
- About (`/about`) — release, architecture, provider wiring, credits, links.
- Developer Mode hub (`/developer`) — gated Playground + planned dev tools.
- Accessibility / performance / release-readiness polish.

**Completed engines to date:** Database · Inventory · Outfit Engine · Analytics
Engine · Recommendation Engine · AI Platform · AI Stylist · Acquisition Engine ·
Vision Engine · Shopping Screenshot Understanding · Personalization Engine ·
Intelligence Orchestrator · Lifestyle Engine.

### Cutting the release

This is a **Release Candidate** on `main`. Per the release checklist
([CLAUDE.md](CLAUDE.md) §13), the formal cut still needs: bump `version` in
`package.json` to `1.0.0`, confirm `npm test` green, and create the annotated
tag `v1.0.0`. See [CHANGELOG.md](CHANGELOG.md) and [ROADMAP.md](ROADMAP.md).
