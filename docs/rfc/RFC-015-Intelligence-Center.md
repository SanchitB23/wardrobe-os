# RFC-015: Intelligence Center

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Claude (Opus 4.8)
Target Release: v1.1.0
Epic: Product Intelligence
Priority: High
Effort: L
Dependencies:
- RFC-005 Intelligence Orchestrator (`src/domain/orchestrator`) — the composition layer the Center consumes engine outputs through (it never calls engines directly)
- RFC-012 Recommendation Engine v2 (`src/domain/recommendation/v2`) — `Wear` / `Explore` actions
- RFC-013 Personalization Engine v2 (`src/domain/personalization/v2`) — lifecycle + explore/exploit signal for `Rotate` / `Explore`
- RFC-014 AI Runtime v2 (`src/runtime/ai`) — the `Explanation` capability that narrates actions
- InsightEngine → `InsightReport` (`src/domain/analytics`) — the existing priority-ranked `topActions` this generalises
- WardrobeHealthEngine, UsageAnalyticsEngine, BuyVsSkipEngine (RFC-001), Lifestyle Engine (RFC-006), Weather Runtime (RFC-011), Vision Engine (RFC-002) — action sources
- ADR-002 (RecommendationContext), ADR-005 (AI does not decide), ADR-006 (caching)

> **Prioritise, don't report.** The Intelligence Center turns the app's many
> analyses into one ranked list of **what to do next**. Every action is decided
> deterministically by an engine; the Center only *aggregates, dedupes, and ranks*;
> AI only *explains* (ADR-005).

---

## Intelligence Philosophy

The same separation as every prior engine, applied to the *product surface*:

- **Engines decide the actions.** Each deterministic engine already produces its
  own conclusions — a top outfit, a buy/skip verdict, a health gap, a laundry
  schedule, an under-worn item. The Center invents no new verdict.
- **The Center prioritises.** It maps each engine's output into a uniform
  **`ActionCard`**, dedupes overlapping actions, scores **impact**
  deterministically, and returns one ranked **TopActions** list.
