# Version

## Current: v0.6.0 — AI Stylist Beta

- **Version:** v0.6.0
- **Release name:** AI Stylist Beta
- **Release date:** 2026-07-07
- **Status:** Beta

### What this release is

The first release where Wardrobe OS talks back. On top of the deterministic
recommendation stack from v0.5, this adds a full AI layer — provider
abstraction, Gemini integration, response caching, tool calling, and a
streaming natural-language stylist chat — while keeping every decision in the
pure domain engines. AI explains and converses; it never decides.

### Included modules

**Foundation & Inventory**
- Database schema (Supabase Postgres + Storage)
- Inventory CRUD
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

**AI Stylist (new in v0.6.0)**
- AI Infrastructure (vendor-neutral provider abstraction, orchestrator)
- Gemini Provider
- AI Recommendation Explanation
- AI Response Cache (Supabase-backed, TTL, force-refresh)
- AI Playground (`/ai/playground`)
- AI Tool Calling Architecture (registry / executor / router + 8 wardrobe tools)
- AI Stylist Chat (`/chat`) — streaming, tool-calling, session-only memory

### Next planned version

**v0.7.0 — Acquisition Engine**: turn wardrobe gaps + cost-per-wear signals into
deterministic buy/skip guidance (AI explains the advice, does not decide it).
See [ROADMAP.md](ROADMAP.md).
