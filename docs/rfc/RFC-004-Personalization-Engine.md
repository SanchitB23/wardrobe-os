# RFC-004: Personalization Engine

Status: Implemented
Owner: Sanchit Bhatnagar
Author: ChatGPT
Target Release: v0.9.0
Epic: Intelligence
Priority: Critical
Effort: XL
Dependencies:
- RecommendationContext + `PreferenceSnapshot` (`src/domain/recommendation`) — existing; today populated by a static `DEFAULT_PREFERENCES`, the seam this engine replaces
- StyleDNAEngine (`src/domain/style-dna`) — existing; the lens preferences are expressed in
- UsageAnalyticsEngine → `UsageAnalytics` (`src/domain/analytics`) — existing; wear-frequency signal source
- WardrobeHealthEngine → `WardrobeHealth` (`src/domain/analytics`) — existing; balance/gap context
- BuyVsSkipEngine (`src/domain/acquisition`, RFC-001) — existing; acquisition-decision signal source + a downstream consumer (`preferenceFit`)
- AI explanation layer (`src/ai`) — existing; used only to narrate a derived profile, never to derive it
- ADR-005 (AI does not decide), ADR-006 (caching), ADR-008 (release/versioning)

---

## Personalization Philosophy

Three layers, one responsibility each — the same split as Vision (RFC-002),
applied to preference learning:

- **Behaviour is the source of truth.** What the user actually wears, keeps,
  favourites, buys, edits, and accepts/rejects is the ground truth about their
  taste. Stated preferences are a starting prior; behaviour corrects it.
- **The engine interprets, deterministically.** A pure domain engine turns the
  behavioural record into a `UserPreferenceProfile` — preferred colours,
  formality, brands, silhouettes, footwear, occasions, plus avoided/protected
  items — each with a **confidence** and a **because** trace. No model, no
  training, no randomness.
