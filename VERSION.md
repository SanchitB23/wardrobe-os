# Version

## Current: v2.3.0 — Item Relations Editor & Status Page

- **Version:** v2.3.0
- **Release name:** Wardrobe OS 2.3.0 — Item Relations Editor & Status Page
- **Status:** Stable (minor on Lifestyle Intelligence Platform)
- **Date:** 2026-07-12

### What this release is

Makes occasions, materials, and seasons editable across the product for the
first time (RFC-026: item form, deterministic occasion suggestions, bulk
actions), ships a read-only `/status` page with live AI wiring, service
health, and budget state replacing the stale hardcoded About card (RFC-028),
tightens similar-item detection with a color-family gate (RFC-025 Amendment
A), and polishes wear logging with item previews and Quick Log UX (RFC-023
follow-up).

### Included

1. **Item Relations Editor** — RFC-026 (`src/domain/inventory-relations`,
   score-preserving diff saves, Suggest, bulk occasion/material actions)
2. **Status Page** — RFC-028 (`/status`, `src/domain/status`, manual probes
   through the budget guard)
3. **Similar-item color-family gate** — RFC-025 Amendment A
4. **Wear-log item preview & Quick Log UX** — RFC-023 follow-up

### Prior release

See [v2.2.0](docs/releases/v2.2.0.md) — Catalog Review v2.
