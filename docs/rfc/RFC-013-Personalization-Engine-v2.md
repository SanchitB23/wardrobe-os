# RFC-013: Personalization Engine v2

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Claude (Opus 4.8)
Target Release: v1.1.0
Epic: Intelligence Refinement
Priority: Critical
Effort: L
Dependencies:
- RFC-004 Personalization Engine (`src/domain/personalization`) — the v1 engine this refines; already declares the `PreferenceLifecycle` / `PreferenceTimeline` / `PreferenceEvolution` shapes and the reserved `DerivedPreference.lifecycle` / `since` fields this RFC **promotes from reserved to produced**
- RFC-012 Recommendation Engine v2 (`src/domain/recommendation/v2`) — the primary consumer; gains lifecycle- and explore/exploit-aware scoring
- RecommendationContext + `toPreferenceSnapshot` (`src/domain/personalization/PersonalizationIntegration.ts`) — the seam the profile flows through into recommendation
- StyleDNAEngine, UsageAnalyticsEngine, WardrobeHealthEngine — existing signal/context sources (unchanged)
- AI explanation layer (`src/ai`) — existing; narrates the profile, never derives it
- ADR-002 (RecommendationContext), ADR-005 (AI does not decide), ADR-006 (caching), ADR-008 (release/versioning)

> **Revision note:** v1 (RFC-004) deliberately declared `PreferenceLifecycle`,
> `PreferenceTimeline`, `PreferenceEvolution`, and the reserved
> `DerivedPreference.lifecycle` / `since` fields as **future concepts, not
> computed**. This RFC implements exactly those declared shapes, adds an
> explore/exploit control, and threads the richer profile into Recommendation
> Engine v2. It changes no core philosophy.

---

## Personalization Philosophy

The three-layer split from RFC-004 is unchanged; v2 only makes the middle layer
richer and more inspectable:

- **Behaviour is the source of truth.** What the user wears, keeps, favourites,
  buys, edits, and accepts/rejects is the ground truth about their taste.
- **The engine derives, deterministically.** A pure domain engine turns the
  behavioural record into a `UserPreferenceProfile` — now with a **lifecycle**
  per preference, a re-derivable **timeline**, an **evolution** audit, and a
  clearer **confidence vs stability** split. No model, no training, no randomness.
- **AI only explains.** Natural-language narration of the (already-derived)
  profile stays in the AI layer. AI never derives, weights, classifies, or edits
  a preference or its lifecycle.

**Preferences remain recalculated, never mutated.** Every run derives the entire
profile — and now every *timeline point* and *lifecycle* — from the full signal
history as of `generatedAt`. Nothing is journaled or incrementally nudged: the
timeline is produced by **re-running the derivation over successive historical
windows**, and lifecycle/evolution are **read off** those windows. This keeps the
engine pure and reproducible (same history + same `generatedAt` ⇒ same profile,
timeline, and lifecycle) and keeps ADR-005 intact — the engine *derives* data;
Recommendation Engine v2 still makes every ranking decision.

## 1. Problem Statement

Personalization Engine v1 (RFC-004) shipped the important foundation: it derives
a `UserPreferenceProfile` from behaviour, each preference carrying a **weight**, a
**confidence**, a distinct **stability**, and an evidence trace, with user
overrides that always win. Recommendation Engine v2 (RFC-012) now consumes that
profile as a first-class scoring dimension.

But the profile is still essentially **a single point in time**. It cannot answer
the questions that make personalization feel intelligent and trustworthy:

- **Which preferences are established vs new vs fading?** v1 computes `stability`
  but never classifies a preference as **core** (strong, sustained), **emerging**
  (rising recently), **declining** (fading), or **avoided** (net-negative). The
  `PreferenceLifecycle` type and the `DerivedPreference.lifecycle` field exist but
  are **reserved and unset**.
- **How has a preference moved over time?** There is no **timeline** (navy rising,
  grey fading; formality drifting toward smart-casual). `PreferenceTimeline` is
  declared but never produced.
- **What changed between derivations, and why?** There is no **evolution** record
  (before → after, which signal, reason, when). `PreferenceEvolution` is declared
  but never produced.
