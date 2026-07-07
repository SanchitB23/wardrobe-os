# Wardrobe OS — Product

Wardrobe OS is a personal wardrobe operating system: catalogue what you own,
understand how you use it, decide what to wear, and decide what to buy — backed
by deterministic engines and explained (never decided) by AI.

## Philosophy

Three principles govern every feature:

1. **Business Logic owns decisions.** Every decision — scoring, eligibility,
   ranking, recommendations, buy/skip, wardrobe health, cost-per-wear, and
   (v0.9) preference derivation — lives in pure, deterministic domain engines.
   They are the single source of truth.
2. **AI owns explanation.** AI explains, summarises, converses, and (via the
   Vision Engine) perceives. It never computes or overrides a decision. Remove
   the AI layer and every number stays the same. See
   [ADR-005](docs/adr/ADR-005-ai-does-not-decide.md).
3. **Providers are interchangeable runtimes.** The specific model/vendor is an
   implementation detail behind a vendor-neutral interface. Text, vision, and
   (future) image-generation providers can be swapped, routed, and benchmarked
   without touching the engines. See
   [ADR-004](docs/adr/ADR-004-ai-provider-abstraction.md).

The through-line: **deterministic engines first, AI explanation second.**

## The decision boundary

```
Behaviour / wardrobe data
        ↓
Deterministic domain engines  ← own every decision (source of truth)
        ↓
AI layer (interchangeable providers)  ← explains / converses / perceives only
        ↓
User
```

Behaviour remains the single source of truth: preferences (v0.9) are
re-derived from behaviour, never hand-mutated or stored as their own editable
state.

## Status

**Completed:** Database · Inventory · Outfit Engine · Analytics Engine ·
Recommendation Engine · AI Platform · AI Stylist · Acquisition Engine · Vision
Engine · Shopping Screenshot Understanding.

**Current:** Personalization Engine (v0.9, RFC-004) — *In Progress*.

See [ROADMAP.md](ROADMAP.md) for the full phase plan and
[docs/product/BACKLOG.md](docs/product/BACKLOG.md) for the epic breakdown.

## Explicitly out of scope

Permanently removed — **low ROI for a single-user product**:

- **Chrome / Browser Extension** — upload flows cover the shopping use case.
- **Notification Engine** — no recurring push/notification surface.
