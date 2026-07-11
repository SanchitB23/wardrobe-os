# Version

## Current: v2.0.1 — Inventory Image Intelligence

- **Version:** v2.0.1
- **Release name:** Wardrobe OS 2.0.1 — Inventory Image Intelligence
- **Status:** Stable (patch on Lifestyle Intelligence Platform)
- **Date:** 2026-07-12

### What this release is

Closes the owned-item photo → StyleDNA loop left open after v2.0.0. **RFC-020
Inventory Image Intelligence** analyzes each item's primary image via the
existing Vision Engine (RFC-002), stores reviewable `VisualStyleAttributes`, and
— only after explicit Accept — gap-fills StyleDNA / RecommendationContext.
Manual fields always win; Analyze never auto-accepts; primary image changes
mark attrs stale.

**Not a new Vision stack.** Perception stays in `analyzeImage` /
`analyzeImageRequest` / `/api/ai/vision`. RFC-019 workflows (closet scan /
outfit / duplicates) are unchanged.

566 unit tests green. See [CHANGELOG.md](CHANGELOG.md),
[docs/releases/v2.0.1.md](docs/releases/v2.0.1.md), and [ROADMAP.md](ROADMAP.md).

### Prior releases

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
**Inventory Image Intelligence** (RFC-020 visual attrs + Accept/Reject).

**Analytics** — dashboard, Wardrobe Health, Usage, purchases / CPW, Insights.

**Outfits & Recommendations** — builder, scoring, generation, Recommendation
Center; Recommendation Engine v2 + Personalization v2; accepted visuals merge
into StyleDNA before scoring.

**AI Stylist** — provider abstraction, Gemini + optional OpenAI, explanations,
cache, playground, tool-calling chat, AI Runtime v2 (cost-aware routing).

**Acquisition & Vision** — Buy vs Skip, Vision Engine, shopping screenshots,
Shopping Intelligence, Acquisitions hub + Intelligence (018B), Vision
Intelligence v2 (scan / review), Inventory Image Intelligence (enrichment).

**Lifestyle** — Lifestyle Engine + Trip Planner (`/trips`), Weather Runtime.

**Product Experience** — Today, Settings, About, Access Guard, Developer Mode,
Intelligence Center.

### Cutting the release

Per [CLAUDE.md](CLAUDE.md) §13: `package.json` → `2.0.1`, `npm test` green,
annotated tag `v2.0.1`. See [CHANGELOG.md](CHANGELOG.md).
