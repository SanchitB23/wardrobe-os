# Version

## Current: v2.0.0 — Vision and Acquisitions Intelligence

- **Version:** v2.0.0
- **Release name:** Wardrobe OS 2.0.0 — Vision and Acquisitions Intelligence
- **Status:** Stable (Lifestyle Intelligence Platform core)
- **Date:** 2026-07-12

### What this release is

The **v2.0 Lifestyle Intelligence Platform** cut: Wardrobe OS grows beyond the
closet into the contexts a wardrobe serves — **trips**, **continuous purchasing**,
and **practical vision workflows**. Engines still decide; AI still only explains
(ADR-005). Headline RFCs for this tag:

- **Trip Planner (RFC-017)** — first-class persisted trips at `/trips`.
- **Shopping Intelligence (RFC-018)** — wishlist priority, ROI, duplicates,
  strategy at `/acquisitions/intelligence`.
- **Acquisitions product hub** — Shopping → Acquisitions rename; flagship
  `/acquisitions` UX (wishlist, decisions, timeline, ROI, history).
- **Acquisitions Intelligence (RFC-018B)** — lifecycle, accuracy, opportunity,
  dynamic strategy on top of 018.
- **Vision Intelligence v2 (RFC-019)** — closet scan, assisted outfit
  recognition, visual duplicates, review queue at `/vision`.

Also folded into this major (post-v1.1 Unreleased): **OpenAI provider +
cost-first AI Runtime (RFC-014A)** and **Cost-Aware AI Runtime decision layer
(RFC-014B)**.

**Not in this release:** RFC-020 Inventory Image Intelligence remains **Draft**
(target v2.0.1).

559 unit tests green. See [CHANGELOG.md](CHANGELOG.md),
[docs/releases/v2.0.0.md](docs/releases/v2.0.0.md), and [ROADMAP.md](ROADMAP.md).

### Prior releases

- **v1.1.0 — Intelligence Refinement** (2026-07-10): RFC-011 … RFC-015
  (Weather Runtime, Recommendation v2, Personalization v2, AI Runtime v2,
  Intelligence Center).
- **v1.0.2 — Access Guard** (2026-07-09): RFC-010 application access guard.
- **v1.0.1 — Stabilization** (2026-07-09): RFC-009 quality pass.
- **v1.0.0 — One Assistant** (2026-07-08): Today home, Orchestrator, Lifestyle,
  RFC-008 hardening.

### Included modules (cumulative)

**Foundation & Inventory** — schema, CRUD, images, bulk import, filters.

**Analytics** — dashboard, Wardrobe Health, Usage, purchases / CPW, Insights.

**Outfits & Recommendations** — builder, scoring, generation, Recommendation
Center; Recommendation Engine v2 + Personalization v2.

**AI Stylist** — provider abstraction, Gemini + optional OpenAI, explanations,
cache, playground, tool-calling chat, AI Runtime v2 (cost-aware routing).

**Acquisition & Vision** — Buy vs Skip, Vision Engine, shopping screenshots,
Shopping Intelligence, Acquisitions hub + Intelligence (018B), Vision
Intelligence v2 (scan / review).

**Lifestyle** — Lifestyle Engine + Trip Planner (`/trips`), Weather Runtime.

**Product Experience** — Today, Settings, About, Access Guard, Developer Mode,
Intelligence Center.

### Cutting the release

Per [CLAUDE.md](CLAUDE.md) §13: `package.json` → `2.0.0`, `npm test` green,
annotated tag `v2.0.0`. See [CHANGELOG.md](CHANGELOG.md).
