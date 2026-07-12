# Version

## Current: v2.2.0 — Catalog Review v2

- **Version:** v2.2.0
- **Release name:** Wardrobe OS 2.2.0 — Catalog Review v2
- **Status:** Stable (minor on Lifestyle Intelligence Platform)
- **Date:** 2026-07-12

### What this release is

Upgrades Import Review into **Catalog Review** (RFC-024): metadata-aware
duplicate detection, similar-item classification, completeness sections,
dismissals / reviewed flags, and a deterministic catalog quality score — without
changing default retire cleanup or hard-delete confirmation.

### Included

1. **Catalog Review domain** (`src/domain/catalog-review`)
2. **UI** at `/inventory/review` (route unchanged; UX renamed)
3. **Additive schema** — dismissals + item reviewed state
4. **Regression tests** for color-aware false-positive prevention

### Prior release

See [v2.1.0](docs/releases/v2.1.0.md) — Wear Logs, Acquisitions Pipeline &
Observability.