- **AI only explains.** Natural-language narration of a derived profile ("you've
  been reaching for navy and knit polos on office days") stays in the AI layer
  and consumes the already-computed profile.

So: **Behaviour → Personalization Engine → `UserPreferenceProfile` →
RecommendationContext.** Learning is deterministic arithmetic over the user's
own history, not machine learning. This keeps ADR-005 intact: the engine
*derives* preferences (data); the recommendation/acquisition engines still make
every scoring and ranking decision.

**Preferences are recalculated, never mutated.** Each run derives the *entire*
`UserPreferenceProfile` from the full signal history as of `generatedAt` — it
does not read the previous profile and nudge it. There is no incremental
"update the weight by +0.03" step and therefore no accumulating state to drift,
corrupt, or replay. This is what makes the engine pure and reproducible: the
profile is a **function of the history**, not the running sum of past updates.
Recency decay lives *inside* that recalculation (older signals simply weigh
less), so the profile still evolves over time — but that evolution is a property
of the input window, not of a stored, mutated accumulator. Any sense of a
preference's *history* (how long it has held, whether it is rising or fading) is
likewise **re-derived from the signals**, not journaled — see `stability` and
the documented future concepts (`PreferenceTimeline`, lifecycle, `since`,
`PreferenceEvolution`) in §9.

**Behaviour remains the single source of truth.** Preferences are never
incrementally mutated and never stored as their own editable state; they are
always deterministically re-derived from behaviour. Change the behaviour (or
add an override) and the next derivation reflects it; nothing else can move a
preference.

## 1. Problem Statement

Wardrobe OS is driven by deterministic engines and **explicit** preferences.
`RecommendationContext.preferences` is populated by a single hardcoded constant,
`DEFAULT_PREFERENCES` — "Smart Casual / Modern / Minimal", "delhi-ncr", a fixed
formality list — calibrated once to the owner and then frozen. Every downstream
engine (recommendation, outfit ranking, Buy vs Skip's `preferenceFit`) reasons
against those static assumptions.

But taste is revealed over time, not declared once. The app already records rich
behaviour — `wear_logs`, saved `outfits`, `purchases`, `favorites`, item edits,
Buy vs Skip verdicts, and (soon) which recommendations the user accepts or
rejects — and **none of it feeds back into preferences.** The user wears the
same three jackets, ignores half the recommendations, favourites a specific
silhouette, and keeps buying knit polos, yet the system's model of "what they
like" never moves.

The result: recommendations drift from reality, the owner re-teaches the app
implicitly every day, and there is no single, inspectable answer to "what does
this wardrobe's owner actually prefer, and how sure are we?"

We need a **deterministic Personalization Engine** that continuously derives a
`UserPreferenceProfile` from behaviour, exposes a confidence and an explanation
per preference, lets the user override any of it, and feeds the result into the
existing `RecommendationContext` — without any AI learning.

## 2. Goals

- Provide a **pure, deterministic** `PersonalizationEngine` that derives a
  `UserPreferenceProfile` from the user's behavioural record (the signal sources
  in §6). Same history + same `generatedAt` ⇒ same profile.
- Produce a **single, inspectable** `UserPreferenceProfile`: preferred colours,
  formality, brands, silhouettes, footwear, commute preferences, care
  tolerance, seasonal preferences, occasion preferences, plus **avoided** and
  **protected** items — each with a numeric **confidence** (0–1, "how sure are
  we?") and a distinct **stability** (0–1, "how consistently has this remained?"),
  plus a short **derivation reason**. (Preference *lifecycle*, *since*, and
  *timeline* are documented future concepts — §9 — not built here.)
- Make every preference **explainable**: each entry records *which signals* and
  *how much* moved it (an auditable "because you wore X 14× and favourited Y").
- Support **user override** of any derived preference (pin/adjust/suppress),
  with overrides always winning over derivation and never being silently
  overwritten by later learning.
- **Replace the static `DEFAULT_PREFERENCES` seam**: the derived profile maps
  onto (and supersedes) `RecommendationContext.preferences`, so existing engines
  benefit with no change to their scoring code. `DEFAULT_PREFERENCES` becomes the
  cold-start prior, not the permanent answer.
- Keep the core principle intact: **the engine derives; AI only explains.** No ML
  training, no model in the derivation path.
- Be fully unit-testable (pure engine, injected time, fixture histories).

## 3. Non-Goals

Explicitly **out of scope** for RFC-004:

- **Chat memory** — remembering conversation turns / stylist dialogue state. The
  engine learns from wardrobe *behaviour*, not from chat history.
- **LLM memory / fine-tuning / embeddings-as-memory** — no model retains or is
  trained on the user. The profile is deterministic arithmetic over tables.
- **Cross-device sync** — no device-to-device reconciliation; the profile is
  derived per request from server-side data.
- **Cloud profile / external profile service** — no third-party personalization
  platform; everything is computed in-app from the user's own Supabase data.
- **ML training of any kind** — no gradient descent, no clustering models, no
  online learning. "Learning" here means deterministic aggregation with decay.
- **New taste from nothing** — the engine does not invent preferences; it only
  amplifies/decays what the behavioural record already implies (cold start falls
  back to the existing prior).
- **AI deciding preferences** — AI never computes, weights, or edits a
  preference or its confidence (ADR-005).

## 4. User Stories

- As the owner, I want the app to notice that I actually wear navy knits and
  sneakers far more than the formal shirts I own, so my recommendations match my
  real habits without me re-configuring anything.
- As the owner, I want to see **why** a preference was inferred ("preferred
  formality: smart-casual — 82% confidence, from 43 of your last 60 wears"), so I
  trust it and can correct it.
- As the owner, I want to **override** a derived preference — pin "I prefer
  black footwear", or suppress "you like blazers" (I only own them for one
  event) — and have that stick regardless of future behaviour.
- As the owner, I want to mark items as **protected** (never suggest donating /
  never flag as unused — e.g. a wedding sherwani) and **avoided** (stop
  recommending / stop suggesting I buy more), and have every engine respect it.
- As the owner, I want the profile to **adapt over time** — a phase where I wore
  lots of formal wear last winter should fade as recent behaviour shifts.
- As a developer, I want one `UserPreferenceProfile` shape that drops into
  `RecommendationContext.preferences`, so no scoring engine needs to change.

## 5. UX Flow

Primary surface: a **Preferences / "What we've learned"** view (candidate route
**`/settings/preferences`** or a **Taste Profile** card under Insights — settled
in §14). The engine itself is infrastructure; its value shows up (a) implicitly
in better recommendations and (b) explicitly in this inspectable profile.

1. **View** — the user opens the profile and sees grouped, ranked preferences
   (colours, formality, brands, silhouettes, footwear, occasions, seasonal,
   commute, care tolerance), each with a **confidence** indicator, a distinct
   **stability** indicator, and a one-line **because** reason. Avoided and
   protected items are listed separately. (Preference *lifecycle* badges,
   *since* dates, and per-preference *timeline* visualizations are documented
   future concepts — §9 — not built here.)
2. **Inspect** — expanding a preference shows its derivation: the contributing
   signals (wears, favourites, purchases, accepted recs…) and their weights.
3. **Override** — for any preference the user can **pin** (lock a value),
   **adjust** (nudge up/down), or **suppress** (hide/ignore). Items can be
   toggled **protected** / **avoided** from the item detail page too.
4. **Explain (optional)** — an "Explain my taste profile" action calls the AI
   layer to narrate the already-derived profile in plain language.

States: **cold start** (little history → low-confidence profile clearly labelled
"still learning", backed by the prior), **normal**, **override-heavy** (user has
pinned many values), and **conflicting** (derivation disagrees with a pin →
pin wins, difference surfaced as "we noticed X, but you set Y").

The engine runs server-side on demand (like Health/Usage analytics); the view
reads a cached profile and offers a manual refresh.

## 6. Architecture

Personalization is a **pure domain engine** that aggregates behavioural signals
into a profile. It adds no new taste model; it composes the existing record.

```
Behaviour (signal sources, already in Supabase)
   ├─ wear_logs           (what/when worn)
   ├─ outfits             (saved/favourited combinations)
   ├─ purchases           (what was actually bought)
   ├─ favorites           (wardrobe_items.favorite, outfits.favorite)
   ├─ recommendation feedback (accepted / rejected)   ← new signal capture (§8)
   ├─ manual edits        (item field corrections)     ← new signal capture (§8)
   └─ acquisition decisions (Buy vs Skip verdicts acted on) ← new signal capture (§8)
        ↓
   PreferenceSignal[]  (normalized, timestamped, typed events)
        ↓
   PersonalizationEngine.derivePreferenceProfile(signals, overrides, options)   ← PURE
        • weight by signal type · recency-decay · aggregate per dimension
        • compute confidence + derivation trace per preference
        • apply user overrides (pin / adjust / suppress) — overrides win
        ↓
   UserPreferenceProfile   (the single standardized output)
        ↓
   RecommendationContext.preferences   (supersedes DEFAULT_PREFERENCES)
        ↓
   Recommendation / Outfit / BuyVsSkip engines (unchanged scoring)
        ↓
   [optional] AI explanation (consumes the profile; never derives it)
```

### Domain Layer
- **`PersonalizationEngine`** (new) — `src/domain/personalization/PersonalizationEngine.ts`.
  - Pure TypeScript. No React, Supabase, AI, or I/O; `generatedAt` injected.
  - `derivePreferenceProfile(input: PersonalizationInput, options?):
    UserPreferenceProfile`.
  - Aggregates `PreferenceSignal[]` per dimension using deterministic
    **signal-type weights** and **recency decay** (§9), computes **confidence**
    (certainty now) and a separate **stability** (historical consistency), and
    records a per-preference derivation trace. (Lifecycle, `since`, and timeline
    are documented future concepts — §9 — not computed here.)
  - **Recalculates the whole profile from the full history each run** — it never
    reads or mutates a previous profile (see Philosophy). Any preference
    "history" is re-derived from signal timestamps, not journaled.
  - Applies `PreferenceOverride[]` last: a pin fixes a value at full confidence,
    an adjust shifts the derived weight, a suppress removes a derived preference.
    Overrides always win and are never overwritten by derivation.
  - Cold start: when evidence is thin, falls back to the existing prior
    (today's `DEFAULT_PREFERENCES`) and labels affected preferences low
    confidence.
- **A pure signal normalizer** — `deriveSignals(...)` mapping raw domain
  records (wears, outfits, purchases, favourites, feedback, edits, verdicts) into
  the uniform `PreferenceSignal[]`, so the engine depends only on normalized
  signals (mirrors how `RecommendationContextBuilder` assembles snapshots).
- **Types** — `src/domain/personalization/types.ts`: `PreferenceSignal`,
  `PreferenceSignalType`, `PersonalizationInput`, `UserPreferenceProfile`,
  `DerivedPreference`, `PreferenceOverride`, `PreferenceDimension`.

### Service Layer
- `src/features/personalization/services/personalization.service.ts` —
  `getPreferenceProfile()` assembles signals via repositories (reuse the
  recommendation-context data path plus the new signal reads), loads user
  overrides, calls `derivePreferenceProfile`, and returns `{ data, error }`.
- Wires the derived profile into the **RecommendationContextBuilder** so
  `context.preferences` is the derived profile (with the prior as fallback),
  replacing the static `DEFAULT_PREFERENCES` seam.
- Caches the derived profile (ADR-006) keyed on a signal-set fingerprint +
  overrides version, with a manual `forceRefresh`.

### Repository Layer
- **Reads:** reuse existing repositories for `wear_logs`, `outfits`,
  `purchases`, and `favorites`. Add reads for the new signal-capture tables
  (§8): recommendation feedback, manual-edit events, acquisition decisions.
- **Writes:** persistence for **overrides** (pin/adjust/suppress, protected,
  avoided) and for the new **signal-capture** events. All additive, anon-RLS
  consistent with the rest of the app (§8). The derived profile itself is **not**
  persisted (recomputed on demand, like Health/Usage).

### UI Layer
- `src/features/personalization/` — a Taste Profile view + `usePreferenceProfile`
  hook + the `/settings/preferences` route (and a nav entry). Item-level
  Protected/Avoided toggles reuse the existing item detail surface.

### AI Layer
- **Optional** explanation only, via the existing AI layer (ADR-004/005/006): a
  `preference-profile-explanation` prompt builder + response schema + parser +
  cache, fed the already-derived `UserPreferenceProfile` (never the raw signals),
  instructed to narrate — not change — the profile.
- Reachable later as a stylist tool (e.g. `getPreferenceProfile`) via the
  tool-calling layer (ADR-007), so chat can reference the user's taste.
- **AI never derives, weights, or edits a preference or its confidence.**

## 7. Data Flow

```
service.getPreferenceProfile()                                   { data, error }
  → repositories: read wear_logs + outfits + purchases + favorites
                  + recommendation feedback + manual edits + acquisition decisions (Supabase)
  → deriveSignals(...) → PreferenceSignal[]        (normalized, typed, timestamped)   ← PURE
  → load PreferenceOverride[] (user pins/adjust/suppress/protected/avoided)
  → PersonalizationEngine.derivePreferenceProfile({ signals, overrides }, { generatedAt })   ← PURE
      • per dimension: Σ (signalWeight · recencyDecay(age)) over contributing signals
      • confidence = f(evidence volume, consistency)              ∈ [0,1]
      • derivation trace per preference (contributing signals + weights)
      • apply overrides last (pin/adjust/suppress) — overrides win
  → UserPreferenceProfile
  → RecommendationContextBuilder: context.preferences = profile (prior as fallback)
  → recommendation / outfit / Buy-vs-Skip engines score as today (unchanged)
  → [optional] Explain → /api/ai/... → AI narrates the profile (no recompute)
```

The derivation step is deterministic and side-effect-free; identical signals +
overrides + `generatedAt` always yield the same `UserPreferenceProfile`.

## 8. Data Model / Schema Impact

The **derived profile is not persisted** — it is recomputed on demand from
signals (like `WardrobeHealth` / `UsageAnalytics`). Two categories of **additive**
tables are proposed, because some learning signals and all overrides are not yet
stored. Prefer additive changes; anon RLS consistent with the app's `mvp_anon_*`
policy (this app uses the Supabase anon key, no auth).

**Existing signal sources (no change):** `wear_logs`, `outfits` (+ `favorite`),
`purchases`, `wardrobe_items` (+ `favorite`).

**(a) User overrides** — explicit, must persist and win over derivation:

```sql
-- Additive. One row per user-set preference override.
create table if not exists preference_overrides (
  id            uuid primary key default gen_random_uuid(),
  dimension     text not null,           -- 'color' | 'formality' | 'brand' | 'silhouette'
                                          -- | 'footwear' | 'occasion' | 'season' | 'care' | 'commute'
  value         text not null,           -- the preference value the override targets
  mode          text not null,           -- 'pin' | 'adjust' | 'suppress'
  weight        real,                    -- for 'adjust' (nudge); null otherwise
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Item-level flags (protected / avoided). Additive columns on the existing table.
alter table wardrobe_items
  add column if not exists protected boolean not null default false,
  add column if not exists avoided   boolean not null default false;
```

**(b) Behavioural signal capture** — signals the app produces but does not yet
store. A single generic event table keeps it additive and future-proof:

```sql
-- Additive. Append-only behavioural events the engine aggregates.
create table if not exists preference_signals (
  id           uuid primary key default gen_random_uuid(),
  signal_type  text not null,     -- 'recommendation_accepted' | 'recommendation_rejected'
                                    -- | 'manual_edit' | 'acquisition_decision'
  subject_type text,              -- 'item' | 'outfit' | 'prospective_item'
  subject_id   uuid,              -- nullable FK-by-convention (no hard FK to keep additive)
  payload      jsonb,             -- small, typed detail (e.g. edited field, buy/skip verdict)
  occurred_at  timestamptz not null default now()
);
```

**RLS:** each new table gets the four anon policies the feature needs
(SELECT always; INSERT/UPDATE for overrides + signal writes; DELETE for
overrides). Additive columns on `wardrobe_items` inherit its existing policies.
The exact SQL/RLS is finalised at implementation and called out in that PR — this
RFC only **documents** the impact (no migration is applied here).

**Note:** wears/purchases/favourites already give a strong first profile with
**zero** new tables; the signal-capture table only *adds* the accept/reject,
edit, and acquisition signals. A phased build can ship derivation from existing
data first, then layer in captured signals.

## 9. API / Domain Contracts

Illustrative (final names/shapes settled at implementation). Confidence is 0–1;
weights are tunable engine constants.

```ts
// src/domain/personalization/types.ts  (design)

export type PreferenceDimension =
  | "color" | "formality" | "brand" | "silhouette" | "footwear"
  | "occasion" | "season" | "care" | "commute";

export type PreferenceSignalType =
  | "wear"                      // from wear_logs
  | "outfit_saved"             // from outfits
  | "favorite"                 // from wardrobe_items/outfits.favorite
  | "purchase"                 // from purchases
  | "recommendation_accepted"  // captured feedback
  | "recommendation_rejected"  // captured feedback (negative signal)
  | "manual_edit"              // captured edit event
  | "acquisition_decision";    // acted-on Buy vs Skip verdict

/** One normalized, timestamped behavioural event. */
export interface PreferenceSignal {
  type: PreferenceSignalType;
  /** Which preference dimension(s) this event informs, with the observed value. */
  facets: { dimension: PreferenceDimension; value: string }[];
  /** +1 positive (wear/favourite/accept), -1 negative (reject). */
  polarity: 1 | -1;
  occurredAt: string;          // ISO; drives recency decay
  subjectId?: string | null;
}

export type OverrideMode = "pin" | "adjust" | "suppress";

export interface PreferenceOverride {
  dimension: PreferenceDimension;
  value: string;
  mode: OverrideMode;
  weight?: number | null;      // for "adjust"
}

/**
 * RESERVED — FUTURE (visualization only; see "Preference Lifecycle", §9). The
 * lifecycle state a preference eventually belongs to. Declared now so the shape
 * is forward-compatible; NOT computed by `derivePreferenceProfile` in this RFC.
 */
export type PreferenceLifecycle =
  | "core"       // strong, stable, sustained — a defining preference
  | "emerging"   // rising recently; not yet consistent enough to be core
  | "declining"  // previously strong, now fading (recent signals dropping off)
  | "avoided";   // net-negative — the user steers away from this value

/** A single derived (or overridden) preference with evidence. */
export interface DerivedPreference {
  dimension: PreferenceDimension;
  value: string;               // e.g. "navy", "smart_casual", "sneakers"
  /** Normalized strength within its dimension (0–1). */
  weight: number;
  /** How certain the engine is about this preference TODAY (0–1). "How sure are we?" */
  confidence: number;          // from evidence volume + consistency, now
  /**
   * How consistently this preference has REMAINED over time (0–1) — a concept
   * distinct from confidence. Confidence answers "how sure are we?"; stability
   * answers "how consistent has this preference remained over time?" High
   * stability = present and steady across the history window; low stability =
   * recent, spiky, or fading.
   */
  stability: number;
  source: "derived" | "override" | "prior";
  /**
   * RESERVED — FUTURE (not populated in this RFC). Lifecycle classification for
   * visualization; see "Preference Lifecycle" (§9).
   */
  lifecycle?: PreferenceLifecycle;
  /**
   * RESERVED — FUTURE (not populated in this RFC). ISO month/date when this
   * preference became dominant — e.g. preferred colour "navy" since "2026-05".
   * See "Reserved metadata: since" (§9).
   */
  since?: string | null;
  /** Auditable "because": contributing signals and their contribution. */
  reason: string;
  evidence: { type: PreferenceSignalType; count: number; contribution: number }[];
}

/** THE standardized output. Feeds RecommendationContext.preferences. */
export interface UserPreferenceProfile {
  preferredColors: DerivedPreference[];
  preferredFormality: DerivedPreference[];
  preferredBrands: DerivedPreference[];
  preferredSilhouettes: DerivedPreference[];
  preferredFootwear: DerivedPreference[];
  preferredOccasions: DerivedPreference[];
  seasonalPreferences: DerivedPreference[];
  carePreference: DerivedPreference[];   // care/maintenance tolerance
  commutePreference: DerivedPreference[];
  /** Items the user protects (never suggest removing/flagging unused). */
  protectedItemIds: string[];
  /** Items the user avoids (stop recommending / stop suggesting buying more). */
  avoidedItemIds: string[];
  /** Overall profile confidence (evidence-weighted mean). */
  confidence: number;
  /** True when evidence is thin and the prior dominates. */
  coldStart: boolean;
  metadata: {
    engineVersion: string;
    generatedAt: string;
    signalCount: number;
    overrideCount: number;
  };
}

export interface PersonalizationInput {
  signals: PreferenceSignal[];
  overrides: PreferenceOverride[];
  /** Cold-start prior (today's DEFAULT_PREFERENCES), used when evidence is thin. */
  prior?: Partial<UserPreferenceProfile>;
}

export function derivePreferenceProfile(
  input: PersonalizationInput,
  options?: { generatedAt?: string },
): UserPreferenceProfile;
```

### Future concepts — DOCUMENTATION ONLY (declared, not built in this RFC)

These concepts are declared so the contract is forward-compatible and the
boundaries are agreed now. **None is produced by `derivePreferenceProfile` in
this RFC** — this RFC ships a single point-in-time profile. Consistent with the
philosophy, each would be *re-derived from behaviour*, never journaled or
mutated.

**Preference Timeline (future).** Every preference should *eventually* be
visualizable across time — not just its value today, but how it moved. Examples:

- **Preferred Colours over time** (e.g. navy rising, grey fading).
- **Preferred Formality over time** (e.g. drift from formal toward smart-casual).
- **Preferred Footwear over time** (e.g. sneakers overtaking loafers).

This is **future functionality only**; no implementation here. It would be
produced by re-running the derivation over successive historical windows:

```ts
/** RESERVED — FUTURE. Time series of a preference, for visualization. */
export interface PreferenceTimeline {
  dimension: PreferenceDimension;
  value: string;
  points: {
    at: string;                    // ISO — window end
    weight: number;                // 0–1 as of that window
    confidence: number;            // 0–1
    stability: number;             // 0–1
    lifecycle?: PreferenceLifecycle;
  }[];
}
```

**Preference Lifecycle (future).** Every preference eventually belongs to one
state — a classification for visualization, **not implemented** in this RFC:

| State | Meaning |
| --- | --- |
| **Core** | Strong, stable, sustained — a defining preference. |
| **Emerging** | Rising recently; not yet consistent enough to be core. |
| **Declining** | Previously strong, now fading. |
| **Avoided** | Net-negative — the user steers away from this value. |

(Type: `PreferenceLifecycle`, declared above; `DerivedPreference.lifecycle` is a
reserved field, unset in this RFC.)

**Reserved metadata: `since` (future).** When a preference became dominant, for
display — e.g.:

> Preferred Colour · **Navy** · Since **2026-05**

Reserved on `DerivedPreference.since`; **future only**, not derived here.

**Reserved domain object: `PreferenceEvolution` (future).** Tracks how
preferences changed over time, for audit/debug and explainability — each change
records **before / after / signal / reason / timestamp**. A future domain
object, not built here:

```ts
/** RESERVED — FUTURE. Audit/debug record of preference changes. */
export interface PreferenceEvolution {
  dimension: PreferenceDimension;
  value: string;
  changes: {
    before: number | null;         // prior weight (null if newly added)
    after: number | null;          // new weight (null if removed)
    signal: PreferenceSignalType;  // the signal that drove the change
    reason: string;                // human-readable "because"
    timestamp: string;             // ISO — when the change was observed
  }[];
}
```

### Derivation model (deterministic)

Per dimension, each contributing signal adds `signalWeightᵢ · recencyDecay(age)`
to the candidate value's running weight; values are then normalized within the
dimension to 0–1.

**Signal-type weights** (tunable constants — negative signals subtract):

| Signal | Meaning | Weight |
| --- | --- | --- |
| Wear (`wear_logs`) | Strongest revealed preference — what actually gets worn | 1.00 |
| Favourite | Explicit positive marker | 0.80 |
| Outfit saved | Curated combination the user built | 0.60 |
| Purchase | Money spent — intent, but not yet proven by wear | 0.50 |
| Recommendation accepted | Endorsed a suggestion | 0.40 |
| Acquisition decision (bought after "buy") | Acted-on verdict | 0.40 |
| Manual edit | Corrected a field toward a value | 0.20 |
| Recommendation rejected | Negative signal (subtracts) | −0.50 |

```
recencyDecay(age) = 0.5 ^ (ageDays / HALF_LIFE_DAYS)     // exponential, half-life tunable
rawWeight(value)  = Σ over signals for value: polarity · signalWeight · recencyDecay(age)
weight(value)     = normalize rawWeight within its dimension → [0,1]
confidence(value) = f(evidence volume, consistency)      // how sure ARE WE NOW
                    • volume: more corroborating signals → higher confidence
                    • consistency: agreement across signal types & over time → higher
stability(value)  = g(spread, persistence)               // how consistently it has HELD
                    • spread: signals present across the whole window (not clustered) → higher
                    • persistence: sustained across sub-periods, low volatility → higher
                    • independent of confidence: a value can be confident-but-new
                      (high confidence, low stability) or long-but-quiet
                      (moderate confidence, high stability)
coldStart         = total evidence below MIN_EVIDENCE → prior dominates, low confidence
```

`weight`, `confidence`, and `stability` are the fields this RFC derives per
preference. **Lifecycle and `since` are documented future concepts** (§9 "Future
concepts") — the same `weight`/`stability`/trend inputs would classify them, but
they are not computed in this RFC.

**Override rules** (applied last, deterministic): `pin` fixes the value at
`confidence = 1`, `stability = 1`, `source = "override"`; `adjust` multiplies the
derived weight by the override weight (confidence and stability recompute from
the adjusted evidence); `suppress` removes the derived preference. Overrides are
never overwritten by later derivation. Protected/avoided item flags pass through
to `protectedItemIds` / `avoidedItemIds`.

Weights, half-life, and `MIN_EVIDENCE` are engine constants, calibrated with
tests — the same tunable approach as the Health/Outfit/Buy-vs-Skip engines.

## 10. Acceptance Criteria

This RFC is **Approved-ready** when it defines all of the below (it does):

- [ ] A deterministic derivation model: signal types + weights, recency decay,
      per-dimension normalization, confidence **and** stability formulas (two
      distinct concepts), cold-start fallback, and override rules — no AI/ML in
      the derivation path.
- [ ] Domain contracts: `PreferenceSignal`, `PersonalizationInput`,
      `UserPreferenceProfile` (incl. `DerivedPreference` with confidence,
      stability, and derivation trace), `PreferenceOverride`, and the
      `derivePreferenceProfile` signature.
- [ ] The profile is **recalculated from the full history each run**, never
      incrementally mutated (documented in Philosophy).
- [ ] Documented future concepts declared but explicitly **out of build scope**:
      Preference Timeline (`PreferenceTimeline`), Preference Lifecycle
      (`PreferenceLifecycle` + reserved `DerivedPreference.lifecycle`), reserved
      `since` metadata, and `PreferenceEvolution` (audit/debug of changes).
- [ ] The mapping of `UserPreferenceProfile` onto
      `RecommendationContext.preferences`, superseding `DEFAULT_PREFERENCES`.
- [ ] The UX flow for the Taste Profile view (view → inspect → override →
      optional explain), including cold-start and conflict states.
- [ ] Schema impact documented as additive (overrides, protected/avoided flags,
      signal-capture events) with RLS implications — no migration applied here.
- [ ] Clear non-goals (chat memory, LLM memory, cross-device sync, cloud profile,
      ML training, AI deciding preferences).
- [ ] A testing plan, risks, and future extensions.

Implementation-time acceptance criteria (tracked in that PR — not this RFC):
- [ ] `derivePreferenceProfile` is pure and deterministic (same signals +
      overrides + `generatedAt` ⇒ identical profile), recalculated from history
      with no dependence on any prior profile.
- [ ] Every preference carries a **confidence**, a distinct **stability**, and
      an **explainable derivation reason** citing the contributing signals.
- [ ] Confidence and stability are distinct and move independently — a
      new-but-strong preference is high-confidence/low-stability; a long-held
      quiet one is lower-confidence/high-stability.
- [ ] **User overrides win** over derivation and are never overwritten by later
      learning; `suppress`/`pin`/`adjust` behave per §9.
- [ ] Recent behaviour outweighs old behaviour (recency decay observable).
- [ ] Negative signals (rejected recommendations) reduce the relevant preference.
- [ ] Cold start yields a low-confidence, prior-backed profile clearly labelled.
- [ ] Protected items are never proposed for removal; avoided items are never
      recommended or suggested for purchase.
- [ ] Removing AI leaves the derived profile unchanged (AI explains only).

## 11. QA / Testing Plan

- **Unit tests (Vitest, pure engine)** — the core of QA:
  - Signal-weight aggregation (fixed signals → expected per-dimension weights).
  - Recency decay: identical signals at different ages → older contributes less;
    half-life boundary behaviour.
  - Confidence: volume (few vs many signals) and consistency (agreeing vs
    conflicting signals) move confidence as specified.
  - Stability vs confidence independence: a new-but-strong preference →
    high confidence / low stability; a long-held sparse one → high stability /
    moderate confidence.
    (Lifecycle, `since`, and timeline are future concepts — no tests here.)
  - Negative signals: rejected recommendations subtract; enough rejections flip a
    would-be preference below threshold.
  - Overrides: `pin` fixes value at confidence 1; `adjust` scales weight;
    `suppress` removes; override survives contradicting derivation.
  - Protected/avoided pass-through to id lists.
  - Cold start: below `MIN_EVIDENCE` → `coldStart: true`, prior dominates, low
    confidence.
  - Determinism: same input + `generatedAt` ⇒ identical `UserPreferenceProfile`.
- **Golden scenarios** — a fixture behavioural history (e.g. "wears navy knits +
  sneakers, rejects blazer recs, protects one sherwani") → a table of expected
  top preferences + flags, guarding calibration drift.
- **Contract/integration guard** — the derived profile maps onto
  `RecommendationContext.preferences` and is accepted by the recommendation and
  Buy-vs-Skip (`preferenceFit`) engines unchanged.
- **Signal normalizer** — raw fixture rows (wears/outfits/purchases/favourites/
  feedback/edits/verdicts) → correct `PreferenceSignal[]` (types, facets,
  polarity, timestamps).
- **Service/UI (at implementation)** — service returns `{ data, error }`;
  preview verification of the Taste Profile view, override actions, and
  cold-start labelling.
- **AI (when added)** — the explanation is schema-validated and never alters the
  profile; a fake-AI unit test asserts the derived profile is unchanged.
- **Release gate** — `npm test` green before any tag (ADR-008). No model calls in
  the automated suite.

## 12. Risks & Trade-offs

- **Feedback loop / self-reinforcement.** Recommending what the user already
  wears can narrow variety ("filter bubble"). *Mitigation:* the profile *informs*
  ranking, it does not hard-filter; the Health/gap engines still push variety;
  recency decay lets phases fade; a future "explore" knob (§13).
- **Calibration risk.** Signal weights, half-life, and `MIN_EVIDENCE` are
  heuristics. *Mitigation:* tunable constants + golden-scenario tests; the
  per-preference derivation trace makes mis-weights debuggable.
- **Sparse / cold-start data.** New or lightly-used wardrobes yield weak signals.
  *Mitigation:* explicit `coldStart` + prior fallback; low confidence surfaced,
  never presented as certain.
- **Confusing "learning without ML".** Users/devs may expect an ML model.
  *Trade-off:* we deliberately choose deterministic, explainable aggregation over
  a black-box model — inspectability and ADR-005 compliance beat marginal
  accuracy.
- **Override vs derivation conflict.** *Mitigation:* overrides always win, and
  the conflict is surfaced ("we noticed X, but you set Y") rather than hidden.
- **Signal capture gaps.** Some signals (accept/reject, edits, acquisition
  decisions) require new capture (§8). *Mitigation:* phased — derive from
  existing wears/purchases/favourites first; layer captured signals in later.
- **Privacy.** The profile is a concentrated model of the user. *Mitigation:*
  computed in-app from their own data, server-side, not persisted, no external
  service (reinforced by the non-goals).

## 13. Future Extensions

- **Explore/exploit knob** — a user-tunable variety dial that deliberately
  down-weights the profile to surface under-worn items.
- **Preference trends over time** — expose how taste shifted across seasons
  (built on the same decayed signals), realised via the reserved
  **`PreferenceTimeline`** shape (§9): re-derive the profile over successive
  historical windows to chart a preference's weight/lifecycle over time.
- **Preference evolution audit/debug** — the reserved **`PreferenceEvolution`**
  shape (§9): a structured diff of why the profile changed between two
  derivations (added/removed/strengthened/weakened, lifecycle transitions), for
  explainability tooling and calibration-regression debugging.
- **Packing/Travel Engine (v0.9+)** — trip capsules seeded by occasion/seasonal
  preferences from the profile.
- **Stylist chat tool** — `getPreferenceProfile` so chat can reason about taste
  (via the tool-calling layer).
- **Per-occasion sub-profiles** — distinct preferences for office vs weekend vs
  travel, once occasion signal volume supports it.
- **Wishlist re-scoring (RFC-004 Wishlist adjacency)** — re-run Buy vs Skip's
  `preferenceFit` against the live profile as taste evolves.
- **Vision-sourced silhouette signals** — richer silhouette detection from the
  Vision Engine feeding the `silhouette` dimension.

## 14. Open Questions

1. **Surface & route** — dedicated `/settings/preferences` (Settings) or a Taste
   Profile card under **Insights**? Both, with the card linking to the full view?
2. **Signal weights & half-life** — are the proposed weights and decay half-life
   right for one active wardrobe, and should any be user-adjustable settings?
3. **`MIN_EVIDENCE` threshold** — how much history before we leave cold start and
   trust derivation over the prior?
4. **Silhouette taxonomy** — what is the canonical `silhouette` vocabulary
   (slim/relaxed/oversized/tailored…), and is it derivable from existing item
   fields or does it need Vision (§13)?
5. **Care tolerance** — how is "care tolerance" inferred (avoids dry-clean-only,
   prefers machine-wash) — from material fields, wear frequency of high-care
   items, or an explicit signal?
6. **Override granularity** — per-value pins only, or also per-dimension locks
   ("always trust my formality setting")?
7. **Recommendation-context integration** — fully replace `DEFAULT_PREFERENCES`
   with the derived profile, or blend (prior + derived) with a confidence-weighted
   mix during the transition?
8. **Profile caching** — cache the derived profile by signal-fingerprint from day
   one (ADR-006), or compute per request until it proves a bottleneck?
9. **Lifecycle thresholds** — what exact `weight`/`stability`/recent-trend
   cut-offs separate `core` / `emerging` / `declining`, and are they tunable
   constants or user-visible settings?
10. **`since` semantics** — "earliest sustained evidence" needs a precise
    definition (minimum run length / gap tolerance) so the date is stable across
    runs; what are those parameters?
11. **Timeline windowing (future)** — when `PreferenceTimeline` is built, what
    window size/step (monthly? per-season?) best shows evolution without
    re-deriving over too many windows?
