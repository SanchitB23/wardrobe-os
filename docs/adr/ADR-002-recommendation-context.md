# ADR-002: Recommendation context snapshot

- **Status:** Accepted
- **Date:** 2026-07-07
- **Related:** [ADR-001](ADR-001-domain-layer.md), [ADR-003](ADR-003-style-dna.md)

## Context

Recommending and generating outfits needs a lot of heterogeneous data: the
active wardrobe, wear history/usage, purchase values, wardrobe health, user
preferences, current weather, commute profile, and existing saved outfits.
That data comes from several tables and several feature services.

If each recommendation engine fetched and shaped what it needed, the pure domain
layer (ADR-001) would be impossible to keep clean, engines would each re-derive
the same intermediate data, and behaviour would depend on wall-clock time and
live queries — untestable and non-deterministic.

## Decision

Introduce a single **`RecommendationContext`** — an assembled, read-only
snapshot of everything the recommendation/generation engines need
(`src/domain/recommendation/RecommendationContext.ts`):

```
wardrobe · usage · purchase · health · preferences · weather · commute · savedOutfits
```

- A pure builder, **`buildRecommendationContext(data, { generatedAt })`**, turns
  already-fetched domain inputs into the context. It takes an explicit
  `generatedAt` so all time math (days-since-worn, staleness) is deterministic.
- Engines — `recommendUnifiedOutfits(context, opts)`,
  `generateOutfits(context, …)` — take the **context**, never raw DB rows or a
  client.
- Feature services (`recommendations.service.ts`) own the I/O: fetch rows +
  analytics, map them, call the builder, then the engine.

## Consequences

- Engines are pure and deterministic: given a context, the ranking is fixed and
  fully unit-testable — the property ADR-006's cache relies on.
- One assembly point means consistent derived data (e.g. weather/commute
  snapshots) across every engine and across the debug/recommendation surfaces.
- The context is the natural seam for overrides — filters bias weather/commute
  before scoring without touching engine internals.
- Cost: the context is comparatively large and assembled per request; it is
  built once and shared by all engines in that request to amortise the work.
- The curated summaries the AI layer consumes (ADR-005) are derived from this
  context, so "no raw wardrobe to the model" is easy to honour.

## Alternatives considered

- **Engines fetch their own data.** Couples the domain layer to Supabase and
  re-derives shared intermediates; non-deterministic. Rejected (violates
  ADR-001).
- **Pass loose positional arguments to each engine.** Signatures explode as
  inputs grow, and callers assemble the same things repeatedly. Rejected.
- **A global mutable context/singleton.** Hidden coupling and test bleed between
  runs; breaks determinism. Rejected in favour of an explicit, immutable value
  passed in.
