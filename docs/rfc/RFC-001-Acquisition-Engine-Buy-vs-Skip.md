# RFC-001: Acquisition Engine — Buy vs Skip

Status: Implemented
Owner: Sanchit Bhatnagar
Author: ChatGPT
Target Release: v0.7.0
Epic: Acquisition Engine
Priority: Critical
Effort: XL
Dependencies:
- StyleDNAEngine (`src/domain/style-dna`) — existing
- OutfitEngine `evaluateOutfit` → `OutfitAnalysis` (`src/domain/outfit`) — existing
- OutfitGenerationEngine `generateOutfits` (`src/domain/generation`) — existing
- WardrobeHealthEngine → `WardrobeHealth` (gaps, duplicates) (`src/domain/analytics`) — existing
- UsageAnalyticsEngine → `UsageAnalytics` (`src/domain/analytics`) — existing
- RecommendationContext builder (`src/domain/recommendation`) — existing, reused for wardrobe snapshot
- AI explanation layer (`src/ai`) — existing; used for explanation only, and only after the deterministic engine ships

---

## 1. Problem Statement

Wardrobe OS helps manage the existing wardrobe, analyse usage, generate outfits,
and recommend what to wear. It does **not** yet help decide whether a *new* item
should be bought.

Today that decision is manual and scattered across shopping apps, screenshots,
mental notes about wardrobe gaps, half-remembered duplicates, price, expected
usage, and style fit. The result is decision fatigue and, worse, accidental
duplicates and low-use purchases that drag down wardrobe efficiency (the Usage
and Health engines already show ~24% of the current wardrobe is rarely worn).

The user needs a fast, consistent, explainable answer to a single question:
**should I buy this, or skip it?**

## 2. Goals

- Provide a **deterministic** "Buy vs Skip" decision-support system that scores a
  prospective item against the existing wardrobe.
- Produce a single, explainable `BuyVsSkipAnalysis`: a `buy | consider | skip`
  decision, a 0–100 score, a confidence, a per-dimension breakdown, concrete
  reasons to buy/skip, similar existing items, and potential outfits.
- Reuse the existing deterministic engines (StyleDNA, Outfit, Health, Usage) as
  the sources of truth — Buy vs Skip is a **composition**, not new taste.
- Keep the core principle intact: **AI explains, engines decide.** The score is
  100% deterministic; AI is only layered on later to narrate the result.
- Support **manual entry** of a prospective item as the first input mode.
- Be reproducible and fully unit-testable (pure domain engine, injected time).

## 3. Non-Goals

Explicitly out of scope for RFC-001:

- **Vision AI** — parsing a shopping screenshot / product image into a
  prospective item. (Future: RFC-008 or later; §13.)
- **Price tracking** — monitoring price over time / deal alerts. (Future: RFC-005.)
- **Wishlist persistence** — saving analyses to a durable wishlist. (Future: a
  Wishlist RFC — number TBD; noted as a hook in §13, not built here.)
- **Credit card / payment optimization.** (Future: RFC-006.)
- **URL scraping** — auto-filling item details from a product URL. The input
  model *accepts* an optional URL, but RFC-001 does not fetch or parse it.
- **Any AI decision-making.** AI does not compute or adjust the score.
- **New DB schema.** RFC-001 designs the engine; persistence is deferred (§8).

## 4. User Stories

- As the wardrobe owner, when I'm about to buy something, I want to enter its
  details and get a clear **buy / consider / skip** verdict with a score, so I
  can decide in seconds instead of agonising.
- As the owner, I want to see **why** — which existing items it duplicates, what
  gap it fills, and how many good outfits it unlocks — so I trust the verdict.
- As the owner, I want to be warned when an item is a **near-duplicate** of
  things I already own and rarely wear, so I stop over-buying the same thing.
- As the owner, I want the verdict to respect **my** style (modern tech
  professional, smart-casual, minimal premium basics, sneakers-first), not
  generic fashion advice.
- As the owner, I want an optional **plain-language explanation** of the verdict
  (later), but I always want the deterministic score to be the source of truth.

## 5. UX Flow

