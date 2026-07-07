# Roadmap

Wardrobe OS ships in versioned phases. Each phase adds a coherent capability and
follows the release discipline in [CONTRIBUTING.md](CONTRIBUTING.md). The guiding
rule throughout: **deterministic engines first, AI explanation second.**

Legend: ✅ shipped · 🚧 current · 🔜 planned

| Version | Name | Status | Theme |
| --- | --- | --- | --- |
| v0.1 | Inventory | ✅ | Catalogue what you own |
| v0.2 | Visual Inventory | ✅ | Images, bulk import, rich item pages |
| v0.3 | Analytics | ✅ | Health, usage, cost, insights |
| v0.4 | Outfit Engine | ✅ | Build + score outfits |
| v0.5 | Recommendation Engine | ✅ | Generate + rank outfits |
| **v0.6** | **AI Stylist Beta** | **🚧 current** | **Explain + converse via AI** |
| v0.7 | Acquisition Engine | 🔜 | What to buy next |
| v0.8 | Vision AI | 🔜 | Understand item photos |
| v0.9 | Packing / Travel Engine | 🔜 | Trip-scoped capsules |
| v1.0 | Wardrobe OS Stable | 🔜 | Hardened, complete |

---

### v0.1 — Inventory ✅
Database schema and core item CRUD. Catalogue items with categories, colours,
formality, and metadata.

### v0.2 — Visual Inventory ✅
Image upload (primary + thumbnails + delete), bulk JSON import, item detail
pages, and an advanced, filterable inventory table.

### v0.3 — Analytics ✅
Dashboard analytics, the **Wardrobe Health Engine**, **Usage Analytics Engine**,
**Purchase / cost-per-wear** tracking, and the **Insight Center**.

### v0.4 — Outfit Engine ✅
Outfit builder plus the deterministic **Outfit Scoring Engine** (colour,
formality, season, occasion, texture, weather, footwear rules).

### v0.5 — Recommendation Engine ✅
**Outfit Generation Engine** and the **Unified Recommendation Engine** that ranks
saved and generated outfits together, surfaced in the Recommendation Center.

### v0.6 — AI Stylist Beta 🚧
Vendor-neutral **AI infrastructure**, **Gemini** provider, **recommendation
explanations**, a durable **AI response cache**, the **AI Playground**, the
**tool-calling architecture**, and the streaming **AI Stylist Chat**. AI explains
and converses on top of the deterministic engines.

### v0.7 — Acquisition Engine 🔜
Deterministic buy/skip guidance from wardrobe gaps, duplicates, and
cost-per-wear. AI explains the recommendation; the engine decides it.

### v0.8 — Vision AI 🔜
Image understanding: derive colour/texture/category signals from item photos to
enrich Style DNA (still feeding deterministic engines).

### v0.9 — Packing / Travel Engine 🔜
Trip-scoped capsule generation (destination, duration, weather, occasions) built
on the outfit and recommendation engines.

### v1.0 — Wardrobe OS Stable 🔜
Hardening pass: polish, performance, coverage, and documentation for a stable
release.
