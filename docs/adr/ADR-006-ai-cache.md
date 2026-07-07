# ADR-006: AI response cache

- **Status:** Accepted
- **Date:** 2026-07-07
- **Related:** [ADR-004](ADR-004-ai-provider-abstraction.md), [ADR-005](ADR-005-ai-does-not-decide.md)

## Context

AI explanations are the only paid, latency-heavy calls in the app. Because they
explain **deterministic** inputs (ADR-005), the same recommendation produces the
same explanation — so re-calling the provider for an unchanged input is wasted
money and time. This is a hobby project, so cost control matters. We also want a
durable cache that survives restarts, but the app must still work if that store
is unavailable, and we must be able to force a fresh answer on demand and to see
whether a response was cached.

## Decision

Add a cache layer in `src/ai/cache` behind the `AICache` interface, wired into
the orchestrator (ADR-004):

- **Deterministic key** — `buildAICacheKey({ promptBuilder, promptVersion,
  model, input })` hashes those four parts (pure, no crypto → bundle-safe). Same
  input ⇒ same key; any change (input, model, or a bumped prompt version) ⇒ new
  key.
- **Durable, with fallback** — `SupabaseAICache` persists to an `ai_cache` table
  (`response_json`, raw provider `metadata`, `created_at`, `expires_at`) and
  **transparently degrades to an in-memory cache** if the table/RLS is
  unavailable. `ai_cache` has RLS enabled with an `mvp_anon_all_ai_cache` policy
  to match this anon-key app.
- **The orchestrator checks the cache before the provider**, writes fresh
  responses with a TTL-derived `expires_at`, never returns expired entries, and
  sets `response.cached` so callers/UI can show hit vs miss.
- **TTL by use case** — recommendation explanations cache for **7 days**; the
  playground defaults to **no cache** unless explicitly enabled.
- **`forceRefresh`** bypasses a hit and overwrites the entry; surfaced in the UI
  as a "Regenerate" action.

## Consequences

- Repeat explanations for an unchanged recommendation are served without a
  Gemini call — the main cost/latency win.
- Correctness follows from determinism (ADR-005): a stale entry can only exist if
  the input genuinely changed, in which case the key changes and we miss.
- Resilience: a missing table or RLS error never breaks AI features; it silently
  falls back to in-memory.
- Observability: `cached` + `expires_at` make hit/miss and freshness visible in
  the UI and the playground.
- Cost: the table stores full response JSON + raw metadata; entries expire via
  `expires_at` (a periodic cleanup job can be added later — reads already ignore
  expired rows and best-effort delete them).
- Prompt-version discipline required: changing prompt text without bumping
  `promptVersion` would serve stale explanations. The version is folded into the
  key precisely to make bumps invalidate cleanly.

## Alternatives considered

- **No cache.** Simple, but pays for and waits on every identical explanation.
  Rejected on cost/latency.
- **In-memory only.** No dependency, but lost on every restart/deploy and not
  shared across instances. Kept only as the *fallback*, not the primary.
- **Hash the full prompt string as the key.** Works, but couples the key to
  incidental prompt formatting and misses the model dimension; the structured
  `{builder, version, model, input}` key is more precise and lets us invalidate
  by version. Rejected.
- **Cache-aside in the feature service instead of the orchestrator.** Every AI
  caller would reimplement keying/expiry/forceRefresh. Centralising in the
  orchestrator keeps callers trivial. Rejected.