Future surface under the **Acquisition** nav group (currently a disabled "Soon"
placeholder): route **`/acquisition/advisor`**.

1. **Entry** — user opens Advisor and fills a prospective-item form (§ Inputs).
   Only name + category are required; everything else improves confidence.
2. **Analyse** — user submits; the service builds the wardrobe context and runs
   `BuyVsSkipEngine`.
3. **Result** — a decision card shows:
   - the **decision** (`Buy` / `Consider` / `Skip`) + **score** (0–100) + a
     confidence indicator + one-line **summary**;
   - **Reasons to buy** and **Reasons to skip** lists, plus **trade-offs**;
   - an expandable **score breakdown** (the 8 dimensions, each with its sub-score
     and a short reason);
   - **Similar existing items** (what it overlaps with);
   - **Potential outfits** it could join (from existing items);
   - **estimated cost-per-wear**.
4. **Explain (later)** — an "Explain this verdict" button calls the AI layer to
   narrate the deterministic result (post-engine; §6 AI Layer).
5. **Save (future)** — an optional "Save to wishlist" action (future Wishlist RFC).

States: empty (no input yet), loading (analysing), result, and a low-confidence
banner when inputs are sparse. Desktop-first; dark-theme consistent.

### Inputs (manual, v1)

`ProspectiveItem`:
- `name` (required)
- `category` (required), `subcategory`
- `brand`
- `color`
- `estimatedPrice`
- `material` / fabric
- `styleTags[]`
- `formality`
- `intendedOccasions[]`
- `productUrl` (optional, not parsed in RFC-001)
- `notes` (optional)

Future input: shopping screenshot / image understanding → RFC-008+.

## 6. Architecture

Buy vs Skip is a **pure domain engine** that composes existing engines. It adds
no new taste; it orchestrates StyleDNA + Outfit + Health + Usage into one verdict.

### Domain Layer
- **`BuyVsSkipEngine`** (new) — `src/domain/acquisition/BuyVsSkipEngine.ts`.
  - Pure TypeScript. No React, no Supabase, no AI, no I/O. `generatedAt` injected.
  - `evaluateBuyVsSkip(input: BuyVsSkipInput, options?): BuyVsSkipAnalysis`.
  - Derives `StyleDNA` for the prospective item via `deriveStyleDNA` (it accepts
    a `StyleDNAItem`-shaped object, so a prospective item maps cleanly).
  - Computes the 8 decision dimensions (§ Decision model), each 0–10 + confidence.
  - Uses `evaluateOutfit` / `generateOutfits` to measure outfit compatibility
    against existing items.
  - Reads (does not recompute) `WardrobeHealth.gaps` / `.duplicates` and
    `UsageAnalytics` when present in the input snapshot.
  - Combines dimensions into a weighted 0–100 score and a `buy | consider | skip`
    decision with hard-override guards.
- **Types** — `src/domain/acquisition/types.ts`: `ProspectiveItem`,
  `BuyVsSkipInput`, `BuyVsSkipAnalysis`, `BuyVsSkipBreakdown`, `DecisionDimension`.

### Service Layer
_Not built in RFC-001 (design only)._ At implementation time:
- `src/features/acquisition/services/acquisition.service.ts` —
  `analyzeBuyVsSkip(item)` assembles the wardrobe snapshot (reuse the
  recommendation-context data path: wardrobe items → StyleDNA, plus health &
  usage analytics), calls `evaluateBuyVsSkip`, and returns `{ data, error }`.

### Repository Layer
_Not built in RFC-001._ No new persistence. Reuses existing read repositories
(inventory, analytics) to gather the wardrobe snapshot. Wishlist persistence is
out of scope (future Wishlist RFC).

### UI Layer
_Not built in RFC-001._ At implementation time: `src/features/acquisition/` with
a form + result view, a `useBuyVsSkip` hook, and the `/acquisition/advisor`
route. Enable the existing disabled "Advisor" nav item.

