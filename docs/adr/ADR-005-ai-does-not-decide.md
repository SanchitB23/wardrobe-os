# ADR-005: AI explains, never decides

- **Status:** Accepted
- **Date:** 2026-07-07
- **Related:** [ADR-001](ADR-001-domain-layer.md), [ADR-004](ADR-004-ai-provider-abstraction.md)

## Context

LLMs are attractive for outfit advice, but they are non-deterministic, cost
money per call, can be unavailable, and can hallucinate. If the AI made product
decisions — which outfit to recommend, what score to give, what's healthy —
then core behaviour would become untestable, unreproducible, potentially wrong,
and impossible to run offline or without a key. We still want natural-language
value (explanations, summaries) on top of our deterministic engines.

## Decision

**AI only explains or summarises data that a deterministic domain engine has
already computed. It never makes a decision.**

AI must **never** be the source of truth for:

- scoring
- eligibility
- hard filtering
- wardrobe health
- recommendation ranking
- cost-per-wear
- purchase decisions

AI **may** be used for:

- explanation
- natural-language conversation
- summarization
- interpretation
- future vision / image understanding

Given that:

- All decisions — recommendations, outfit scores, wardrobe health, insights —
  are produced by pure domain engines (ADR-001/002/003). The AI is never on that
  path.
- AI features take **already-computed, curated inputs** and produce prose. The
  recommendation-explanation prompt receives only the recommendation, its
  analysis, and short health/insight/weather/commute summaries — **never the raw
  wardrobe** — and the system prompt instructs the model to *explain, not
  re-decide, and not invent items or facts*.
- Output is **structured and validated** against a `ResponseSchema` before use;
  invalid output is a handled error, not silent data.
- The app remains fully functional with AI disabled/unavailable — explanations
  are additive.

## Consequences

- Core behaviour stays deterministic, testable, and reproducible; the LLM can't
  change a score or a ranking.
- Prompts are cheap and safe (small curated payloads, no wardrobe dumps), and
  the deterministic inputs make responses cacheable by a stable key (ADR-006).
- Graceful degradation: a provider outage or invalid response degrades the
  explanation UI only, never the recommendations themselves.
- Trust/safety: the model can't surface items or claims not present in the input.
- Cost/limitation: explanations can still be generic or occasionally fail schema
  validation — acceptable because they are non-critical and validated.

## Alternatives considered

- **LLM-driven recommendations/scoring.** Non-deterministic, expensive on the
  hot path, hard to test, and prone to hallucinating items the user doesn't own.
  Rejected — this is the decision this ADR exists to forbid.
- **Free-text AI output rendered directly.** No validation; malformed or unsafe
  content reaches the UI. Rejected in favour of schema-validated structured
  output.
- **Send the full wardrobe as context "for better answers".** Larger cost, worse
  privacy, and more hallucination surface, with little benefit over curated
  summaries. Rejected.
