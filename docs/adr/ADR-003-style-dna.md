# ADR-003: Style DNA derived profiles

- **Status:** Accepted
- **Date:** 2026-07-07
- **Related:** [ADR-001](ADR-001-domain-layer.md), [ADR-002](ADR-002-recommendation-context.md)

## Context

Raw wardrobe items carry sparse, inconsistent metadata: a free-text colour, an
optional formality, some tags, maybe a material. Outfit scoring and
recommendations need richer, normalised signals — how warm a colour reads, how
formal a piece is, which seasons/occasions it suits, whether it's a "protected"
item that scuffs in the rain. If every engine re-derived these ad hoc from raw
fields, the logic would be duplicated, inconsistent between engines, and brittle
against missing data.

## Decision

Define **Style DNA** — a derived, structured style profile per item
(`src/domain/style-dna/StyleDNA.ts`). A pure `StyleDNAEngine` deterministically
turns a `StyleDNAItem` (the structural subset of a wardrobe item) into a
`StyleDNA` with sub-profiles:

- `color` (family, temperature, lightness, contrast, boldness, neutral)
- `texture` (family, fabric weight, care complexity)
- `weather` (per-season suitability, temp range)
- `occasion` (per-occasion suitability + best)
- `style` (primary/secondary, formality score, professionalism)
- `compatibility` (versatility, travel/commute friendliness, visual boldness,
  and a `protected` flag)

Downstream engines consume **Style DNA, not raw item fields**. Every item is
analysable — unmapped/sparse items fall back to safe defaults (e.g. unknown
category → `accessory` slot) rather than throwing.

## Consequences

- Scoring rules read normalised 0–10 signals instead of parsing free text, so
  colour/formality/season logic lives in one place and stays consistent across
  outfit scoring, generation, and health.
- Deterministic derivation keeps the domain layer pure (ADR-001) and feeds the
  recommendation context (ADR-002).
- Robust to missing data — the wardrobe is user-entered and patchy; "every item
  analyzable" avoids special-casing at every call site.
- Cost: DNA is heuristic, not ground truth (e.g. texture inferred from
  material/name). The heuristics are calibrated to the owner's wardrobe and may
  need tuning; because they're pure and tested, tuning is low-risk.
- Adding a new signal is a change in one engine, picked up everywhere.

## Alternatives considered

- **Compute signals inline in each scoring rule.** Duplication and drift between
  engines; hard to test in isolation. Rejected.
- **Persist derived attributes in the database.** Introduces migration/staleness
  problems (re-derive on every rule change) for values that are cheap to compute
  on the fly. Rejected — derive at read time.
- **Use an LLM to tag items.** Non-deterministic, costs money per item, and
  would put AI on the critical path of core scoring — precisely what ADR-005
  forbids. Rejected.