### AI Layer
- Deterministic engine ships **first**. AI is added **only after** as an
  explanation layer, mirroring the recommendation-explanation pattern
  ([ADR-005](../adr/ADR-005-ai-does-not-decide.md)):
  - a `buy-vs-skip-explanation` prompt builder + response schema (structured),
    fed the already-computed `BuyVsSkipAnalysis` (never the raw wardrobe),
    instructed to explain — not to change — the verdict;
  - reachable by the stylist chat as a future tool (e.g. `getBuyVsSkipAdvice`)
    via the tool-calling layer ([ADR-007](../adr/ADR-007-ai-tool-calling.md)).
- **AI never computes or edits the score, decision, or breakdown.**

## 7. Data Flow

```
UI form (ProspectiveItem)
  → useBuyVsSkip (hook)
    → acquisition.service.analyzeBuyVsSkip(item)      { data, error }
      → repositories: read wardrobe items + health + usage snapshot (Supabase)
      → map rows → StyleDNAItem[] + WardrobeHealth + UsageAnalytics
      → BuyVsSkipEngine.evaluateBuyVsSkip({ item, wardrobe, health, usage })   ← PURE
          • deriveStyleDNA(item)
          • score 8 dimensions vs wardrobe (uses evaluateOutfit / generateOutfits)
          • weighted composite → score, decision, confidence
      → BuyVsSkipAnalysis
  → result view renders decision + breakdown + similar items + outfits
  → (optional, later) "Explain" → /api/ai/... → AI narrates the analysis (no recompute)
```

The engine step is deterministic and side-effect-free; identical inputs +
`generatedAt` always yield the same analysis.

## 8. Data Model / Schema Impact

**No database schema changes in RFC-001.** The engine operates entirely on
in-memory inputs assembled from existing tables; the analysis is computed on
demand and not persisted.

Future (separate RFCs, called out here for planning only — **not** part of this
RFC):
- **Wishlist RFC (number TBD):** a `wishlist_items` table to persist prospective
  items and their latest `BuyVsSkipAnalysis`. Additive, RLS anon policy consistent
  with the rest of the app. Documented then, not now.

## 9. API / Domain Contracts

Illustrative TypeScript contracts (final names/shapes settled at implementation;
this defines the intent). Scores are 0–10 per dimension unless noted.

```ts
// src/domain/acquisition/types.ts  (design)

export interface ProspectiveItem {
  name: string;
  category: string;
  subcategory?: string | null;
  brand?: string | null;
  color?: string | null;
  estimatedPrice?: number | null;
  material?: string | null;
  styleTags?: string[];
  formality?: string | null;        // FormalityEnum
  intendedOccasions?: string[];
  productUrl?: string | null;       // accepted, not parsed in RFC-001
  notes?: string | null;
}

export interface BuyVsSkipInput {
  item: ProspectiveItem;
  /** Existing active wardrobe, as StyleDNA-derivable items. */
  wardrobe: StyleDNAItem[];
  /** Optional precomputed analytics (read, never recomputed here). */
  health?: WardrobeHealth;
  usage?: UsageAnalytics;
}

export type BuyDecision = "buy" | "consider" | "skip";

export interface DecisionDimension {
  score: number;        // 0–10 (see weighting for direction)
  confidence: number;   // 0–1
  reason: string;
}

export interface BuyVsSkipBreakdown {
  duplicateRisk: DecisionDimension;        // high = worse (inverse weight)
  gapFillValue: DecisionDimension;
  outfitCompatibility: DecisionDimension;
  usageProjection: DecisionDimension;
  costEfficiency: DecisionDimension;
  wardrobeHealthImpact: DecisionDimension;
  practicality: DecisionDimension;
  preferenceFit: DecisionDimension;
}

export interface BuyVsSkipAnalysis {
  decision: BuyDecision;
  score: number;                 // 0–100
  confidence: number;            // 0–1
  summary: string;
  scoreBreakdown: BuyVsSkipBreakdown;
  reasonsToBuy: string[];
  reasonsToSkip: string[];
  tradeoffs: string[];
  suggestedAlternatives: string[];
  similarExistingItems: { itemId: string; name: string; overlap: number }[];
  potentialOutfits: { itemIds: string[]; score: number }[];
  estimatedCostPerWear: number | null;
  metadata: {
    engineVersion: string;
    generatedAt: string;
    inputSource: "manual" | "url" | "image";
  };
}

export function evaluateBuyVsSkip(
  input: BuyVsSkipInput,
  options?: { generatedAt?: string },
): BuyVsSkipAnalysis;
```

