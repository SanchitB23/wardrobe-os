# Decisions

A high-level summary of the major product and engineering decisions behind
Wardrobe OS. Each links to a full **Architecture Decision Record** in
[`docs/adr/`](docs/adr/), where the context, consequences, and alternatives are
recorded in detail.

## Engineering

- **Pure domain layer** ([ADR-001](docs/adr/ADR-001-domain-layer.md)) — all
  business logic lives in `src/domain/**` as pure, deterministic TypeScript with
  no React/Supabase/AI. Testable in isolation; reusable across surfaces.
- **Recommendation context snapshot**
  ([ADR-002](docs/adr/ADR-002-recommendation-context.md)) — engines score
  against one assembled, immutable `RecommendationContext` rather than fetching
  their own data. Keeps engines pure and deterministic.
- **Style DNA derived profiles** ([ADR-003](docs/adr/ADR-003-style-dna.md)) —
  normalise sparse item metadata into structured profiles once; downstream
  engines consume Style DNA, not raw fields.
- **Feature-first + service/repository split** ([ARCHITECTURE.md](ARCHITECTURE.md))
  — one-directional layering: components → hooks → services → repositories →
  Supabase. Components hold no business logic and never touch Supabase.

## AI

- **Vendor-neutral AI provider abstraction**
  ([ADR-004](docs/adr/ADR-004-ai-provider-abstraction.md)) — the app depends on
  `AIService`, not a vendor SDK. Gemini is implemented; swapping/adding providers
  is a change in the composition root. Keys stay server-side.
- **AI explains, never decides** ([ADR-005](docs/adr/ADR-005-ai-does-not-decide.md))
  — the defining product rule. AI must **never** be the source of truth for
  scoring, eligibility, hard filtering, wardrobe health, recommendation ranking,
  cost-per-wear, or purchase decisions. AI may explain, converse, summarise,
  interpret, and (future) understand images.
- **AI response cache** ([ADR-006](docs/adr/ADR-006-ai-cache.md)) — deterministic
  inputs make explanations cacheable; Supabase-backed with in-memory fallback,
  TTL, and force-refresh.
- **AI tool-calling architecture** ([ADR-007](docs/adr/ADR-007-ai-tool-calling.md))
  — the AI reaches wardrobe data only through JSON-schema tools that call
  services, never the database directly.

## Process

- **Release versioning & discipline**
  ([ADR-008](docs/adr/ADR-008-release-versioning.md)) — SemVer phases (v0.1 →
  v1.0), Keep a Changelog, and a fixed release checklist (tests green → update
  VERSION/CHANGELOG/ROADMAP → commit → annotated tag).
