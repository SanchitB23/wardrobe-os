# RFC-012: Recommendation Engine v2

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Claude (Opus 4.8)
Target Release: v1.1.0
Epic: Intelligence Refinement
Priority: Critical
Effort: XL
Dependencies:
- RecommendationContext + `buildRecommendationContext` (`src/domain/recommendation`) — existing; the immutable snapshot v2 scores against
- `recommendUnifiedOutfits` / `UnifiedOutfitRecommendationEngine` (`src/domain/recommendation`) — existing; the v1 engine v2 supersedes (kept as the fallback contract during migration)
- OutfitEngine `evaluateOutfit` → `OutfitAnalysis` (`src/domain/outfit`) — existing; per-outfit base analysis (color/formality/season/occasion/texture sub-engines)
- OutfitGenerationEngine `generateOutfits` (`src/domain/generation`) — existing; one candidate source
- `generateOutfitRecommendations` (`src/domain/recommendation/OutfitRecommendationEngine`) — existing; the saved-outfit candidate source
- StyleDNAEngine (`src/domain/style-dna`) — existing; per-item weather/occasion/commute suitability the scorer reads
- UsageAnalyticsEngine → `UsageAnalytics` (`src/domain/analytics`) — existing; wear-history / over-rotation signal source
- WardrobeHealthEngine → `WardrobeHealth` (`src/domain/analytics`) — existing; wardrobe-health contribution signal
- **RFC-011 Weather Runtime** → `WeatherSnapshot` (`src/domain/weather`) — the normalized weather the scorer consumes (never a provider)
- **RFC-004 Personalization Engine** → `UserPreferenceProfile` (`src/domain/personalization`) — the learned taste the scorer consumes
- **RFC-005 Intelligence Orchestrator** (`src/domain/orchestrator`) — the `recommendation` capability that will run v2
- AI explanation layer (`src/ai`) — existing; narrates v2 output, never ranks it
- ADR-002 (RecommendationContext), ADR-005 (AI does not decide), ADR-006 (caching), ADR-008 (release/versioning)

---

## Recommendation Philosophy

One rule, unchanged from every prior engine, applied to ranking:

- **Engines decide.** A pure domain engine computes the score, the eligibility,
  the diversity ordering, and the confidence of every recommendation. That is the
  source of truth for what the user sees and in what order.
