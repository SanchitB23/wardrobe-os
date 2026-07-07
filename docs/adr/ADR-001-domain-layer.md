# ADR-001: Pure domain layer

- **Status:** Accepted
- **Date:** 2026-07-07

## Context

Wardrobe OS contains meaningful business logic — outfit scoring, wardrobe
health, usage analytics, recommendations. Early on this kind of logic tends to
get tangled into React components and Supabase queries, which makes it hard to
test (needs a DOM and a database), hard to reuse across surfaces, and hard to
reason about because side effects and rules live in the same place.

The app follows a feature-first layering: `components → hooks → services →
repositories`. We needed a home for business rules that is independent of all of
those layers.

## Decision

Keep all business logic in a **pure domain layer** under `src/domain/*`
(`outfit`, `recommendation`, `generation`, `analytics`, `style-dna`, `wardrobe`).

Rules for this layer:

- **No React, no Supabase, no Next.js, no AI SDKs, no `fetch`.** It is plain
  TypeScript over plain data. (Enforced by convention and reviewed by the
  `layering-reviewer` agent.)
- **Deterministic.** Any dependence on "now" is passed in explicitly (e.g.
  engines accept an injected `generatedAt` / `asOf`) rather than calling
  `Date.now()` internally, so the same inputs always produce the same output.
- **Engines expose a contract + a factory** (e.g. `StyleDNAEngine`,
  `recommendUnifiedOutfits`, `evaluateOutfit`) and operate on typed inputs.
- Services (in feature slices) do the I/O — fetch from repositories, map rows to
  domain inputs, call the domain engine, and return the result to hooks/UI.

## Consequences

- Domain logic is unit-testable with Vitest (`src/**/*.test.ts`) without a
  browser or database; the suite runs in seconds.
- The same engines power multiple surfaces (dashboard, recommendations,
  playground) with no duplication.
- Determinism makes outputs cacheable and snapshot-testable, and underpins
  ADR-006 (a deterministic recommendation ⇒ a stable cache key).
- Cost: an explicit mapping step in services (DB row → domain input). This is
  deliberate boilerplate that keeps the boundary clean.
- The domain layer must never "reach out" — new needs are satisfied by passing
  more data in, not by importing a client.

## Alternatives considered

- **Logic in services/hooks directly.** Faster to write initially, but couples
  rules to Supabase and React, blocks reuse, and forces integration-style tests
  for pure logic. Rejected.
- **Active-record / ORM models with behaviour.** Ties business rules to the
  persistence shape and to a live connection; the same determinism/testability
  problems. Rejected.
- **A separate published package.** Overkill for a single app; adds build and
  versioning friction with no consumer outside this repo. Deferred — the
  `src/domain` boundary already gives most of the benefit and could be extracted
  later if needed.