- **How hard should recommendations lean on known taste?** There is no
  **explore/exploit** control: v2 always weights preference fit the same way, so a
  user cannot ask for "more of what I love" (exploit) or "help me use what I
  neglect" (explore). This is also the main mitigation for the filter-bubble risk
  both RFCs flagged.
- **Is the confidence-vs-stability distinction legible?** v1 models both but the
  Taste Profile UI doesn't clearly separate "how sure are we now" from "how
  consistently has this held", so users can't tell a confident-but-new preference
  from a long-held quiet one.

The data to answer all of this already exists in the signal history; v1 simply
doesn't project it across time or expose the controls. We need a **Personalization
Engine v2** that computes lifecycle, timeline, and evolution deterministically,
adds an explore/exploit setting, sharpens the confidence/stability split, threads
all of it into Recommendation Engine v2, and surfaces it in a better Taste Profile
UI — with **no ML and no AI-derived preferences**.

## 2. Goals

Improve personalization **quality and explainability** without changing the
philosophy — behaviour is truth, the engine derives, AI explains:

- **Preference lifecycle.** Classify every derived preference as `core`,
  `emerging`, `declining`, or `avoided`, deterministically, from its
  weight/stability/recent-trend. Populate the reserved
  `DerivedPreference.lifecycle`.
- **Preference timeline.** Produce a `PreferenceTimeline` per top preference — its
  weight/confidence/stability (and lifecycle) across rolling/monthly windows —
  with a trend direction, by re-deriving over historical windows. Populate the
  reserved `DerivedPreference.since`.
- **Preference evolution.** Produce a `PreferenceEvolution` audit — before/after,
  the driving signal, a reason, and a timestamp — for how the profile changed
  between the previous window and now.
- **Explore/exploit control.** A user setting (`exploit` / `balanced` / `explore`)
  that deterministically changes how strongly Recommendation Engine v2 leans on
  known preferences vs surfaces under-used but compatible items.
- **Better stability modelling.** Keep confidence and stability distinct and make
  the distinction legible; use the timeline to compute stability more robustly
  (spread + persistence across windows) than a single-window heuristic.
- **Better recommendation integration.** Feed lifecycle and the explore/exploit
  mode into Recommendation Engine v2 so ranking reflects them, while never
  overfitting to repeated behaviour.
- **Better Taste Profile UI.** A timeline section, lifecycle badges, a clear
  confidence/stability display, override visibility, and a preference debug mode.
- Stay **pure, deterministic, and fully unit-testable** (injected time, fixture
  histories); same history + `generatedAt` ⇒ identical profile/timeline/lifecycle.

## 3. Non-Goals

Explicitly **out of scope** for RFC-013 (verbatim from the brief, plus guardrails):

- **No ML.** No model, training, embeddings, clustering, or online learning. All
  "learning" remains deterministic aggregation with decay over the user's own
  tables.
- **No AI-derived preferences.** AI never derives, weights, classifies lifecycle,
  computes a timeline, or edits a preference (ADR-005). It explains only.
- **No chat memory.** The engine learns from wardrobe behaviour, not conversation.
- **No external profile.** No third-party personalization platform.
- **No multi-user profile.** Single-owner app; one profile.
- **No cloud sync.** The profile is derived per request from server-side data.
- **No new persisted profile / timeline / evolution.** These are **re-derived on
  demand**, never journaled (same purity rule as v1). No new signal *types*
  beyond RFC-004's.
- **No new recommendation logic here.** RFC-013 feeds RFC-012; it does not change
  how v2 scores beyond consuming lifecycle + the explore/exploit weights.

## 4. User Stories

- As the owner, I want to see that "navy" and "smart-casual sneakers" are **core**
  parts of my taste while "loud graphic tees" are **declining**, so the profile
  matches how I actually dress now.
- As the owner, I want a **timeline** showing my formality drifting from formal
  toward smart-casual over the last year, so I can see my taste evolve.