- **AI explains.** Natural-language narration of a recommendation ("navy chinos
  over the grey trousers today because rain is likely and you've worn the grey
  twice this week") stays in the AI layer and consumes the already-ranked,
  already-traced output. AI never scores, never reorders, never filters (ADR-005).

So: **RecommendationContext → deterministic pipeline → `RecommendationResult` →
(optional) AI explanation.** v2 makes the *deterministic* half better — more
context-aware, more diverse, more explainable — without moving a single decision
into a model. Same context + same `generatedAt` ⇒ same ranked list, every time.

v2 is a **refinement, not a rewrite of the philosophy**: it keeps the v1 promise
that saved and generated outfits are unified on one comparable scale, and it
keeps every scoring decision in pure TypeScript. What changes is the *quality* of
that scoring: v1 collapses everything into `0.7·analysis + 0.3·contextFit` with an
opt-in preference nudge; v2 replaces that with an explicit, weighted,
multi-objective model that reads the `WeatherSnapshot` and `UserPreferenceProfile`
that did not exist when v1 was written, enforces real hard constraints, and
guarantees the top results are diverse.

## 1. Problem Statement

Wardrobe OS ships a working recommendation engine
(`recommendUnifiedOutfits`), and it does the important structural thing well: it
merges saved outfits with freshly generated combinations onto one comparable
score and returns the top N deterministically. But its *ranking quality* has not
kept up with the rest of the platform.

Concretely, v1 today:

- **Scores with a two-term blend.** `unifiedScore = 0.7 · analysis.overallScore +
  0.3 · contextFit`, where `contextFit` is the mean of season/occasion/commute
  suitability of the outfit's core items. Preference alignment is a small
  **opt-in** bonus (`usePreferences`, ≤ 0.6 on a 0–10 scale) that is off by
  default. Everything else — recency, diversity, color harmony beyond the base
  analysis, over-rotation — is either implicit in the base analysis or absent.
- **Ignores real weather.** `contextFit` reads only `context.weather.season` (a
  coarse label). The **RFC-011 `WeatherSnapshot`** — feels-like temperature, rain
  risk, wind, UV, and the derived `WeatherLabel`s (`RAINY`, `LAYER_REQUIRED`,
  `WATERPROOF`, …) — now exists and is *not consulted*. A linen shirt and suede
  loafers can rank #1 on a cold, rainy day.
- **Under-uses personalization.** The **RFC-004 `UserPreferenceProfile`** (derived
  colors, formality, silhouettes, footwear, with confidence) is reduced to a
  binary style/formality string match behind an opt-in flag. Protected/avoided
  handling is partial: avoided *items* are filtered (good), but there is no notion
  of not penalizing a **protected** item for underuse in ranking, and preference
  *fit* is not a first-class scored dimension.
- **Has weak hard constraints.** The only true rejection is "outfit contains an
  avoided item." Weather-incompatible, occasion-incompatible, and
  missing-required-slot outfits can still surface (merely scored lower), so a
  genuinely wrong outfit can rank above a right-but-plainer one.
- **Can return near-duplicates.** De-duplication is a single exact
  `top|bottom|footwear` signature. The top 5 can therefore be five variations on
  the same jacket, the same footwear, or the same color palette — technically
  distinct, experientially repetitive.
- **Is hard to inspect.** `debug` carries `boosts` / `penalties` / a few rejection
  reasons, but there is no structured score breakdown per dimension, no record of
  which hard constraints passed, and no machine-readable reason codes — so
  "why is this #1 and that #4?" is not answerable without reading engine source.

Now that Weather Runtime and Personalization exist, the recommendation should
become **context-aware** (it changes with the weather and with the user's taste),
**diverse** (the top 5 are meaningfully different), and **explainable** (every
result carries a full score breakdown and trace) — all while staying
deterministic and keeping every decision out of AI.

## 2. Goals

Improve recommendation **quality** without changing the core philosophy — engines
decide, AI explains. Recommendation Engine v2 produces better-ranked outfit
recommendations by:

- **A real multi-objective scoring model.** Replace the two-term blend with an
  explicit, weighted sum over named dimensions (§ "Scoring dimensions"), each a
  pure function of the context, each independently testable and traceable.
- **Weather-aware scoring via `WeatherSnapshot` (RFC-011).** Consume feels-like
  temperature, rain risk, wind, UV, and `WeatherLabel`s — not just the season —
  so recommendations change appropriately with the weather.
- **Personalization-aware scoring via `UserPreferenceProfile` (RFC-004).** Make
  preference fit a first-class, confidence-weighted scored dimension (on by
  default when a profile is present), not an opt-in binary nudge.
- **Diversity-aware ranking.** A reranking stage guarantees the top 5 are not
  near-duplicates by outfit skeleton, dominant color palette, or footwear.
- **Stronger hard constraints.** A dedicated eligibility stage rejects outfits
  that are genuinely wrong (avoided/retired items, severe weather mismatch,
  occasion mismatch, missing required slots) *before* scoring, with the reason
  recorded.
- **First-class explainability.** Every recommendation carries a per-dimension
  **score breakdown**, applied **boosts** and **penalties**, the **hard
  constraints it passed**, a **trace**, a **confidence**, and **reason codes**.
- **Recommendation quality metrics.** Emit per-run metrics (eligible/rejected
  counts, diversity score, average confidence, saved-vs-generated mix, weather and
  personalization influence) for the developer surface and tests.
- **Preserved unification and determinism.** Saved + generated outfits stay merged
  on one comparable scale; identical context + `generatedAt` ⇒ identical result.

Non-negotiable: **no AI, no ML, no randomness** anywhere in the pipeline.

## 3. Non-Goals

Explicitly **out of scope** for RFC-012 (verbatim from the brief, plus the usual
guardrails):

- **No AI ranking.** AI never scores, orders, filters, or edits a recommendation.
- **No ML.** No model, training, embeddings, clustering, or online learning in the
  ranking path. "Better" means a better deterministic model, not a learned one.
- **No UI-heavy features.** The Recommendation Center and Today's-Outfit widget
  keep their current shape; v2 changes the ranking behind them, not the screens.
  The only new surface is a **developer** debug view (§5), not an end-user one.
- **No calendar integration.** Occasion still comes from the request/context, not a
  connected calendar.
- **No notifications.** Permanently out of product scope (ROADMAP).
- **No database schema changes** unless absolutely necessary — and this RFC finds
  none necessary (§8). No new persisted tables/columns for ranking.
- **No new recommendation domain outside wardrobe.** v2 ranks outfits from the
  user's wardrobe; it does not recommend purchases (that is Buy vs Skip / RFC-001),
  trips (Lifestyle / RFC-006), or anything non-wardrobe.
- **No new weather fetching.** v2 consumes a `WeatherSnapshot` handed to it via the
  context; it never calls the Weather Runtime or any provider (RFC-011 owns that).
- **No incremental personalization mutation.** v2 reads the `UserPreferenceProfile`
  as data; it never derives or edits preferences (RFC-004 owns that).

## 4. User Stories

- As the owner, on a cold, rainy morning I want the top recommendations to be
  weather-appropriate (layers, closed footwear, waterproof-friendly) rather than
  the linen-and-loafers combo that scored well on a dry day, **without** me
  filtering anything.
- As the owner, I want recommendations to lean into what I actually wear (navy,
  smart-casual, sneakers) so the list feels like *my* wardrobe, and I want that on
  by default once the app has learned my taste.
- As the owner, I never want an item I've marked **avoided** to appear, and I never
  want a **protected** item (a rarely-worn keepsake blazer) pushed down the ranking
  merely because I don't wear it often.
- As the owner, I want the top 5 to feel like five real options — different
  skeletons, colors, and shoes — not five takes on the same jacket.
- As the owner, I don't want to be offered an outfit that is obviously wrong for
  the occasion (gym wear for a wedding) or dangerously wrong for the weather
  (shorts at 4 °C) — those should simply not appear.
- As a developer, I want to open a recommendation and see exactly *why* it ranked
  where it did — the score per dimension, the boosts, the penalties, the
  constraints it passed, and reason codes — so I can debug and calibrate.
- As the AI Stylist, I want a rich, already-decided `RecommendationResult` with a
  trace so I can explain it in plain language without recomputing or second-guessing
  the ranking.

## 5. UX Flow

**v2 ships no new end-user UX.** It changes the ranking that already powers:

- **Recommendation Center** — continues to render unified recommendations; results
  become weather- and preference-aware and more diverse. No layout change.
- **Today's Outfit** (Today home) — the top recommendation reflects today's
  `WeatherSnapshot` and the learned profile.
- **AI Stylist** — continues to consume recommendation output and explain it.

The one new surface is a **developer** debug view (behind Developer Mode, in the
spirit of `/developer/weather` from RFC-011): submit a context/occasion and inspect
the full pipeline — candidates in, eligibility rejections with reasons, the score
breakdown per dimension per surviving candidate, the diversity reranking, and the
run's quality metrics. This is a debug/inspection surface, not a product feature.

States the ranking must handle gracefully (surfaced through existing widget
states): **no eligible candidates** (everything rejected → empty state with the
dominant rejection reason available to the UI), **thin wardrobe** (few candidates →
diversity relaxes rather than returning nothing), **cold personalization** (no
profile yet → preference dimension contributes neutrally, never blocks), and
**weather unavailable** (the context carries a `seasonal_fallback` `WeatherSnapshot`
per RFC-011 → weather scoring still runs, at lower influence, and AI explains the
fallback).

## 6. Architecture

v2 is a **pure domain engine** living beside v1 (`src/domain/recommendation/v2`),
composed of small single-responsibility stages. It adds no I/O and no AI. The
context is assembled exactly as today (RFC-005's service / `buildRecommendationContext`),
now carrying a `WeatherSnapshot` (RFC-011) and a `UserPreferenceProfile` (RFC-004).

```
RecommendationContext              (wardrobe + usage + health + preferences + WeatherSnapshot + commute + savedOutfits + protected/avoided)
        ↓
Candidate Generation               (saved-outfit recs ∪ generated combos → one candidate list)   ← PURE
        ↓
Eligibility Filter                 (hard constraints; reject with reason codes)                   ← PURE
        ↓
Scoring Engine                     (weighted multi-objective score per surviving candidate)       ← PURE
        ↓
Diversity Reranker                 (top-K not near-duplicates: skeleton / palette / footwear)      ← PURE
        ↓
Explanation Trace                  (per-recommendation breakdown, boosts, penalties, reason codes) ← PURE
        ↓
RecommendationResult               (ranked recommendations + quality metrics + trace)
        ↓
AI (optional explanation)          (consumes the result; never ranks)
```

### Domain Layer

New, pure, under `src/domain/recommendation/v2/` (no React/Supabase/AI/I/O;
`generatedAt` injected from the context):

- **`RecommendationEngineV2`** — the entry point. `recommendV2(context, options)
  → RecommendationResult`. Orchestrates the stages below; holds no scoring math
  itself (delegates to the stage modules) so each stage is independently testable.
- **`CandidateGenerator`** — builds the unified candidate list from the two
  existing sources: `generateOutfitRecommendations` (saved outfits) and
  `generateOutfits` (generated combos), normalizing both into one `OutfitCandidate`
  shape carrying its `OutfitAnalysis`, items, source, and per-source raw score.
  This preserves v1's saved+generated unification.
- **`EligibilityEngine`** — applies the hard constraints (§"Hard constraints"),
  returning surviving candidates plus a list of `{ candidate, rejectionReasons }`.
  Rejection happens **before** scoring so ineligible outfits cannot outrank
  eligible ones.
- **`ScoringEngine`** — computes the multi-objective score. For each candidate it
  evaluates every scoring dimension (§"Scoring dimensions") as a pure function
  `(candidate, context) → { raw, weighted }`, sums the weighted dimensions, applies
  boosts/penalties, clamps to the shared 0–10 scale, and records the breakdown. All
  weights live in `RecommendationWeights`.
- **`DiversityReranker`** — takes the scored, sorted list and produces a top-K that
  is not near-duplicate along three axes: outfit **skeleton** (top+bottom+footwear
  category shape), **dominant color palette**, and **footwear**. Deterministic
  greedy selection: walk candidates by score, admit one only if it is sufficiently
  different from those already admitted; relax the thresholds if too few candidates
  exist so a thin wardrobe still yields a full list. Records the diversity decision
  per admitted/held item.
- **`RecommendationTrace`** — assembles the per-recommendation explanation object
  (score breakdown, applied boosts, applied penalties, hard constraints passed,
  reason codes, confidence) from the scoring + eligibility + diversity records. No
  new decisions — it only *formats* what the stages decided.
- **`RecommendationQualityMetrics`** — aggregates the run into the quality metrics
  (§"Quality metrics"): eligible/rejected counts, diversity score, average
  confidence, saved-vs-generated mix, weather influence, personalization influence.
- **`RecommendationWeights`** — the single source of tunable constants: per-dimension
  weights, penalty magnitudes, diversity thresholds, and constraint cut-offs.
  Calibrated with tests, exactly like the Health/Outfit/Personalization engines.
- **`types`** — `OutfitCandidate`, `ScoreBreakdown`, `ScoreDimension`,
  `HardConstraint`, `ReasonCode`, `RecommendationV2`, `RecommendationResult`,
  `RecommendationQuality`, `RecommendationV2Options`.

Engines are **not** rewritten: v2 composes the existing `OutfitEngine`,
`OutfitGenerationEngine`, saved-outfit engine, and StyleDNA outputs. The base
per-outfit `OutfitAnalysis` (color/formality/season/occasion/texture) stays the
foundation; v2 adds the cross-cutting dimensions (weather, personalization,
recency, diversity, constraints) on top.

### Service Layer

`src/features/recommendations/services/recommendations.service.ts` continues to
assemble the context and return `{ data, error }`. It swaps the call from
`recommendUnifiedOutfits` to `recommendV2` (behind an internal flag during
migration so results can be compared). The context already carries the
`WeatherSnapshot` (via the RFC-011 integration) and the `UserPreferenceProfile`
(via the RFC-004 integration); no new fetches.

### Repository Layer

None. v2 is compute-only; it reads the assembled context and returns a result. No
new persistence (§8).

### UI Layer

No production UI change. One **developer** debug view (Developer Mode) to inspect
the pipeline and quality metrics, mirroring the RFC-011 weather inspector.

### AI Layer

- AI is a **downstream consumer** of `RecommendationResult`. The existing
  recommendation-explanation prompt builder (RFC-002/004 pattern) narrates the
  ranked output and can now cite the richer trace (score breakdown, reason codes)
  in plain language — schema-validated, decision-free.
- **AI never scores, reorders, filters, or edits a recommendation** (ADR-005).
  Removing AI leaves the ranked list and its order byte-for-byte identical.

### Orchestrator integration (RFC-005)

The `recommendation` capability's registry adapter calls `recommendV2` instead of
`recommendUnifiedOutfits`. Its declared dependencies are unchanged in spirit and
already include `weather` (RFC-011) and `personalization` (RFC-004), so the
`WeatherSnapshot` and `UserPreferenceProfile` are present in the context the
capability receives. No consumer of the orchestrator changes.

## 7. Data Flow

```
consumer → recommendationsService.getRecommendations(filters)     { data, error }
  → buildRecommendationContext(...)                               (existing; now carries WeatherSnapshot + UserPreferenceProfile)
  → recommendV2(context, options)                                 ← PURE, generatedAt from context
      1. CandidateGenerator
           • saved:     generateOutfitRecommendations(context)   → saved candidates
           • generated: generateOutfits(context)                 → generated candidates
           • normalize both → OutfitCandidate[] (with OutfitAnalysis, source, rawScore)
      2. EligibilityEngine
           • for each candidate: run hard constraints
           • survivors → scoring; rejects → { candidate, rejectionReasons[] } (recorded)
      3. ScoringEngine
           • for each survivor, for each dimension d:
                 raw_d      = pureScore_d(candidate, context)      ∈ [0,10] or [0,1] (dimension-local)
                 weighted_d = weight_d · normalize(raw_d)
             score          = clamp0..10( Σ weighted_d + boosts − penalties )
             confidence     = f(base analysis confidence, evidence, constraint margins)
             record ScoreBreakdown { per-dimension raw + weighted, boosts, penalties }
      4. sort by (score desc, confidence desc, saved-before-generated, id) — deterministic
      5. DiversityReranker
           • greedy top-K: admit a candidate only if different enough (skeleton / palette / footwear)
             from those already admitted; relax thresholds if candidates are scarce
           • record diversity decisions
      6. RecommendationTrace + RecommendationQualityMetrics
           • per-recommendation: breakdown, boosts, penalties, constraints passed, reason codes, confidence
           • per-run: eligible/rejected counts, diversity score, avg confidence, source mix, weather + personalization influence
  → RecommendationResult { recommendations[], quality, metadata }
  → [optional] AI explanation of the result (no re-rank, no decisions)
```

Every stage is pure and side-effect-free. Identical `context` (including its
`WeatherSnapshot`, `UserPreferenceProfile`, and `generatedAt`) + identical
`options` ⇒ identical `RecommendationResult`.

## 8. Data Model / Schema Impact

**No schema changes.** v2 is compute-only. It reads the same
`RecommendationContext` v1 reads — now populated with a `WeatherSnapshot`
(RFC-011) and a `UserPreferenceProfile` (RFC-004), both of which are **derived on
demand and not persisted**, exactly like `WardrobeHealth` / `UsageAnalytics`. The
`RecommendationResult` (including its trace and quality metrics) is returned to
callers, not stored.

The protected/avoided item flags v2 relies on are the **existing** additive
`wardrobe_items.protected` / `wardrobe_items.avoided` columns from RFC-004; v2
adds no columns of its own. Should a future variant want to persist a per-run
quality-metrics history for trend analysis, that would be a separate additive
table behind its own RFC — documented here only as a non-goal, not applied.

## 9. API / Domain Contracts

Illustrative (final names/shapes settled at implementation). Scores are on the
shared **0–10** scale; confidence and dimension-local strengths are **0–1** unless
noted. Weights and thresholds are tunable engine constants in
`RecommendationWeights`.

```ts
// src/domain/recommendation/v2/types.ts  (design)

/** A unified candidate before scoring — saved or generated, one shape. */
export interface OutfitCandidate {
  id: string;
  source: "saved_outfit" | "generated_combo";
  savedOutfitId?: string;
  name: string;
  items: RecommendedOutfitItem[];      // reuse the existing item ref shape
  analysis: OutfitAnalysis;            // existing per-outfit base analysis
  /** The originating engine's raw score, kept for trace/debug. */
  rawScore: number;
}

/** The scoring dimensions v2 evaluates (each a pure function of candidate+context). */
export type ScoreDimension =
  | "outfitAnalysis"        // base OutfitAnalysis.overallScore
  | "weatherSuitability"    // from WeatherSnapshot (RFC-011)
  | "occasionSuitability"   // StyleDNA occasion fit vs requested occasion
  | "formalityAlignment"    // StyleDNA formality vs occasion/profile
  | "personalPreferenceFit" // from UserPreferenceProfile (RFC-004), confidence-weighted
  | "colorHarmony"          // color-engine agreement across the outfit
  | "textureCompatibility"  // texture-engine agreement
  | "comfortCommuteFit"     // commute/comfort suitability
  | "wardrobeHealthContribution"; // rewards using under-worn (non-protected) items toward balance

/** Boosts and penalties applied on top of the weighted sum. */
export type ReasonCode =
  // boosts
  | "matches_preferences" | "weather_appropriate" | "occasion_ideal"
  | "improves_rotation" | "favorite_outfit"
  // penalties
  | "recent_wear" | "over_rotation" | "mild_weather_mismatch"
  | "formality_drift" | "weak_color_harmony"
  // constraint outcomes (informational, on survivors)
  | "passed_all_constraints";

export interface ScoreBreakdown {
  dimensions: {
    dimension: ScoreDimension;
    raw: number;          // dimension-local score
    weight: number;       // from RecommendationWeights
    weighted: number;     // weight · normalized(raw)
  }[];
  boosts: { code: ReasonCode; label: string; delta: number }[];
  penalties: { code: ReasonCode; label: string; delta: number }[];
  /** The weighted-sum subtotal before boosts/penalties, and the final clamped score. */
  subtotal: number;
  total: number;          // final 0–10 score
}

/** The hard constraints an eligible outfit must pass (see §Hard constraints). */
export type HardConstraint =
  | "no_avoided_items"
  | "no_retired_items"
  | "weather_compatible"          // rejects only SEVERE mismatch
  | "occasion_compatible"
  | "required_slots_present";

export interface RecommendationV2 {
  id: string;
  source: "saved_outfit" | "generated_combo";
  savedOutfitId?: string;
  name: string;
  items: RecommendedOutfitItem[];
  score: number;                  // 0–10, final
  confidence: number;             // 0–1
  analysis: OutfitAnalysis;
  reason: string;                 // short human sentence (deterministic template)
  reasonCodes: ReasonCode[];      // machine-readable
  breakdown: ScoreBreakdown;      // full per-dimension trace
  constraintsPassed: HardConstraint[];
  /** Diversity decision that admitted this result into the top-K. */
  diversity: { rank: number; distinctFrom: string[]; heldBackNearDuplicates: number };
  strengths: string[];
  tradeoffs: string[];
  suggestions: string[];
}

/** Per-run quality metrics for the developer surface + tests. */
export interface RecommendationQuality {
  eligibleCandidateCount: number;
  rejectedCandidateCount: number;
  rejections: { id: string; reasons: string[]; failed: HardConstraint[] }[];
  /** 0–1 — how different the returned top-K are from each other. */
  diversityScore: number;
  averageConfidence: number;      // 0–1
  sourceMix: { saved: number; generated: number };
  /** 0–1 — how much weather scoring moved the ranking this run. */
  weatherInfluence: number;
  /** 0–1 — how much personalization scoring moved the ranking this run. */
  personalizationInfluence: number;
}

/** THE standardized output. Recommendation Center + AI read this. */
export interface RecommendationResult {
  recommendations: RecommendationV2[];
  quality: RecommendationQuality;
  metadata: {
    engineVersion: string;        // "2.0.0"
    generatedAt: string;
    weatherSource: WeatherSnapshot["source"];   // live | manual | seasonal_fallback
    personalizationApplied: boolean;
  };
}

export interface RecommendationV2Options {
  occasion?: string | null;
  limit?: number;                 // default 5
  /** Escape hatch for tests / calibration; production leaves defaults. */
  weights?: Partial<typeof RECOMMENDATION_WEIGHTS>;
}

export function recommendV2(
  context: RecommendationContext,
  options?: RecommendationV2Options,
): RecommendationResult;
```

### Scoring dimensions (deterministic)

Each dimension is a **pure function** `(candidate, context) → raw`, normalized and
multiplied by its weight. Weights live in `RecommendationWeights` and are
calibrated with tests. Positive contributions raise the score; recency /
over-rotation apply as penalties.

| Dimension | Source | Notes |
| --- | --- | --- |
| **OutfitAnalysis score** | `OutfitAnalysis.overallScore` (existing) | The base per-outfit quality (color/formality/season/occasion/texture sub-engines). |
| **Weather suitability** | `WeatherSnapshot` (RFC-011) | Feels-like temperature band, rain risk, wind, UV, and `WeatherLabel`s (`RAINY`→waterproof/closed footwear, `LAYER_REQUIRED`→outerwear, `HOT`→lightweight). Scaled by `WeatherSnapshot.confidence`. |
| **Occasion suitability** | StyleDNA occasion fit vs requested occasion | Mean occasion suitability of core items for the resolved occasion. |
| **Formality alignment** | StyleDNA formality vs occasion + profile | Penalizes drift from the occasion's expected formality and from the profile's preferred formality. |
| **Personal preference fit** | `UserPreferenceProfile` (RFC-004) | Color/formality/silhouette/footwear match, **weighted by each preference's confidence**. On by default when a profile is present; contributes neutrally (not a penalty) at cold start. |
| **Color harmony** | color-engine agreement across the outfit | Beyond the base analysis: rewards a coherent palette; feeds the diversity palette signal too. |
| **Texture compatibility** | texture-engine agreement | Rewards compatible fabric/texture pairing. |
| **Comfort / commute fit** | commute suitability + comfort | `wfh` neutral; otherwise commute-friendliness of core items. |
| **Recent wear penalty** | wear history (`UsageAnalytics`) | Penalizes outfits whose items were worn very recently (freshness). |
| **Over-rotation penalty** | wear history distribution | Penalizes items already worn disproportionately often (spreads usage). |
| **Protected / avoided handling** | RFC-004 flags | Avoided → hard reject (not a penalty). **Protected → never penalized for underuse** by the recency/over-rotation/health dimensions. |
| **Wardrobe health contribution** | `WardrobeHealth` | Small reward for surfacing under-worn, non-protected items that improve balance (bounded, so it never overrides fit). |
| **Confidence** | derived | Combines base-analysis confidence, evidence volume, and how comfortably the candidate cleared its hard constraints. |

### Hard constraints (reject before scoring)

Applied by `EligibilityEngine`; a failing candidate is removed and its reasons
recorded (never merely down-weighted):

- **Avoided items must never appear.** Any outfit containing an owner-avoided item
  is rejected (`no_avoided_items`). (Preserves and hardens v1 behaviour.)
- **Retired items must never appear.** Any outfit containing a retired/inactive
  item is rejected (`no_retired_items`).
- **Severe weather mismatch is rejected** (`weather_compatible`). Only *severe*
  mismatch (e.g. open/insufficient footwear in heavy rain, clearly out-of-band
  temperature) rejects; **mild** mismatch is a scoring penalty, not a rejection, so
  the engine degrades gracefully rather than returning nothing.
- **Occasion-incompatible outfits are rejected** (`occasion_compatible`) when a
  concrete occasion is requested (e.g. athleticwear for a formal occasion).
- **Missing required slots are rejected** (`required_slots_present`) — an outfit
  missing a required core slot for the context is not a valid recommendation.
- **Protected items may appear** and are **not penalized** for underuse — protection
  affects *penalties/health*, never eligibility.

Constraint thresholds (what counts as "severe", which slots are "required" per
occasion) are tunable constants in `RecommendationWeights`, calibrated with tests.

### Diversity (top-5 not near-duplicates)

The reranker guarantees the returned top-K avoid returning:

- the **same top + bottom + footwear skeleton** repeatedly,
- the **same dominant color palette** repeatedly,
- the **same footwear** repeatedly *unless context strongly requires it* (e.g. only
  one weather-appropriate pair exists).

Deterministic greedy algorithm: sort by score; admit the top candidate; for each
subsequent candidate admit it only if its distance (skeleton + palette + footwear)
from every already-admitted result exceeds a threshold; if the list would fall
short of `limit`, progressively relax the threshold so a thin wardrobe still
returns a full, best-effort list (the relaxation is recorded in the trace and
reflected in `diversityScore`). No randomness — ties break by score then id.

### Explainability

Every `RecommendationV2` carries: the full **`ScoreBreakdown`** (per-dimension raw
+ weighted, subtotal, total), the applied **boosts** and **penalties** (with
`ReasonCode` + magnitude), the **hard constraints passed**, the **diversity**
decision, a **confidence**, and machine-readable **reason codes** plus a short
deterministic human `reason` sentence. This is the trace the AI layer narrates and
the developer view renders.

### Quality metrics

`RecommendationQuality` (per run): `eligibleCandidateCount`,
`rejectedCandidateCount` (+ per-rejection reasons), `diversityScore` (0–1),
`averageConfidence`, `sourceMix` (saved vs generated), `weatherInfluence` (0–1),
and `personalizationInfluence` (0–1). Influence metrics are computed
deterministically by comparing the ranking to a counterfactual with that
dimension's weight zeroed — a pure, reproducible measure of "how much did weather /
personalization move this run?".

## 10. Acceptance Criteria

This RFC is **Approved-ready** when it defines all of the below (it does):

- [ ] The pipeline shape (Candidate Generation → Eligibility → Scoring → Diversity
      Rerank → Trace → `RecommendationResult`) and the pure module set under
      `src/domain/recommendation/v2/` (`RecommendationEngineV2`,
      `CandidateGenerator`, `EligibilityEngine`, `ScoringEngine`,
      `DiversityReranker`, `RecommendationTrace`, `RecommendationQualityMetrics`,
      `RecommendationWeights`, `types`).
- [ ] The multi-objective scoring model: every dimension in §"Scoring dimensions",
      each a pure function, each weighted via `RecommendationWeights`.
- [ ] The hard-constraint set and that rejection happens **before** scoring, with
      reasons recorded.
- [ ] Diversity guarantees for the top-K (skeleton / palette / footwear) with a
      deterministic relaxation for thin wardrobes.
- [ ] The explainability contract (score breakdown, boosts, penalties, constraints
      passed, trace, confidence, reason codes) and the quality-metrics contract.
- [ ] Weather-aware scoring via `WeatherSnapshot` and personalization-aware scoring
      via `UserPreferenceProfile`, on by default when present.
- [ ] Preserved saved+generated unification and full determinism.
- [ ] Integration points: Recommendation Center, AI Stylist, the orchestrator's
      `recommendation` capability, and the RFC-011 / RFC-004 context feeds.
- [ ] Explicit non-goals (no AI ranking, no ML, no UI-heavy features, no calendar,
      no notifications, no schema changes, no non-wardrobe domain).
- [ ] A testing plan, risks, and future extensions.

Implementation-time acceptance criteria (tracked in that PR — not this RFC):
- [ ] `recommendV2` is pure and deterministic (same context + `generatedAt` +
      options ⇒ identical `RecommendationResult`).
- [ ] **Recommendation quality improves without AI** (golden-scenario fixtures show
      better rankings than v1 on the same contexts).
- [ ] Recommendations **change appropriately with weather** — same wardrobe, a
      `RAINY`/`COLD` snapshot vs a `HOT`/`SUNNY` snapshot yields materially
      different top-5.
- [ ] Recommendations **change appropriately with user preferences** — same context,
      two different `UserPreferenceProfile`s yield different rankings.
- [ ] **Avoided items never appear**; **protected items are never penalized** for
      underuse.
- [ ] **Severe** weather mismatch and occasion mismatch are **rejected**; mild
      mismatch is only penalized.
- [ ] **Top 5 are diverse** (skeleton / palette / footwear) per the diversity score.
- [ ] Debug/trace output explains ranking clearly (per-dimension breakdown + reason
      codes) and quality metrics are emitted.
- [ ] The **existing Recommendation Center keeps working** (equivalence: same shape,
      improved ranking) and **AI explanation still only explains** deterministic
      output (removing AI leaves the ranking identical).

## 11. QA / Testing Plan

- **Unit tests (Vitest, pure engine) — the core:**
  - **Weather-aware:** a fixed wardrobe scored against a `RAINY`/`COLD` snapshot vs
    a `HOT`/`SUNNY` snapshot → expected different top items (waterproof/closed vs
    lightweight/open); weather influence metric > 0.
  - **Personalization-aware:** identical context, two `UserPreferenceProfile`s
    (navy/smart-casual vs bold/formal) → different rankings; personalization
    influence metric > 0; cold-start profile contributes neutrally.
  - **Avoided exclusion:** an avoided item never appears in any recommendation.
  - **Protected handling:** a rarely-worn protected item is not penalized by the
    recency/over-rotation/health dimensions; a rarely-worn *unprotected* item is.
  - **Severe weather rejection:** open footwear in heavy rain / out-of-band temp →
    rejected with `weather_compatible`; a *mild* mismatch is only penalized and can
    still appear.
  - **Occasion mismatch rejection:** athleticwear for a formal occasion → rejected
    with `occasion_compatible`.
  - **Missing required slot:** a candidate missing a required core slot → rejected.
  - **Diversity reranking:** a wardrobe biased toward one jacket/palette/footwear →
    the top 5 are not near-duplicates; and a *thin* wardrobe still returns a full
    best-effort list (relaxation recorded).
  - **Recent wear + over-rotation penalties:** recently/over-worn items rank lower,
    all else equal.
  - **Saved vs generated merge:** both sources appear on one comparable scale; a
    strong saved outfit and a strong generated combo rank by score, not by source;
    near-tie prefers saved (v1 parity).
  - **Determinism:** same context + `generatedAt` + options ⇒ identical result
    (deep-equal), including trace and metrics.
  - **Quality metrics:** eligible/rejected counts, diversity score, average
    confidence, source mix, weather & personalization influence computed as
    specified (influence via the zeroed-weight counterfactual).
- **Golden scenarios:** a small set of fixture contexts (e.g. "cold rainy office
  day, navy-preferring owner, one protected blazer, two avoided items") → an
  expected top-5 + metrics table, guarding calibration drift and documenting the
  intended behaviour.
- **Equivalence / migration guard:** for representative contexts, v2 returns the
  same *shape* the Recommendation Center consumes and a ranking that is a strict
  improvement (or equal) on the golden scenarios; no consumer code changes shape.
- **AI guard:** a fake-AI unit test asserts the ranked list and order are unchanged
  whether or not AI runs (AI explains only).
- **No AI and no I/O in the automated suite** — contexts (including
  `WeatherSnapshot` and `UserPreferenceProfile`) are fixtures; `generatedAt` is
  injected.
- **Release gate:** `npm test`, `npm run lint`, and `npm run build` green before
  any tag (ADR-008).

## 12. Risks & Trade-offs

- **Filter-bubble / over-fitting to habits.** Weighting preferences and penalizing
  recency can narrow variety. *Mitigation:* preference fit is one bounded dimension
  among many (never a hard filter); the diversity reranker and the wardrobe-health
  contribution actively push variety; recency/over-rotation penalties spread usage.
- **Calibration risk.** Many weights and thresholds. *Mitigation:* all constants
  live in `RecommendationWeights`, covered by golden-scenario tests; the
  per-dimension `ScoreBreakdown` makes any mis-weight immediately debuggable.
- **Over-aggressive hard constraints returning too little.** Rejecting too much can
  empty the list. *Mitigation:* only *severe* weather/occasion mismatches reject;
  everything milder is a penalty; diversity relaxes before returning short; the
  empty state surfaces the dominant rejection reason.
- **Determinism vs. richer signals.** More inputs (weather, wear history, profile)
  mean more ways to accidentally introduce nondeterminism. *Mitigation:* every
  stage is a pure function of the context; `generatedAt` is injected; no
  `Date.now()`/`Math.random()`; determinism is an explicit test.
- **Weather/personalization availability.** A `seasonal_fallback` snapshot or a
  cold profile must not break ranking. *Mitigation:* both dimensions degrade to
  neutral/low-influence contributions; the fallback source is surfaced in metadata
  for the AI to explain (RFC-011), never hallucinated.
- **Migration risk from v1.** Changing the ranking changes what users see.
  *Mitigation:* v2 lands beside v1 behind an internal flag; equivalence + golden
  tests gate the switch; the result shape the Recommendation Center consumes is
  preserved.
- **Performance.** More dimensions × more candidates. *Mitigation:* candidate
  counts stay bounded (per-source limits, as in v1); scoring is linear in
  candidates × dimensions; measure before optimizing.

## 13. Future Extensions

- **Explore/exploit variety dial** — a user-tunable knob that down-weights
  preference fit and up-weights diversity/health to surface under-worn items
  (pairs naturally with RFC-004's proposed same knob).
- **Per-occasion weight profiles** — different `RecommendationWeights` for office vs
  weekend vs travel, once occasion signal volume supports it.
- **Recommendation feedback loop** — capture accept/reject on v2 recommendations to
  feed RFC-004 signals (the negative-signal path RFC-004 already reserves), closing
  the learn→rank→learn loop deterministically.
- **Quality-metrics history** — an additive table of per-run quality metrics for
  week-over-week ranking-quality trends (its own RFC; explicitly not persisted now).
- **Outfit-level color/texture diversity tuning** — richer palette extraction (e.g.
  Vision-sourced dominant colors) feeding both the color-harmony dimension and the
  diversity signal.
- **Lifestyle reuse** — the Lifestyle Engine (RFC-006) requests `recommendation`
  per trip-day through the orchestrator, so it inherits v2 automatically; a future
  variant could pass a multi-day diversity constraint (don't repeat an outfit across
  the trip).

## 14. Open Questions

1. **Default weights.** What are the starting per-dimension weights, and how much
   should weather and personalization move the ranking relative to the base
   `OutfitAnalysis` (which dominates v1 at 0.7)?
2. **"Severe" thresholds.** What exact feels-like/rain-risk/wind cut-offs count as a
   *severe* weather mismatch (reject) vs a *mild* one (penalty), per footwear/garment
   type?
3. **Required slots per occasion.** What is the canonical map of required core slots
   per resolved occasion (e.g. does a formal occasion require outerwear)?
4. **Diversity distance function.** How is "near-duplicate" quantified across
   skeleton + palette + footwear, and what threshold (and relaxation schedule)
   yields a diverse-but-full top-5 on both rich and thin wardrobes?
5. **Personalization default.** Is preference fit on by default whenever *any*
   profile exists, or gated on a minimum profile confidence to avoid cold-start
   noise?
6. **Influence metric definition.** Is the zeroed-weight counterfactual the right
   measure of weather/personalization influence, or should influence be a rank-
   correlation (e.g. how much the order changed) instead of a score delta?
7. **Migration switch.** Do we ship v2 behind an internal flag and flip after
   golden/equivalence tests pass, or replace v1 outright in one release once tests
   are green?
8. **Confidence formula.** How should candidate confidence combine base-analysis
   confidence, evidence volume, and constraint margin into one 0–1 number?
9. **Wardrobe-health contribution bound.** How small must the health reward be so it
   nudges toward under-worn items without ever overriding genuine fit?
10. **Occasion source.** Occasion comes from the request/context today; do we need a
    richer default when none is supplied (e.g. infer from commute + day), still
    without calendar integration?
```