### Decision model (deterministic)

Each dimension is scored 0–10 from wardrobe signals, then combined into a
weighted composite scaled to 0–100. `duplicateRisk` contributes **inversely**
(more duplication → lower buy score).

| Dimension | What it measures | Weight |
| --- | --- | --- |
| Gap Fill Value | Matches a known `WardrobeHealth.gaps` staple (category/color/formality). | 0.20 |
| Outfit Compatibility | # of high-quality outfits it forms with existing items (`generateOutfits`/`evaluateOutfit` with the item injected). | 0.20 |
| Usage Projection | Likely wear frequency vs current usage patterns for its category/occasions; penalise rare-use categories unless intended. | 0.15 |
| Duplicate Risk *(inverse)* | Overlap with existing items: same category + color family + formality + StyleDNA profile; weighted up if the overlaps are low-use. | 0.15 |
| Cost Efficiency | Estimated cost-per-wear (price ÷ projected wears) vs similar existing items. | 0.10 |
| Wardrobe Health Impact | Does it improve balance or worsen an over-represented category/color (`WardrobeHealth.duplicates`)? | 0.08 |
| Practicality | Delhi-NCR climate suitability, commute suitability, care complexity, fragility/protected risk (StyleDNA compatibility signals). | 0.07 |
| Preference Fit | Alignment with the owner's style direction (modern tech professional, smart-casual, minimal premium, sneakers-first, avoid over-formal). | 0.05 |

```
composite01 = Σ weightᵢ · contributionᵢ            // contribution ∈ [0,1]
              where duplicate contribution = 1 − (duplicateRisk / 10)
              and all others = dimensionScore / 10
score = round(composite01 · 100)
confidence = weighted mean of per-dimension confidence
             (dominated by how complete the input + wardrobe data are)
```

**Decision thresholds** (with guards):
- `score ≥ 70` → **buy**
- `45 ≤ score < 70` → **consider**
- `score < 45` → **skip**

**Hard-override guards** (deterministic, applied after thresholds):
- `duplicateRisk ≥ 8` → decision capped at **consider** (never **buy**); if the
  duplicates are also low-use → **skip**.
- `confidence < 0.35` → never **buy**; downgrade **buy**→**consider** and surface
  a "low confidence — add more detail" note.
- Missing price → `estimatedCostPerWear = null`, `costEfficiency` confidence 0
  (excluded from the confidence mean, weight redistributed proportionally).

Weights and thresholds are **tunables** (constants in the engine), calibrated on
the owner's wardrobe and adjustable with tests — same approach as the existing
Health/Outfit engines.

## 10. Acceptance Criteria

This RFC is **Approved-ready** when it defines all of the below (it does):

- [ ] A deterministic decision model: 8 dimensions, weights, composite formula,
      thresholds, and hard-override guards — no AI in the scoring path.
- [ ] Domain contracts: `ProspectiveItem`, `BuyVsSkipInput`, `BuyVsSkipAnalysis`
      (incl. `scoreBreakdown`, reasons, similar items, potential outfits,
      cost-per-wear, metadata), and `evaluateBuyVsSkip` signature.
- [ ] The UX flow for `/acquisition/advisor` (form → analyse → result → explain).
- [ ] Clear non-goals (Vision, price tracking, wishlist persistence, credit-card
      optimization, URL parsing, AI decisions, schema changes).
- [ ] A testing plan (below).
- [ ] Future extensions (below).

Implementation-time acceptance criteria (for the eventual build, tracked in that
PR — not this RFC):
- [ ] `evaluateBuyVsSkip` is pure and deterministic (same input ⇒ same output).
- [ ] Every `BuyVsSkipAnalysis` field is populated; `decision` respects the
      thresholds + guards.
- [ ] Near-duplicate low-use items never return `buy`.
- [ ] A clear gap-filling, versatile item returns `buy` with reasons citing the
      gap and the outfits it unlocks.