- As the owner, I want to know **why** the profile changed ("navy overtook grey
  after 8 recent wears"), via an evolution/debug view.
- As the owner, I want an **explore** mode that deliberately surfaces good outfits
  using items I've neglected, and an **exploit** mode that leans into my proven
  favourites — and I want the recommendations to visibly change when I switch.
- As the owner, I want to tell a **confident-but-new** preference apart from a
  **long-held quiet** one, so I trust the profile and know what's still forming.
- As the owner, I want my **overrides** to keep winning and to see clearly which
  preferences are pinned/adjusted/suppressed.
- As a developer, I want a preference **debug mode** exposing lifecycle inputs,
  window-by-window derivation, and the explore/exploit weight effect.

## 5. UX Flow

Primary surface: the existing **Taste Profile** view (`/settings/preferences`),
extended — not replaced.

1. **Overview (v1, refined).** Grouped, ranked preferences per dimension, each now
   showing a **lifecycle badge** (core / emerging / declining / avoided), a
   **confidence** indicator and a **distinct stability** indicator, a `since`
   date where known, and the one-line **because** reason. Avoided and protected
   items listed separately. Overrides visibly marked (pinned / adjusted /
   suppressed).
2. **Timeline section (new).** For top preferences, a small time series
   (weight/lifecycle across monthly or rolling windows) with a **trend arrow**
   (rising / steady / falling). Read-only visualization.
3. **Evolution / debug (new, Developer Mode).** A preference **debug mode** that
   lists recent evolution entries (before → after, signal, reason, timestamp), the
   window-by-window derivation, the confidence/stability inputs, and the current
   explore/exploit weight effect.
4. **Explore/Exploit control (new).** A three-way setting — **Exploit** (prefer
   known favourites) · **Balanced** (default) · **Explore** (surface underused but
   compatible items) — with a one-line explanation of what it changes. Persisted
   and applied to every recommendation.
5. **Explain (optional).** "Explain my taste profile" narrates the already-derived
   profile (incl. lifecycle/trend) via the AI layer — never recomputing it.

States: **cold start** (thin history → low-confidence profile, lifecycle mostly
`emerging`, timeline sparse, clearly labelled "still learning"), **normal**,
**override-heavy**, and **conflicting** (derivation vs a pin → pin wins, surfaced).
The engine runs server-side on demand (like v1); the view reads a cached profile
and offers manual refresh.

## 6. Architecture

Personalization v2 stays a **pure domain engine** (`src/domain/personalization`)
that aggregates the same behavioural signals — it adds *time projection* and
*classification*, not new data sources.

```
Behaviour Signals (wear_logs, outfits, favourites, purchases, + captured signals)
        ↓  deriveSignals(...)  → PreferenceSignal[]                         ← PURE (v1)
        ↓
Personalization Engine v2
   • derive the point-in-time profile as today (v1 core, unchanged)
   • re-derive over successive historical windows → per-preference series   ← PURE
   • classify lifecycle (core/emerging/declining/avoided) from weight + stability + trend
   • compute stability from cross-window spread + persistence (sharper than v1)
   • diff current vs previous window → PreferenceEvolution
   • apply overrides last (pin/adjust/suppress) — overrides always win
        ↓
UserPreferenceProfile      (now: lifecycle + since populated per DerivedPreference)
        ↓
PreferenceTimeline[]       (per top preference — for visualization + stability)
PreferenceEvolution[]      (audit/debug of what changed and why)
        ↓
RecommendationContext      (profile → toPreferenceSnapshot, + lifecycle + explore/exploit mode)
        ↓
Recommendation Engine v2   (RFC-012 — lifecycle- & explore/exploit-aware scoring)
        ↓
[optional] AI explanation  (consumes the profile; never derives it)
```

### Domain Layer

- **`PersonalizationEngine` v2** (`src/domain/personalization/PersonalizationEngine.ts`).
  Pure; `generatedAt` injected. Keeps `derivePreferenceProfile(input, options)`
  and adds:
  - **Windowed re-derivation** — a helper that runs the existing single-window
    derivation over a sequence of historical windows (monthly or rolling, size/step
    tunable) to produce, per preference, a series of `{ at, weight, confidence,
    stability, lifecycle }` points. Pure re-use of the v1 math; no new signal model.
  - **Lifecycle classification** — `classifyLifecycle(series, current)` →
    `core | emerging | declining | avoided`, deterministic from current weight,
    stability, and recent trend (thresholds are tunable constants).
  - **Stability v2** — computed from cross-window **spread** (present throughout vs
    clustered) + **persistence** (sustained, low volatility), replacing the
    single-window heuristic. Still distinct from confidence.
  - **Evolution diff** — `diffProfiles(previousWindow, current)` →
    `PreferenceEvolution[]` (before/after/signal/reason/timestamp).
  - **`since` derivation** — earliest sustained window where the preference became
    dominant (min run length / gap tolerance = tunable), populating
    `DerivedPreference.since`.
- **`derivePreferenceProfileV2` / extended options** — returns the profile plus
  optional `timelines: PreferenceTimeline[]` and `evolution: PreferenceEvolution[]`
  when requested (kept optional so the hot path — recommendation context assembly —
  can skip timeline work).
- **Explore/exploit** — a pure mapping `resolveExploreExploit(mode)` →
  recommendation weight adjustments (see §9). The mode is *data on the context*;
  the engine does not itself rank.
- **Types** — promote the RFC-004 reserved shapes to produced: populate
  `DerivedPreference.lifecycle` / `since`; return `PreferenceTimeline` /
  `PreferenceEvolution`; add `ExploreExploitMode`.

### Service Layer

- `src/features/personalization/services/personalization.service.ts` — extend
  `getPreferenceProfile()` to optionally compute timelines/evolution (cached,
  ADR-006, keyed on signal fingerprint + window params + overrides version), and to
  read the persisted explore/exploit mode.
- The recommendation context builder threads the explore/exploit mode and the
  per-preference lifecycle into `RecommendationContext` (via the preference
  snapshot / an additive field), so RFC-012 can consume them.

### Repository Layer

- **No new tables.** Timeline/evolution are re-derived from existing signals; the
  profile is not persisted (like v1). The **explore/exploit mode** is a single
  lightweight persisted setting (see §8) — client-persisted (like Developer Mode)
  or a small additive settings row, decided at implementation.

### UI Layer

- `src/features/personalization` — extend the Taste Profile view with the timeline
  section, lifecycle badges, confidence/stability display, override visibility, the
  explore/exploit control, and a preference debug mode (Developer Mode). No new
  route.

### AI Layer

- Optional explanation only (existing pattern) — narrates the derived profile
  including lifecycle/trend, fed the already-computed profile. **AI never derives,
  classifies, or edits** any of it (ADR-005).

## 7. Data Flow

```
service.getPreferenceProfile({ withTimeline?, window? })                 { data, error }
  → repositories: read wear_logs + outfits + purchases + favourites (+ captured signals)
  → deriveSignals(...) → PreferenceSignal[]                                          ← PURE
  → load PreferenceOverride[] + explore/exploit mode
  → PersonalizationEngine v2.derive({ signals, overrides }, { generatedAt })         ← PURE
      • current profile (v1 core)
      • for each window w in windows(history, size, step):
            re-derive profile as-of w  → point { at: w.end, weight, confidence, stability }
      • classifyLifecycle(series, current) → lifecycle per preference
      • stability = f(spread, persistence) over the series
      • since = earliest sustained-dominant window
      • evolution = diff(previousWindow, current)
      • apply overrides last (pin/adjust/suppress) — overrides win
  → UserPreferenceProfile (+ lifecycle/since) [+ timelines, evolution if requested]
  → RecommendationContextBuilder: preferences = snapshot(profile);
       context.personalization = { lifecycleByValue, exploreExploit }               (additive)
  → Recommendation Engine v2 (RFC-012): lifecycle- & explore/exploit-aware scoring
  → [optional] AI explanation (no recompute)
```

Every step is pure and side-effect-free. Identical signals + overrides + mode +
`generatedAt` + window params ⇒ identical profile, timelines, lifecycle, and
evolution.

## 8. Data Model / Schema Impact

**No new profile/timeline/evolution tables.** They are recomputed on demand from
the existing signals — the same "not persisted" rule as v1's profile.

**Existing (RFC-004, unchanged):** `preference_overrides`, `preference_signals`,
and the additive `wardrobe_items.protected` / `avoided` columns.

**Explore/exploit mode** is the only new *state*, and it is a single scalar per the
single-owner app. Preferred: **client-persisted** (localStorage, like Developer
Mode) requiring **no schema change**. If server persistence is wanted, a minimal
**additive** settings row (e.g. `app_settings(key, value)`) with the usual anon
RLS — documented here, decided and called out at implementation. This RFC applies
no migration.

## 9. API / Domain Contracts

Illustrative (final names settled at implementation). The lifecycle/timeline/
evolution shapes below **already exist** in `src/domain/personalization/types.ts`
as reserved — v2 promotes them to produced.

```ts
// Promoted from RESERVED → produced (existing shapes):
export type PreferenceLifecycle = "core" | "emerging" | "declining" | "avoided";

export interface DerivedPreference {
  // …existing v1 fields (dimension, value, weight, confidence, stability, source,
  //   reason, evidence)…
  lifecycle: PreferenceLifecycle;   // now POPULATED
  since: string | null;             // now POPULATED (earliest sustained-dominant window)
}

export interface PreferenceTimeline {
  dimension: PreferenceDimension;
  value: string;
  points: {
    at: string;                     // ISO — window end
    weight: number;                 // 0–1
    confidence: number;             // 0–1
    stability: number;              // 0–1
    lifecycle?: PreferenceLifecycle;
  }[];
  trend: "rising" | "steady" | "falling";   // NEW — derived from the series
}

export interface PreferenceEvolution {
  dimension: PreferenceDimension;
  value: string;
  changes: {
    before: number | null;          // prior-window weight (null if newly added)
    after: number | null;           // current weight (null if removed)
    signal: PreferenceSignalType;    // the dominant signal behind the change
    reason: string;                  // human-readable "because"
    timestamp: string;               // ISO
  }[];
}

// NEW — explore/exploit control.
export type ExploreExploitMode = "exploit" | "balanced" | "explore";

/** Deterministic weight adjustments applied to Recommendation Engine v2. */
export interface ExploreExploitWeights {
  /** Multiplier on RFC-012 `personalPreferenceFit`. */
  preferenceFit: number;
  /** Multiplier on RFC-012 `wardrobeHealthContribution` (rotation/novelty). */
  wardrobeHealthContribution: number;
  /** Nudge to the diversity threshold (explore → more diverse). */
  diversityBias: number;
}

export function resolveExploreExploit(mode: ExploreExploitMode): ExploreExploitWeights;

/** Extended entry point (v1 signature preserved; new options are additive). */
export function derivePreferenceProfileV2(
  input: PersonalizationInput,
  options?: {
    generatedAt?: string;
    withTimeline?: boolean;         // compute PreferenceTimeline[] + PreferenceEvolution[]
    window?: { sizeDays: number; stepDays: number; count: number };
  },
): {
  profile: UserPreferenceProfile;   // lifecycle + since populated
  timelines?: PreferenceTimeline[];
  evolution?: PreferenceEvolution[];
};
```

### Lifecycle classification (deterministic)

Read off the windowed series + current point; thresholds are tunable constants
(calibrated with tests):

| Lifecycle | Condition (illustrative) |
| --- | --- |
| **core** | high current weight **and** high stability (present + steady across windows). |
| **emerging** | rising recent trend, meaningful current weight, but **not yet** stable. |
| **declining** | previously strong (earlier windows high) but recent weight falling. |
| **avoided** | net-negative signal (rejections outweigh positives) — the value the user steers away from. |

### Explore/exploit mapping (deterministic)

| Mode | `preferenceFit` | `wardrobeHealthContribution` | `diversityBias` |
| --- | --- | --- | --- |
| **exploit** | ↑ (lean into known favourites) | ↓ | slightly ↓ |
| **balanced** (default) | 1× | 1× | 0 (RFC-012 defaults) |
| **explore** | ↓ | ↑ (surface underused, compatible) | ↑ (more varied top-K) |

The mode only **re-weights** RFC-012's existing dimensions/diversity — it never
adds a new decision, and `exploit` never disables diversity or the hard
constraints (avoided/retired/severe mismatch still reject). This is the
first-class mitigation for the filter-bubble risk both RFCs flagged.

### Stability v2 (deterministic)

`stability = g(spread, persistence)` over the timeline series — **spread**
(preference present across the whole window set, not clustered) and **persistence**
(sustained across sub-periods, low volatility). Distinct from **confidence**
(evidence volume + agreement *now*): a value can be confident-but-new (high
confidence, low stability) or long-held-quiet (moderate confidence, high
stability).

## 10. Acceptance Criteria

This RFC is **Approved-ready** when it defines all of the below (it does):

- [ ] The windowed re-derivation model (pure re-use of v1 math over historical
      windows) producing per-preference series, and its determinism.
- [ ] Lifecycle classification (`core`/`emerging`/`declining`/`avoided`) from
      weight + stability + trend, populating `DerivedPreference.lifecycle`.
- [ ] `PreferenceTimeline` (with `trend`) and `since` derivation.
- [ ] `PreferenceEvolution` (before/after/signal/reason/timestamp) diffing.
- [ ] The explore/exploit control (`exploit`/`balanced`/`explore`) and its
      deterministic mapping to RFC-012 weights/diversity, with hard constraints
      never bypassed.
- [ ] Sharper stability (spread + persistence) kept distinct from confidence.
- [ ] The integration path into Recommendation Engine v2 (lifecycle + mode via the
      context), and the anti-overfitting guarantee.
- [ ] The Taste Profile UI additions (timeline, lifecycle badges,
      confidence/stability, override visibility, debug mode).
- [ ] Schema impact documented as **no new tables** (timeline/evolution re-derived;
      explore/exploit a lightweight persisted setting).
- [ ] Non-goals (ML, AI-derived preferences, chat memory, external profile,
      multi-user, cloud sync).
- [ ] A testing plan, risks, and future extensions.

Implementation-time acceptance criteria (tracked in that PR — not this RFC):
- [ ] **Preferences have a lifecycle** — every derived preference is classified.
- [ ] **Preference trends are visible** — timelines render with a trend direction.
- [ ] **Explore/exploit changes recommendation behaviour** — the same wardrobe
      yields measurably different rankings under `exploit` vs `explore` (more
      under-used items surfaced), verified against RFC-012.
- [ ] **AI does not derive preferences** — removing AI leaves the profile,
      lifecycle, timeline, and evolution identical.
- [ ] **Profile remains deterministic** — same signals + overrides + mode +
      `generatedAt` + windows ⇒ identical output.
- [ ] **Old behaviour decays correctly** — recency decay observable in the
      timeline; declining preferences classified as such.
- [ ] **Overrides still win** — pin/adjust/suppress survive contradicting
      derivation and are marked in the UI.
- [ ] **Recommendation Engine v2 consumes the profile safely** — missing lifecycle
      / cold-start / balanced-mode degrade to today's v2 behaviour.

## 11. QA / Testing Plan

- **Unit tests (Vitest, pure engine) — the core:**
  - Windowed re-derivation determinism: same history + windows ⇒ identical series.
  - Lifecycle: fixtures for each of core / emerging / declining / avoided →
    expected classification; boundary/threshold behaviour.
  - Timeline: a rising preference shows increasing weight + `trend: "rising"`; a
    fading one shows `"falling"`; `since` is the earliest sustained-dominant window
    and is stable across runs.
  - Evolution: a value overtaking another between windows produces the expected
    before/after/signal/reason entry.
  - Stability v2 vs confidence independence: confident-but-new → high confidence /
    low stability; long-held-quiet → high stability / moderate confidence.
  - Explore/exploit: `resolveExploreExploit` returns the specified weights;
    integrated with RFC-012, `explore` surfaces more under-used items and `exploit`
    concentrates on high-preference items — **without** bypassing hard constraints
    or returning near-duplicate top-K.
  - Decay: old signals contribute less; a once-core preference with no recent
    signals becomes `declining` then drops.
  - Overrides win: pinned/suppressed/adjusted preferences survive and are flagged.
  - Cold start: thin history → low confidence, mostly `emerging`, sparse timeline,
    labelled.
- **Integration guard (with RFC-012):** the profile maps onto the recommendation
  context and v2 consumes lifecycle + mode; balanced mode reproduces current v2
  rankings (equivalence), explore/exploit shift them as specified.
- **AI guard:** a fake-AI test asserts the profile/lifecycle/timeline are unchanged
  whether or not AI runs.
- **Service/UI (at implementation):** service returns `{ data, error }`; preview
  verification of the timeline, lifecycle badges, confidence/stability, override
  visibility, debug mode, and the explore/exploit control changing recommendations.
- **Release gate:** `npm test`, `npm run lint`, `npm run build` green (ADR-008). No
  model calls in the automated suite.

## 12. Risks & Trade-offs

- **Filter bubble / self-reinforcement.** *Mitigation:* the explore/exploit control
  is the explicit lever; explore up-weights rotation/diversity; lifecycle lets v2
  avoid over-indexing on `core` values; hard constraints and diversity always
  apply.
- **Windowing cost.** Re-deriving over N windows multiplies work. *Mitigation:*
  timelines are opt-in (`withTimeline`) and cached; the recommendation hot path
  needs only the point-in-time profile + lifecycle, not the full series; window
  count is bounded and tunable.
- **Calibration risk.** Lifecycle thresholds, window size/step, and `since` run-
  length are heuristics. *Mitigation:* tunable constants + golden-scenario tests;
  the timeline + evolution make misclassification debuggable.
- **Determinism across windows.** More derivations = more chances for
  nondeterminism. *Mitigation:* every window derivation is a pure function of the
  signal slice + injected `generatedAt`; no wall-clock, no randomness; determinism
  is an explicit test.
- **Sparse history.** Timelines/lifecycle are weak early. *Mitigation:* explicit
  cold-start labelling; `emerging` default; low confidence surfaced, never
  presented as certain.
- **Overrides vs lifecycle conflict.** *Mitigation:* overrides win and are surfaced
  ("we noticed X declining, but you pinned it").
- **Integration regression.** Threading new fields into RFC-012 could shift
  rankings. *Mitigation:* balanced mode is the default and reproduces current v2
  behaviour (equivalence tests); lifecycle/mode consumption degrades gracefully
  when absent.

## 13. Future Extensions

- **Per-occasion sub-profiles** — distinct lifecycles for office vs weekend vs
  travel, once occasion signal volume supports it.
- **Preference-trend explanations** — an AI narration of the timeline ("your taste
  shifted toward smart-casual since spring") consuming the derived series.
- **Seasonal lifecycle** — recognise cyclical preferences (heavy knits every
  winter) instead of classifying them `declining` in summer.
- **Adaptive explore/exploit** — suggest a mode based on wardrobe health (e.g. lean
  explore when utilisation is low), still user-overridable.
- **Recommendation feedback loop** — feed RFC-012 accept/reject back as the
  captured `recommendation_accepted/rejected` signals RFC-004 reserved, sharpening
  lifecycle over time.
- **Evolution-driven insights** — surface notable lifecycle transitions in the
  Insights/Today surfaces ("navy is now a core colour for you").

## 14. Open Questions

1. **Window size/step/count.** Monthly windows, or rolling (e.g. 90-day window,
   30-day step)? How many windows before cost outweighs signal, given one active
   wardrobe with ~1–2 years of history?
2. **Lifecycle thresholds.** Exact weight/stability/trend cut-offs separating
   core / emerging / declining, and are they tunable constants or user-visible?
3. **`since` semantics.** Minimum run length and gap tolerance for "earliest
   sustained-dominant" so the date is stable across runs?
4. **Explore/exploit magnitudes.** What multipliers on `personalPreferenceFit` /
   `wardrobeHealthContribution` (and diversity nudge) give a *noticeable but not
   jarring* shift, and should the middle be a slider rather than three discrete
   modes?
5. **Explore/exploit persistence.** Client-side (localStorage, no schema) or a
   server settings row — and is it global or per-occasion later?
6. **Context threading.** Do lifecycle + mode ride on the existing
   `PreferenceSnapshot`, or a new additive `context.personalization` field
   (cleaner, but touches the context contract)?
7. **Timeline in the hot path.** Confirm the recommendation context never triggers
   timeline computation (opt-in only), so recommendation latency is unaffected.
8. **Avoided lifecycle vs avoided items.** Reconcile the `avoided` *lifecycle*
   (a net-negative preference value) with RFC-004 `avoidedItemIds` (explicit item
   flags) so the UI doesn't conflate them.