- **AI explains.** Natural-language narration of an action ("clean these two
  before your trip") comes from the AI Runtime's `Explanation` capability,
  consuming the already-decided action. AI never creates, ranks, or edits an
  action.

So: **Engines → Action Generator → Priority Engine → Intelligence Center →
(optional) AI explanation.** If you removed the Center, every engine would still
work and every decision would be unchanged — the user would just have to read
eight surfaces and prioritise by hand.

## 1. Problem Statement

Wardrobe OS exposes a lot of intelligence, spread across surfaces: recommended
outfits, wardrobe health (gaps, duplicates, coverage), usage analytics
(over-/under-rotation, stale items), Buy-vs-Skip verdicts, the personalization
profile, trip plans (packing, laundry, capsule), weather, and vision candidates.
The Today home (RFC-007) and the InsightEngine (`topActions`) already gesture at
"what matters", but:

- **The user has to interpret and cross-reference.** Health says "you lack smart
  trousers", usage says "you over-wear the navy chinos", the recommender says
  "wear the grey pair", acquisition says "skip the blazer" — each on its own
  screen, in its own vocabulary. Nothing reconciles them into a single "do this
  next".
- **Analytics ≠ action.** Most surfaces present *data* (scores, distributions,
  reports) and leave prioritisation to the user. The product should instead lead
  with **prioritised actions** and keep the analytics as supporting detail.
- **The existing `topActions` is analytics-only.** `InsightEngine` ranks
  `WardrobeInsight`s from health + usage + purchase — a great start, but it does
  not see recommendations, acquisition verdicts, personalization lifecycle,
  lifestyle/laundry, weather, or vision, and its actions are free-text
  `suggestedActions`, not typed, deduped, impact-scored `ActionCard`s.

We need **one Intelligence Center** that aggregates every deterministic engine
into a single, deduplicated, impact-ranked list of typed actions — each with a
priority, impact, confidence, and reason — so the product tells the user *what to
do*, not *what to interpret*. Still deterministic; still "engines decide, AI
explains".

## 2. Goals

- Provide **one `IntelligenceCenter`** output: a ranked `TopActions` list of
  typed `ActionCard`s aggregated from every deterministic engine.
- **Typed actions** (§Action Types): `Wear`, `Buy`, `Skip`, `Clean`, `Rotate`,
  `Pack`, `Replace`, `Explore` — each mapped from a specific engine's decision.
- **Deterministic impact scoring + ranking.** Every action carries an **impact**
  (0–1) derived from its source engine's signals; the list is ranked by impact
  (then priority, then a stable tie-break). Same inputs ⇒ same ranked list.
- **Deduplication.** Overlapping actions from different engines (same
  type + subject) collapse into one, keeping the strongest impact and merging
  reasons — no duplicate actions.
- **Per-action metadata:** `priority`, `impact`, `confidence`, `reason` (+
  machine-readable reason codes and the source engine), so each card is
  inspectable and explainable.
- **Compose through the Orchestrator (RFC-005).** The Center reads engine outputs
  from an `ExecutionReport` (or the assembled context), never calling engines
  directly — engines stay independent.
- **AI explains via RFC-014.** An optional narration of the action list uses the
  AI Runtime's `Explanation` capability; removing it leaves the actions and their
  order unchanged.
- **Never decide.** No AI decisions; no new scoring/eligibility/verdict logic —
  the Center only aggregates + ranks existing engine conclusions (ADR-005).
- Be **pure and unit-testable** (deterministic given engine outputs + `generatedAt`).

## 3. Non-Goals

- **No AI decisions.** AI never generates, ranks, or edits an action (ADR-005).
- **No new engine verdicts.** The Center adds no scoring/eligibility/recommendation
  of its own; it maps and ranks what engines already decided.
- **No new deterministic domain.** It aggregates existing engines; it does not
  introduce a new analysis (e.g. no new "wardrobe grade").
- **No notifications / scheduling / background jobs.** Actions are computed on
  demand and shown in-app; no push, email, or cron (permanently out of scope).
- **No write actions here.** The Center *surfaces* actions; executing one (wear,
  buy, mark clean) stays with the existing feature flows/hooks. Wiring the buttons
  to those flows is UI plumbing, not new logic.
- **No schema changes.** Compute-only, like Health / Usage / Insights.
- **No multi-user / cloud aggregation.** Single owner, in-app.

## 4. User Stories

- As the owner, I open one screen and see **"Do this next"** — a short, ranked
  list: wear today's grey chinos, clean the two shirts before Friday's trip, skip
  the blazer you were eyeing, give the stale loafers a turn.
- As the owner, each action tells me **why** ("over-worn: navy chinos worn 6× this
  week") and **how confident / how impactful** it is, so I trust the ordering.
- As the owner, I never see the **same action twice** because health and usage
  both flagged it — it appears once, with the combined reason.
- As the owner, I can act on a card (wear / view / mark) via the existing flows,
  without leaving the Center.
- As a developer, I can inspect each card's **impact score, confidence, source
  engine, and reason codes** to debug why it ranked where it did.
- As the AI Stylist, I can narrate the ranked action list in plain language from
  the already-decided cards, without recomputing or reordering.

## 5. UX Flow

Primary surface: an **Intelligence Center** view (candidate route **`/intelligence`**,
or a promoted section on the Today home — settled in §14). It leads with actions:

1. **Top Actions** — a ranked list of `ActionCard`s. Each card shows the action
   **type** (icon + label), a one-line **title/subject**, the **reason**, and
   compact **priority / impact / confidence** indicators.
2. **Act** — each card exposes the relevant existing action (Wear → log wear;
   Buy/Skip → open Advisor; Pack → open trip; Clean → mark/care; Explore → open
   recommendations in explore mode). No new write logic; it links into existing
   flows.
3. **Explain (optional)** — "Explain my priorities" narrates the list via the AI
   Runtime `Explanation` capability (RFC-014).
4. **Supporting analytics** — the existing Health / Usage / Insights surfaces
   remain, linked as the "why" behind the actions (the Center leads; analytics
   support).

States: **empty** (no actions — everything's healthy), **cold** (thin data → few,
low-confidence actions, labelled), **normal**, and **developer** (a debug view
showing each card's impact breakdown + source). The Center runs server-side on
demand (like Health/Insights); the view reads a cached result.

## 6. Architecture

The Intelligence Center is a **pure domain engine** (`src/domain/intelligence-center`,
proposed) that consumes already-computed engine outputs and produces one ranked
action list. It adds no I/O and no AI.

```
Deterministic engines (via the Intelligence Orchestrator — RFC-005)
  recommendation · health · usage · acquisition · personalization · lifestyle · weather · vision
        ↓  ExecutionReport / assembled context
Action Generator        (each engine output → candidate ActionCard[])          ← PURE
        ↓
Priority Engine         (dedupe by type+subject · impact score · rank)         ← PURE
        ↓
Intelligence Center     (IntelligenceCenterResult: TopActions + metadata)
        ↓
AI Explanation          (RFC-014 Explanation capability; consumes, never ranks)
```

### Domain Layer
- **`ActionGenerator`** (pure) — one mapper per source engine, each turning that
  engine's output into zero or more candidate `ActionCard`s with a **provisional
  impact + confidence** read from the engine's own signals. Sources → action types:

  | Source engine | Action type(s) |
  | --- | --- |
  | Recommendation v2 (top outfit) | `Wear` |
  | Personalization v2 (explore mode / under-used) + Usage (under-rotation) | `Explore`, `Rotate` |
  | Usage (over-rotation) | `Rotate` |
  | Buy vs Skip (buy verdict) + Health (gaps) | `Buy` |
  | Buy vs Skip (skip verdict) | `Skip` |
  | Lifestyle (laundry) + care | `Clean` |
  | Lifestyle (trip packing) | `Pack` |
  | Health (worn-out / duplicates) + acquisition | `Replace` |

- **`PriorityEngine`** (pure) — dedupes candidates (same `type` + `subject`
  collapse; keep max impact, merge reasons/codes), computes the final **impact**
  (0–1) from the candidate's provisional impact weighted by source reliability +
  confidence, derives a **priority** bucket (`critical`/`high`/`medium`/`low`) from
  impact, and returns them **ranked by impact** (then priority, then stable id
  tie-break).
- **`IntelligenceCenter`** entry (pure) — `buildIntelligenceCenter(sources,
  options) → IntelligenceCenterResult` = generate → prioritise → assemble; caps to
  `topN`; records per-card breakdown for debug.
- **Types** — `ActionType`, `ActionCard`, `ActionPriority`,
  `IntelligenceCenterResult`, `ActionSource`, `ActionReasonCode`.

Engines are **not** modified. The Center reads their outputs; protected/avoided
handling, weather-appropriateness, etc. are already baked into those outputs.

### Service Layer
- `src/features/intelligence/services/intelligence-center.service.ts` — assembles
  the sources (reusing the recommendation-context + orchestrator data path), calls
  `buildIntelligenceCenter`, returns `{ data, error }`, and caches the result
  (ADR-006) keyed on a source fingerprint.

### Repository Layer
None new. Compute-only; sources come from existing services/repositories.

### UI Layer
- `src/features/intelligence` — an Intelligence Center view + `useIntelligenceCenter`
  hook + the `/intelligence` route (and a nav entry / Today promotion). Cards link
  into **existing** feature flows for execution.

### AI Layer
- Optional narration via the RFC-014 **`Explanation`** capability, fed the
  already-ranked `IntelligenceCenterResult`. **AI never generates or reorders
  actions** (ADR-005).

## 7. Data Flow

```
service.getIntelligenceCenter(filters)                                { data, error }
  → assemble sources (orchestrator ExecutionReport + recommendation context)
      recommendation · health · usage · acquisition · personalization · lifestyle · weather · vision
  → ActionGenerator: for each source → candidate ActionCard[]         ← PURE
        (provisional impact + confidence from the source's own signals)
  → PriorityEngine:                                                    ← PURE
        • dedupe by (type, subject) — keep max impact, merge reasons + codes
        • impact = f(provisional impact, source reliability, confidence)   ∈ [0,1]
        • priority = bucket(impact)
        • rank by (impact desc, priority, id)
  → IntelligenceCenterResult { topActions[], generatedAt, metadata }
  → [optional] AI Explanation (RFC-014) — narrates the list, no recompute
```

Generation, dedup, impact scoring, and ranking are pure and side-effect-free:
identical engine outputs + `generatedAt` ⇒ identical `TopActions`.

## 8. Data Model / Schema Impact

**No schema changes.** The Intelligence Center is compute-only — it reads existing
engine outputs and returns a result, recomputed on demand (like `WardrobeHealth` /
`InsightReport`). No new tables/columns; nothing persisted. (A future
`intelligence_action_log` for "did the user act on it" analytics would be additive
and its own RFC — noted, not built.)

## 9. API / Domain Contracts

Illustrative (final names settled at implementation). Impact + confidence are 0–1.

```ts
// src/domain/intelligence-center/types.ts  (design)

export type ActionType =
  | "wear" | "buy" | "skip" | "clean" | "rotate" | "pack" | "replace" | "explore";

export type ActionPriority = "critical" | "high" | "medium" | "low";

export type ActionSource =
  | "recommendation" | "health" | "usage" | "acquisition"
  | "personalization" | "lifestyle" | "weather" | "vision";

export type ActionReasonCode =
  | "top_recommendation" | "over_rotation" | "under_rotation" | "stale_item"
  | "wardrobe_gap" | "buy_verdict" | "skip_verdict" | "laundry_due"
  | "trip_packing" | "worn_out" | "duplicate" | "explore_underused";

/** One prioritised, typed action. */
export interface ActionCard {
  id: string;
  type: ActionType;
  /** What the action is about (item / outfit / category / trip). */
  subject: { kind: "item" | "outfit" | "category" | "trip" | "prospective_item"; id?: string; label: string };
  priority: ActionPriority;
  /** 0–1 — how much doing this improves the wardrobe/day. Drives ranking. */
  impact: number;
  /** 0–1 — how sure the source engine is. */
  confidence: number;
  /** Short human sentence (deterministic template). */
  reason: string;
  reasonCodes: ActionReasonCode[];
  /** Engines that contributed to this (≥1 after dedup). */
  sources: ActionSource[];
  /** Optional deep-link target for the existing feature flow. */
  href?: string;
  /** Debug: per-source provisional impact + how the final impact was formed. */
  debug?: { provisionalImpact: number; sourceReliability: number };
}

/** THE standardized output. The Intelligence Center view + AI read this. */
export interface IntelligenceCenterResult {
  topActions: ActionCard[];
  generatedAt: string;
  metadata: {
    engineVersion: string;
    candidateCount: number;      // before dedup
    dedupedCount: number;        // after dedup
    bySource: Partial<Record<ActionSource, number>>;
  };
}

/** The already-computed engine outputs the Center aggregates. */
export interface IntelligenceSources {
  recommendation?: unknown;      // RecommendationResult (RFC-012)
  health?: unknown;              // WardrobeHealth
  usage?: unknown;               // UsageAnalytics
  insights?: unknown;            // InsightReport
  acquisition?: unknown;         // BuyVsSkipAnalysis[]
  personalization?: unknown;     // UserPreferenceProfile (RFC-013) + explore/exploit
  lifestyle?: unknown;           // LifestylePlan (RFC-006)
  weather?: unknown;             // WeatherSnapshot (RFC-011)
  vision?: unknown;              // ProspectiveItemCandidate (RFC-002/003)
}

export function buildIntelligenceCenter(
  sources: IntelligenceSources,
  options?: { generatedAt?: string; topN?: number },
): IntelligenceCenterResult;
```

### Impact + priority (deterministic)

```
provisionalImpact(action)  = from the source engine's own signal
    e.g. health gap severity, cost-per-wear delta, over-rotation ratio,
         recommendation score, laundry urgency — normalised to 0–1
impact(action)  = clamp01( provisionalImpact · sourceReliability · (0.5 + 0.5·confidence) )
priority        = impact ≥ 0.8 → critical · ≥ 0.6 → high · ≥ 0.35 → medium · else low
rank            = impact desc, then priority, then id (stable, deterministic)
```

`sourceReliability` and the priority cut-offs are tunable constants (calibrated
with tests, like every other engine). Dedup merges candidates sharing
`(type, subject)`: the surviving card takes the **max** impact, the union of
`sources` + `reasonCodes`, and a merged reason.

## 10. Acceptance Criteria

This RFC is **Approved-ready** when it defines all of the below (it does):

- [ ] One aggregated `IntelligenceCenterResult` (`TopActions`) from all eight
      sources, via the pure `buildIntelligenceCenter`.
- [ ] The typed action set (`wear/buy/skip/clean/rotate/pack/replace/explore`) and
      the source → action-type mapping.
- [ ] Deterministic **impact** scoring + ranking, and the priority buckets.
- [ ] **Deduplication** by (type, subject) with reason/source merging.
- [ ] Per-action metadata: priority, impact, confidence, reason + reason codes +
      sources, and a debug breakdown.
- [ ] Composition **through the Orchestrator** (no direct engine calls); AI
      explanation via the RFC-014 `Explanation` capability.
- [ ] Non-goals (no AI decisions, no new verdicts, no notifications, no write
      logic, no schema changes).
- [ ] Testing plan, risks, future extensions.

Implementation-time acceptance criteria (tracked in that PR — not this RFC):
- [ ] **Prioritised actions** — the list is ranked by impact deterministically.
- [ ] **No duplicate actions** — overlapping candidates collapse to one.
- [ ] **Impact score** — every card has a 0–1 impact driving its rank.
- [ ] **Confidence** — every card carries the source's confidence.
- [ ] **Explainability** — every card has a reason + reason codes + sources;
      removing AI leaves the list + order unchanged.
- [ ] Determinism — same engine outputs + `generatedAt` ⇒ identical `TopActions`.

## 11. QA / Testing Plan

- **Unit tests (Vitest, pure):**
  - Per-source generators: a fixture engine output → the expected candidate
    action(s) with the right type + provisional impact (e.g. a health gap →
    `Buy`; over-rotation → `Rotate`; laundry → `Clean`; top rec → `Wear`).
  - Dedup: two sources flagging the same (type, subject) → one card with merged
    reasons/sources and the max impact.
  - Impact + ranking: crafted impacts → expected order; priority buckets at the
    threshold boundaries; stable id tie-break.
  - Confidence pass-through and the impact formula (reliability × confidence).
  - Empty/cold: no signals → empty list; thin data → few, low-confidence, labelled.
  - Determinism: same sources + `generatedAt` ⇒ identical result (deep-equal).
- **Golden scenario:** a fixture wardrobe (gap + over-rotation + a skip verdict +
  a trip with laundry) → an expected `TopActions` table, guarding calibration.
- **Integration guard:** the service assembles sources via the orchestrator and
  the Center consumes them; no engine is called directly.
- **AI guard:** a fake-AI test asserts the action list + order are unchanged with
  or without narration.
- **Release gate:** `npm test`, `npm run lint`, `npm run build` green (ADR-008).

## 12. Risks & Trade-offs

- **Action overload.** Aggregating eight engines could produce a wall of actions.
  *Mitigation:* dedup + `topN` cap + impact ranking; show only the top handful,
  with the rest behind "more".
- **Cross-engine conflicts.** Recommendation says "wear the navy chinos" while
  usage says "you over-wear them". *Mitigation:* these are different action types
  on the same subject; the Priority Engine surfaces the higher-impact one and can
  suppress the conflicting lower-impact one (documented rule), rather than showing
  contradictory cards.
- **Impact calibration.** Normalising heterogeneous engine signals to one 0–1
  scale is heuristic. *Mitigation:* `sourceReliability` + per-source normalisation
  are tunable constants with golden tests; the debug breakdown makes mis-weights
  visible.
- **Duplication of the InsightEngine.** The Center overlaps with `topActions`.
  *Trade-off:* the Center **supersedes** InsightEngine's `topActions` as the
  action surface (typed/deduped/cross-engine); InsightEngine stays as the
  analytics source feeding health/usage insights. Documented to avoid two
  competing "what to do" lists.
- **Scope creep toward decisions.** A ranking layer could tempt new verdicts.
  *Mitigation:* hard non-goal — impact is derived only from existing engine
  signals; the Center invents no conclusion (ADR-005).
- **Latency (fan-out).** Assembling every engine per request is heavier than one.
  *Mitigation:* reuse the orchestrator's single context assembly + result cache
  (ADR-006); the Center itself is linear in candidate count.

## 13. Future Extensions

- **Action feedback loop** — capture "acted / dismissed" per card (additive
  `intelligence_action_log`) to feed RFC-013 signals and tune impact over time.
- **Scheduled digest** — a daily "today's priorities" (would require the
  notifications capability, currently out of scope).
- **Calendar-aware actions** — `Pack` / `Clean` timed to trips and events once
  calendar integration lands.
- **Explain-why traces** — richer per-action narration via the AI Runtime,
  including the supporting analytics.
- **Cross-action bundles** — group related actions ("prep for your Goa trip":
  pack + clean + buy-the-missing-sandals) into a single composite card.
- **Impact learning** — adjust `sourceReliability` from observed outcomes
  (deterministic recalibration, never a model).

## 14. Open Questions

1. **Surface** — a dedicated `/intelligence` route, or promote it as the lead
   section of the Today home (which already shows some actions)? Both, with Today
   showing the top 3 and linking to the full Center?
2. **Relationship to `InsightEngine.topActions`** — does the Center fully replace
   it as the action surface (InsightEngine becomes analytics-only), or do they
   coexist during a transition?
3. **Impact normalisation** — what per-source normalisation turns each engine's
   native signal (health severity, cost-per-wear, over-rotation ratio, rec score)
   into a comparable 0–1 impact, and what are the `sourceReliability` weights?
4. **Conflict policy** — when two action types target the same subject
   (Wear vs Rotate on the same item), do we show both, suppress the weaker, or
   merge into a nuanced single card?
5. **How many actions** — what `topN` default reads as "prioritised, not
   overwhelming" (5? 7?), and is it user-configurable?
6. **Sourcing lifestyle/vision** — Lifestyle (trip) and Vision (screenshot) are
   *contextual* (only relevant when a trip/scan exists). Are their actions included
   only when that context is present, and how is that detected?
7. **Orchestrator coupling** — does the Center consume a single orchestrator
   `ExecutionReport`, or a purpose-built `IntelligenceSources` bundle the service
   assembles (lighter, but another assembler)?