- [ ] Sparse input yields low confidence and no `buy`.
- [ ] AI (when added) only explains; removing AI leaves scores unchanged.

## 11. QA / Testing Plan

- **Unit tests (Vitest, pure engine)** — the core of QA:
  - Weighting + composite math (fixed inputs → expected score).
  - Threshold boundaries (44/45, 69/70) and each hard-override guard.
  - Duplicate detection (same category+color+formality+profile) → high
    `duplicateRisk` → capped decision.
  - Gap match against `WardrobeHealth.gaps` → high `gapFillValue`.
  - Outfit compatibility via injected wardrobe (item unlocks N outfits).
  - Cost-per-wear with and without price (null handling, confidence redistribution).
  - Determinism: same input + `generatedAt` ⇒ identical analysis.
  - Preference-fit: sneakers-first / avoid-over-formal reflected in scores.
- **Golden scenarios** — a small fixture wardrobe + a table of prospective items
  with expected decisions (buy/consider/skip) to guard calibration drift.
- **Service/UI (at implementation)** — service returns `{ data, error }`;
  preview verification of the Advisor form + result rendering.
- **AI (when added)** — the explanation is schema-validated and never alters the
  numbers; a fake-AI unit test asserts the deterministic analysis is unchanged.
- **Release gate** — `npm test` green before any tag ([ADR-008](../adr/ADR-008-release-versioning.md)).

## 12. Risks & Trade-offs

- **Calibration risk.** Weights/thresholds are heuristics tuned to one wardrobe;
  they may mis-rank. *Mitigation:* tunable constants + golden-scenario tests; the
  breakdown makes mis-scores debuggable.
- **Sparse input.** Manual entry may omit price/material/tags, weakening several
  dimensions. *Mitigation:* confidence gating + "add more detail" prompts; never
  `buy` on low confidence.
- **Usage projection is inherently predictive.** We infer future wear from past
  patterns for the *category/occasion*, not the item. *Trade-off:* accept
  category-level projection in v1; item-level learning is future work.
- **Outfit-compatibility cost.** Generating candidate outfits with the item
  injected can be expensive for large wardrobes. *Mitigation:* bound candidate
  generation (top-K per slot), like the existing generation engine.
- **Over-trusting the number.** A single score can feel authoritative.
  *Mitigation:* always show reasons + trade-offs + similar items, not just a score.
- **Scope creep toward Vision/price.** *Mitigation:* strict non-goals; those are
  their own RFCs.

## 13. Future Extensions

- **Wishlist (future RFC, number TBD):** persist prospective items + latest
  analysis; re-run when the wardrobe changes; "still worth buying?" checks.
- **RFC-005 Price Tracking:** feed live price into `costEfficiency`; alert when a
  `consider` item crosses a cost-per-wear threshold.
- **RFC-008 Shopping Screenshot Understanding / Vision:** populate
  `ProspectiveItem` from an image/screenshot (`inputSource: "image"`), then run
  the same engine unchanged.
- **URL enrichment:** parse `productUrl` to pre-fill fields (`inputSource: "url"`).
- **Stylist chat tool:** `getBuyVsSkipAdvice` so the chat can advise on a
  described item via the tool-calling layer.
- **Batch mode:** evaluate several prospective items (e.g. a cart) and rank them
  within a budget → ties into RFC-006.

## 14. Open Questions

1. **Weights & thresholds** — are the proposed weights and the 70 / 45 cut-offs
   right for the owner, or should they be user-adjustable settings?
2. **"Intended purchase" override** — if the user marks an item as intentional
   (e.g. a deliberate statement piece), how much should that relax the
   usage/duplicate penalties?
3. **Similar-item overlap metric** — exact definition of `overlap` (0–1): which
   StyleDNA facets and weights determine "similar"?
4. **Cost-per-wear horizon** — over what period do we project wears for the
   denominator (12 months? item lifetime?), and what default when usage data is
   thin?
5. **Confidence surfacing** — show a numeric confidence, or just a
   low/medium/high badge in the UI?
6. **Occasion taxonomy** — reuse the existing `OccasionKey` set from StyleDNA, or
   introduce an acquisition-specific list for `intendedOccasions`?
