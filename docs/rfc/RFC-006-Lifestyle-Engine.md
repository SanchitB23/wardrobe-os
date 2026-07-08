# RFC-006: Lifestyle Engine

Status: Implemented
Owner: Sanchit Bhatnagar
Author: ChatGPT
Target Release: v1.0.0
Epic: Lifestyle
Priority: High
Effort: XL
Dependencies:
- Intelligence Orchestrator (`src/domain/orchestrator`, RFC-005) — Lifestyle capabilities register here; travel/packing/weather/calendar/shopping are the reserved ids it fills
- OutfitGenerationEngine `generateOutfits` + UnifiedOutfitRecommendationEngine `recommendUnifiedOutfits` (`src/domain/recommendation`) — per-day outfit selection
- RecommendationContext + `buildRecommendationContext` (`src/domain/recommendation`) — the per-day context each selection scores against (esp. `weather`, `commute`)
- PersonalizationEngine `derivePreferenceProfile` → `UserPreferenceProfile` (`src/domain/personalization`, RFC-004) — trip preferences
- BuyVsSkipEngine `evaluateBuyVsSkip` (`src/domain/acquisition`, RFC-001) — evaluating missing-item shopping suggestions
- WardrobeHealthEngine `analyzeWardrobeHealth` (`src/domain/analytics`) — gap detection for missing items
- A new **WeatherProvider** (vendor-neutral, mirrors `VisionProvider`/`AIProvider`, ADR-004) — external forecast fetch is I/O in a service; the engine consumes a normalized `WeatherForecast`
- AI explanation layer (`src/ai`) — narrates a `LifestylePlan`, never computes it (ADR-005)
- ADR-005 (AI does not decide), ADR-006 (caching), ADR-008 (release/versioning)

---

## Lifestyle Philosophy

The same discipline as every prior RFC, applied across **time** instead of a
single moment:

- **Engines decide; the Lifestyle Engine composes them over a horizon.** Outfit
  scoring, ranking, gaps, and buy/skip already live in pure engines. Lifestyle
  adds no new taste — it runs those engines once *per trip-day* and assembles the
  results into a plan.
- **Weather is data, not a decision.** A forecast is an *input* (fetched by a
  provider, like Vision's image), normalized to a deterministic `WeatherForecast`.
  The engine reads it; it never predicts weather itself.
- **Everything is deterministic.** Given the same trip + wardrobe + forecast +
  preferences (+ injected `generatedAt`), the plan is identical and reproducible.
- **AI only explains.** It narrates a finished `LifestylePlan` ("3 tops cover 5
  days with one laundry cycle") — it never selects outfits, packs, or decides
  what to buy.

So: **Trip → gather context (weather, wardrobe, preferences) → run existing
engines per day → assemble `LifestylePlan`.** Travel is not a new brain; it is a
*horizon-scoped consumer* of the engines, delivered as
[RFC-005](RFC-005-Intelligence-Orchestrator.md) capabilities.

## 1. Problem Statement

Wardrobe OS optimizes **individual outfits** — "what should I wear today?" — but
never **wardrobe usage across time**. The highest-effort clothing moments are not
single days; they are *spans*: a 5-day work trip, a week's vacation, a wedding
weekend, a multi-city business tour. Preparing for these today means manually:

- guessing the destination's weather per day,
- picking an outfit for each day and occasion (office, dinner, ceremony, travel),
- making those outfits *share* items so the bag stays small,
- deciding what to pack within a carry-on,
- planning laundry if the trip outlasts the clean clothes,
- noticing what's *missing* and whether to buy it before leaving.

Every one of these is a composition of engines Wardrobe OS already has
(recommendation, generation, health/gaps, personalization, buy-vs-skip) — but
nothing runs them *across a trip*. The user re-derives the whole plan by hand,
every trip.

We need **one deterministic Lifestyle Engine** that turns a trip into a complete,
explainable plan — packing list, per-day outfits, laundry schedule, missing
items, and shopping suggestions — by composing the existing engines over time.

## 2. Goals

- Provide **one** deterministic `LifestyleEngine` that turns a `LifestyleRequest`
  (a trip) into one `LifestylePlan`. Same inputs (+ `generatedAt`) ⇒ same plan.
- Model travel as a set of **capabilities** — Trip Planning, Packing, Weather
  Planning, Capsule Wardrobe, Laundry Planning, Event Planning — registered in
  the Intelligence Orchestrator (RFC-005) under its reserved `travel` / `packing`
  / `weather` ids. "Travel becomes one capability."
- **Compose, don't reinvent**: per-day outfits come from
  `recommendUnifiedOutfits` / `generateOutfits`; missing items from health gaps;
  shopping suggestions from `evaluateBuyVsSkip`; trip preferences from the
  `UserPreferenceProfile`. Lifestyle adds only the *time* dimension.
- Treat **weather as a normalized input** behind a vendor-neutral
  `WeatherProvider` (server-side fetch; deterministic normalization), with manual
  entry as a fallback.
- Produce a rich, inspectable `LifestylePlan` composed of four focused sub-plans
  — **`TripPlan`** (daily outfits + capsule), **`PackingPlan`** (packing list +
  `packingConfidence`), **`LaundryPlan`** (schedule), and **`ShoppingPlan`**
  (missing items + buy/skip suggestions) — returned together, plus a 0–100
  **`planScore`**, human-readable **`tradeoffs`**, and **`warnings`**.
- Keep the principle intact: **the engine plans deterministically; AI only
  explains** the plan (ADR-005).
- Be fully unit-testable (pure engine; weather + wardrobe injected as fixtures).

## 3. Non-Goals

Explicitly **out of scope** for RFC-006:

- **Flight booking / hotel booking** — no reservations, no travel commerce.
- **Calendar sync** — the engine accepts events as input; it does not read or
  write any calendar (Calendar integration is a future consumer, §13).
- **Expense management** — no budgets, receipts, or trip accounting.
- **Notifications / reminders** — no push, no scheduling (also permanently out of
  product scope; see ROADMAP).
- **AI decisions** — AI never selects outfits, packs, schedules laundry, or picks
  what to buy. It explains the finished plan only.
- **Live weather *prediction*** — the engine consumes a forecast; it does not
  model weather. (A provider fetches real forecasts; that fetch is I/O in a
  service, not in the engine.)
- **New taste / scoring** — Lifestyle composes existing engines; it introduces no
  new outfit or purchase scoring.

## 4. User Stories

- As the owner, I enter a 5-day Bangalore work trip and get a packing list, a
  per-day outfit for each day's occasions, and a note that 3 tops + 2 bottoms
  cover it with one laundry wash — so I pack a carry-on in minutes.
- As the owner planning a wedding weekend, I get the ceremony/reception outfits
  planned, plus a warning that I lack formal footwear and a buy/skip suggestion
  for it *before* I travel.
- As the owner, I set "carry-on only" and the plan trims to a **capsule** — the
  smallest item set that still covers every day and occasion.
- As the owner heading somewhere cold/rainy, I want each day's outfit to respect
  that day's **forecast**, and a warning if I have nothing suitable.
- As the owner, I want an optional plain-language **explanation** of the plan, but
  the plan itself must be the deterministic source of truth.

## 5. UX Flow

Future surface under a **Lifestyle / Travel** nav entry: route **`/lifestyle/trip`**
(settled at implementation).

1. **Trip form** — destination, dates (→ duration), events (occasion + date),
   travel style, laundry availability, luggage constraint.
2. **Plan** — the service fetches the forecast (WeatherProvider), assembles
   per-day context, and runs the Lifestyle Engine (via the Orchestrator).
3. **Result** — a trip plan view, headed by the **`planScore`** (0–100) and any
   **trade-offs** ("Carry-on → reduced outfit variety"), then the four sub-plans:
   - **`TripPlan`** — per-day itinerary (each day's occasion(s), forecast, chosen
     outfit, reusing the recommendation result card) + capsule summary "N → M days";
   - **`PackingPlan`** — the deduplicated item set grouped by slot within the
     luggage constraint, with `packingConfidence`;
   - **`LaundryPlan`** — wash points, if any;
   - **`ShoppingPlan`** — missing items + buy/skip suggestions;
   - **Warnings** — uncovered occasions/weather.
4. **Explain (optional)** — narrate the plan via the AI layer (post-engine).

States: input, computing (forecast + planning), result, low-coverage warning
banner, and a no-forecast fallback (manual weather entry).

## 6. Architecture

The Lifestyle Engine is a **pure domain engine** (`src/domain/lifestyle`,
proposed) that composes existing engines across a trip horizon, surfaced as
Orchestrator capabilities.

```
LifestyleRequest
        ↓
Weather Provider        (server-side forecast fetch → normalized WeatherForecast; provider-agnostic)
        ↓
Recommendation          (per-day outfit selection: recommendUnifiedOutfits / generateOutfits)
        ↓
Wardrobe                (the item pool the plan draws from)
        ↓
Personalization         (trip preferences bias selection — RFC-004)
        ↓
Acquisition             (missing items → Buy vs Skip suggestions — RFC-001)
        ↓
Lifestyle Engine        (PURE: assemble per-day results into one plan across time)
        ↓
LifestylePlan
```

### Domain Layer
- **`LifestyleEngine`** (`src/domain/lifestyle`, pure): `planLifestyle(input:
  LifestyleInput, options?) → LifestylePlan`. Deterministic — no I/O, no model,
  `generatedAt` injected. It expands the trip into a per-day schedule
  (occasion + forecast per day), selects each day's outfit by requesting the
  **`recommendation` capability through the Intelligence Orchestrator**
  (RFC-005) against a per-day `RecommendationContext` slice, then derives the
  capsule, packing, laundry, missing items, trade-offs, and warnings from those
  selections. It returns one `LifestylePlan` composed of four sub-plans
  (`TripPlan`, `PackingPlan`, `LaundryPlan`, `ShoppingPlan`) plus `planScore`,
  `tradeoffs`, and `warnings`.
- **Recommendation runs through the Orchestrator, not directly.** Even though the
  orchestrator currently delegates the `recommendation` capability straight to
  `recommendUnifiedOutfits`, Lifestyle must invoke it *via* the Orchestrator so
  that execution ordering, dependency resolution, and reporting stay owned in one
  place (RFC-005). This keeps engines from calling each other and lets future
  capabilities (weather, personalization) slot into the same per-day graph
  without Lifestyle changing. It is an architectural rule, not an optimisation.
- **Sub-planners** (pure helpers): `planCapsule` (minimal set-cover over daily
  outfits, deterministic greedy), `planPacking` (union + luggage-trim by
  versatility/cost-per-wear), `planLaundry` (re-wear vs wash given clean-days +
  availability), `detectMissing` (uncovered occasion/weather → gaps).
- **Types** — `src/domain/lifestyle/types.ts`: `Trip`, `TripDay`, `TripEvent`,
  `TravelStyle`, `LuggageConstraint`, `WeatherForecast`, `LifestyleInput`,
  `LifestylePlan`, `PackingList`, `DailyOutfit`, `LaundrySchedule`, `MissingItem`.

### Service Layer
_(Design only.)_ A service assembles `LifestyleInput`: fetch the forecast via the
WeatherProvider, build the wardrobe/personalization context (reuse the
recommendation-context data path), and run the engine — returning
`{ data, error }`. Weather fetch is the only new I/O; everything else reuses
existing repositories/services.

### Repository Layer
None required for the engine. No new persistence in RFC-006 (plans computed on
demand). Optional additive `trips` table is a documented future (§8), not built.

### Orchestrator Layer (RFC-005)
Lifestyle registers capabilities in the Intelligence Orchestrator, filling its
reserved ids:
- `weather` — normalize/attach the forecast (leaf; depends on the provider output
  in context).
- `travel` — the full trip plan (depends on `weather`, `recommendation`,
  `personalization`).
- `packing`, `capsule`, `laundry` — sub-plans (depend on `travel`).
- Missing-item shopping reuses the existing `acquisition` capability.

So a trip plan is one Orchestrator execution graph; the Orchestrator owns order,
Lifestyle owns the per-day composition.

### AI Layer
- **Optional** explanation only (ADR-004/005/006): a `lifestyle-plan-explanation`
  prompt builder + schema + parser + cache, fed the already-computed
  `LifestylePlan`. **AI never selects, packs, schedules, or decides.** Weather is
  a data provider, not AI.

## 7. Data Flow

```
service.planTrip(request)                                        { data, error }
  → WeatherProvider.forecast(destination, dates)                  (server-side I/O) → WeatherForecast
  → assemble wardrobe + UserPreferenceProfile (existing data path)
  → LifestyleEngine.planLifestyle({ trip, forecast, wardrobe, preferences }, { generatedAt })  ← PURE
      • expand trip → TripDay[] (occasion(s) + day forecast)
      • per day: build a RecommendationContext slice (weather/occasion) →
        request the `recommendation` capability VIA the Orchestrator (not the
        engine directly) → pick top, avoiding within-laundry-cycle repeats
      • planCapsule(dailyOutfits)           → TripPlan (dailyOutfits + capsule)
      • planPacking(capsule, luggage)       → PackingPlan (list + packingConfidence)
      • planLaundry(duration, availability) → LaundryPlan
      • detectMissing + evaluateBuyVsSkip   → ShoppingPlan (missing + suggestions)
      • derive tradeoffs, warnings, planScore
      → LifestylePlan { tripPlan, packingPlan, laundryPlan, shoppingPlan,
                        tradeoffs, warnings, planScore, confidence }
  → [optional] Explain → AI narrates the plan (no recompute)
```

The engine step is deterministic and side-effect-free; only the WeatherProvider
does I/O (in the service), exactly as the Vision provider does for images.

## 8. Data Model / Schema Impact

**No database schema changes in RFC-006.** The engine is compute-only; the
`LifestylePlan` is returned to the caller, not persisted.

Future (separate RFC, noted for planning only): an optional additive `trips`
table (destination, dates, events, saved `LifestylePlan`) so trips can be saved
and re-planned when the wardrobe/forecast changes — additive, anon-RLS consistent
with the app (mirrors the RFC-004 overrides table). Documented then, not now.

## 9. API / Domain Contracts

Illustrative (final names settled at implementation). Confidence is 0–1.

```ts
// src/domain/lifestyle/types.ts  (design)

export type TravelStyle = "minimal" | "standard" | "overpacker";

/**
 * RESERVED — FUTURE (declared, not used in this RFC). A higher-level planning
 * strategy that would tune the whole plan — capsule minimality, packing
 * generosity, and formality bias. Not an input in v1.
 */
export type PlanningStrategy = "minimal" | "balanced" | "luxury" | "business";

export interface LuggageConstraint {
  kind: "carry_on" | "checked" | "unbounded";
  maxItems?: number | null;
}
export interface LaundryAvailability {
  available: boolean;
  /** Turnaround in days when available (e.g. hotel same-day = 1). */
  turnaroundDays?: number | null;
}

export interface TripEvent {
  /** ISO date within the trip. */
  date: string;
  occasion: string;        // e.g. "Wedding", "Office", "Dinner"
  formalityHint?: string | null;
}

export interface Trip {
  destination: string;
  startDate: string;       // ISO
  endDate: string;         // ISO → duration
  events: TripEvent[];
  travelStyle: TravelStyle;
  laundry: LaundryAvailability;
  luggage: LuggageConstraint;
}

/**
 * Where the forecast came from. `forecast` (a live provider) and `manual` (user
 * entry) are supported now; `historical` (climate normals for the destination /
 * dates) is RESERVED — FUTURE.
 */
export type WeatherSource = "forecast" | "manual" | "historical";

/** Normalized forecast the engine consumes (fetched by a provider). */
export interface WeatherForecast {
  days: {
    date: string;
    season: string;        // reuses the recommendation SeasonLabel space
    condition: string;     // hot | warm | mild | cool | cold | rainy
    highC: number | null;
    lowC: number | null;
    rainRisk: number | null; // 0–1
  }[];
  source: WeatherSource;
}

export interface LifestyleInput {
  trip: Trip;
  forecast: WeatherForecast;
  wardrobe: StyleDNAItem[];
  preferences?: UserPreferenceProfile | null;
  health?: WardrobeHealth | null;
}

export interface DailyOutfit {
  date: string;
  occasion: string;
  weather: { condition: string; season: string };
  itemIds: string[];
  score: number;           // from the recommendation engine
  reason: string;
}

export interface PackingList {
  itemIds: string[];
  bySlot: Record<string, string[]>;
  count: number;
  withinLuggage: boolean;
}

export interface LaundrySchedule {
  needed: boolean;
  /** ISO dates on which a wash is required to keep clean clothes. */
  washOn: string[];
  reWears: { itemId: string; dates: string[] }[];
}

export interface MissingItem {
  need: string;            // e.g. "formal footwear", "rain jacket"
  forDates: string[];
  reason: string;
}

// The plan is composed of four focused sub-plans, returned together as one
// LifestylePlan. Each sub-plan is independently inspectable and testable.

/** What to wear across the trip. */
export interface TripPlan {
  dailyOutfits: DailyOutfit[];
  /** Capsule summary: itemCount covering dayCount. */
  capsule: { itemCount: number; dayCount: number };
}

/** What to put in the bag. */
export interface PackingPlan {
  packingList: PackingList;
  /**
   * 0–1: how well the packed set covers the trip's days/occasions/weather —
   * SEPARATE from `planScore`. Low when coverage is thin or luggage forced a trim.
   */
  packingConfidence: number;
}

/** How to keep clothes wearable across the trip. */
export interface LaundryPlan {
  schedule: LaundrySchedule;
}

/** What's missing and whether to buy it. */
export interface ShoppingPlan {
  missingItems: MissingItem[];
  /** Buy vs Skip verdicts for missing items (from the Acquisition engine). */
  shoppingSuggestions: { need: string; analysis: BuyVsSkipAnalysis }[];
}

export interface LifestylePlan {
  tripPlan: TripPlan;
  packingPlan: PackingPlan;
  laundryPlan: LaundryPlan;
  shoppingPlan: ShoppingPlan;
  warnings: string[];
  /**
   * Cross-cutting trade-offs the plan made, e.g.
   * "Carry-on → reduced outfit variety." Human-readable, decision-free.
   */
  tradeoffs: string[];
  /** 0–100: overall quality of the generated plan (coverage × variety × fit − warnings). */
  planScore: number;
  /** 0–1: overall confidence in the inputs/data (distinct from planScore). */
  confidence: number;
  metadata: {
    engineVersion: string;
    generatedAt: string;
    destination: string;
    days: number;
  };
}

export function planLifestyle(
  input: LifestyleInput,
  options?: { generatedAt?: string },
): LifestylePlan;

/** Vendor-neutral forecast provider (server-side; mirrors VisionProvider). */
export interface WeatherProvider {
  readonly id: string;
  forecast(destination: string, startDate: string, endDate: string): Promise<WeatherForecast>;
}
```

### Planning model (deterministic)

| Sub-plan | Deterministic rule |
| --- | --- |
| **Trip planning** | Expand `[startDate, endDate]` into `TripDay[]`; attach each day's events (occasion) and forecast. Days with no event get a default occasion from travel style + destination. |
| **Weather planning** | Map each day's `WeatherForecast` → the recommendation `weather` snapshot (season + condition) so per-day selection is weather-aware. |
| **Daily outfits** (`TripPlan`) | For each day, build a `RecommendationContext` slice with that day's weather/occasion and request the **`recommendation` capability through the Intelligence Orchestrator** (RFC-005) — not by calling `recommendUnifiedOutfits` directly (see §6). Pick the top candidate, penalising items worn within the current laundry cycle (drives re-use/variety). |
| **Capsule wardrobe** (`TripPlan`) | Greedy set-cover: repeatedly pick the item covering the most remaining day-slots, deterministic tie-break by cost-per-wear then id, until all daily outfits are satisfiable. |
| **Packing** (`PackingPlan`) | Union of capsule items + essentials; if `> luggage.maxItems`, trim least-versatile (fewest days covered) first, deterministic. `withinLuggage` reports the result; `packingConfidence` reflects coverage after any trim. |
| **Laundry** (`LaundryPlan`) | Clean-days = wearable items ÷ items-per-day. If `duration > cleanDays` and laundry `available`, schedule wash points (respecting `turnaroundDays`) and add re-wears; else surface a packing/warning. |
| **Missing items** (`ShoppingPlan`) | Occasions/weather in the trip not coverable by the wardrobe → `MissingItem`; each is run through `evaluateBuyVsSkip` for a shopping suggestion. |
| **Trade-offs** | Record human-readable trade-offs the plan made — e.g. a `carry_on` luggage cap that forced a capsule trim → "Carry-on → reduced outfit variety." Decision-free strings. |
| **Plan score** | `planScore` (0–100): a deterministic blend of coverage (days/occasions/weather satisfied), outfit variety, preference fit, and a penalty per warning. `packingConfidence` (0–1) and overall `confidence` (0–1) are computed separately (see §9). |
| **Warnings** | Uncovered occasion, uncovered weather (e.g. rain with no waterproof), luggage over capacity with no laundry, formal event with no formalwear. |

All thresholds (items-per-day, capsule tie-breaks, luggage trim order) are
tunable engine constants, calibrated with tests — the same approach as the
Health/Buy-vs-Skip engines.

## 10. Acceptance Criteria

This RFC is **Approved-ready** when it defines all of the below (it does):

- [ ] A deterministic planning model: trip expansion, weather mapping, per-day
      outfit selection (reusing the recommendation engine), capsule set-cover,
      packing trim, laundry scheduling, missing-item detection, warnings.
- [ ] Domain contracts: `Trip`, `WeatherForecast` (+ `WeatherSource`),
      `LifestyleInput`, and a `LifestylePlan` composed of `TripPlan` /
      `PackingPlan` (with `packingConfidence`) / `LaundryPlan` / `ShoppingPlan`,
      plus `planScore`, `tradeoffs`, `warnings`, `confidence`; `planLifestyle`,
      and the vendor-neutral `WeatherProvider`.
- [ ] The capability mapping onto the Intelligence Orchestrator (RFC-005):
      `weather` / `travel` / `packing` (+ capsule/laundry), reusing `acquisition`;
      recommendation is invoked **through** the Orchestrator, never directly.
- [ ] Reserved future items declared but out of build scope: `PlanningStrategy`
      (minimal / balanced / luxury / business) and `WeatherSource: "historical"`.
- [ ] The UX flow (`/lifestyle/trip`: trip form → plan → result → explain).
- [ ] Weather as a normalized input behind a provider; no AI decisions anywhere.
- [ ] Explicit non-goals (booking, calendar sync, expenses, notifications, AI
      decisions, weather prediction).
- [ ] Schema impact (none now; optional additive `trips` table documented).
- [ ] A testing plan, risks, and future extensions.

Implementation-time acceptance criteria (tracked in that PR — not this RFC):
- [ ] `planLifestyle` is pure and deterministic (same input + `generatedAt` ⇒
      identical plan).
- [ ] **Packing optimization**: the capsule is a minimal covering set; packing
      respects the luggage constraint (trims deterministically when over).
- [ ] **Capsule generation**: N items demonstrably cover M days/occasions.
- [ ] **Missing item detection**: an uncovered occasion/weather surfaces a
      `MissingItem` + a Buy vs Skip suggestion.
- [ ] **Weather-aware outfits**: each day's outfit respects that day's forecast; a
      cold/rainy day with no suitable item raises a warning.
- [ ] Laundry scheduling reduces packing when a trip outlasts clean clothes.
- [ ] The plan carries a 0–100 `planScore`, a distinct 0–1 `packingConfidence`,
      and human-readable `tradeoffs` (e.g. carry-on → reduced variety).
- [ ] Per-day recommendation runs **through the Orchestrator** (`recommendation`
      capability), not by calling the engine directly.
- [ ] Removing AI leaves the plan unchanged (AI explains only).

## 11. QA / Testing Plan

- **Unit tests (Vitest, pure engine) — the core:**
  - Trip expansion: dates + events → correct `TripDay[]` (occasion + forecast per day).
  - Weather-aware selection: same wardrobe, hot vs cold forecast → different daily
    outfits; rain day with no waterproof → warning.
  - Capsule set-cover: a fixture wardrobe + 5-day trip → the expected minimal item
    set; deterministic tie-break.
  - Packing + luggage: carry-on cap exceeded → deterministic trim; `withinLuggage`
    correct.
  - Laundry: trip longer than clean-days + laundry available → wash scheduled +
    re-wears; unavailable → warning.
  - Missing items: uncovered formal event → `MissingItem` + a Buy vs Skip
    suggestion (the Acquisition engine is invoked, not re-implemented).
  - Determinism: same input + `generatedAt` ⇒ identical `LifestylePlan`.
  - Sub-plan composition: the plan exposes `TripPlan` / `PackingPlan` /
    `LaundryPlan` / `ShoppingPlan` and each is populated independently.
  - `planScore` (0–100) drops with warnings and rises with coverage/variety;
    `packingConfidence` moves independently of `planScore` (e.g. a forced
    carry-on trim lowers packingConfidence).
  - Trade-offs: a `carry_on` cap that forces a trim records a
    "reduced outfit variety" trade-off.
  - Orchestrator invocation: per-day selection goes through the `recommendation`
    capability (a fake orchestrator/registry proves the engine doesn't call
    `recommendUnifiedOutfits` directly).
- **Golden scenarios** — fixtures (5-day work trip, wedding weekend, cold rainy
  vacation) with expected packing counts, capsule sizes, and warnings, to guard
  calibration drift.
- **WeatherProvider** — a fake provider returns a canned `WeatherForecast`; the
  real provider is tested manually. No network in the automated suite.
- **Orchestrator integration** — a `travel` capability request produces a
  `LifestylePlan` through the RFC-005 executor (fixtures, no I/O).
- **AI (when added)** — the explanation is schema-validated and never alters the
  plan; a fake-AI test asserts the plan is unchanged.
- **Release gate:** `npm test` green before any tag (ADR-008).

## 12. Risks & Trade-offs

- **Weather dependency.** Forecasts are external, rate-limited, and sometimes
  wrong. *Mitigation:* vendor-neutral provider + manual entry fallback +
  `forecast.source`; the engine is deterministic given whatever forecast it's
  handed.
- **Combinatorial cost.** Per-day selection across a long trip can be expensive.
  *Mitigation:* bound candidates per day (top-K), like the generation engine;
  capsule set-cover is greedy, not exhaustive.
- **Capsule vs comfort.** The smallest covering set may feel repetitive.
  *Trade-off:* travel style tunes minimality; laundry-cycle penalties add variety;
  the user sees the trade in the plan.
- **Calibration.** Items-per-day, luggage trim order, laundry thresholds are
  heuristics. *Mitigation:* tunable constants + golden-scenario tests; the plan's
  warnings + reasons make mis-plans debuggable.
- **Scope creep toward booking / calendars / expenses.** *Mitigation:* hard
  non-goals; those are separate consumers/RFCs.
- **Over-trusting the plan.** *Mitigation:* always surface warnings, missing
  items, and per-day reasons — not just a packing list.

## 13. Future Extensions

- **Calendar integration** — import events from a calendar to auto-populate trip
  events (a consumer that feeds `Trip.events`; the engine is unchanged).
- **Google Maps / destination data** — richer destination context (climate norms,
  dress codes) feeding the forecast/occasion defaults.
- **Trip templates** — reusable trip shapes ("3-day work trip", "beach week") to
  seed a `LifestyleRequest`.
- **Business travel** — recurring-trip profiles, per-city wardrobes, loyalty to a
  packed capsule across trips.
- **Saved trips (`trips` table)** — persist and re-plan when wardrobe/forecast
  changes ("still packed right?").
- **Packing progress** — check off packed items (UI state, still no scheduling).
- **Planning strategies** — the reserved `PlanningStrategy` (minimal / balanced /
  luxury / business) as a top-level dial that tunes capsule minimality, packing
  generosity, and formality bias in one setting.
- **Historical weather** — the reserved `WeatherSource: "historical"` (climate
  normals for the destination/dates) as a fallback when no live forecast exists
  (e.g. a trip months out).

## 14. Open Questions

1. **Weather provider** — which forecast API first (Open-Meteo is key-free and a
   good default), and what's the manual-entry UX when it's unavailable?
2. **Capability granularity** — is `travel` one Orchestrator capability that emits
   the whole plan, or do `packing` / `capsule` / `laundry` run as separate
   dependent capabilities? (Leaning: one `travel` capability that internally
   composes the sub-planners, with `packing`/`capsule` as thin projections.)
3. **Occasion defaults** — for days with no event, how do we infer the day's
   occasion (travel style + destination + weekday)?
4. **Capsule objective** — minimise item *count*, *weight/volume*, or a blend?
   How does `travelStyle` weight it?
5. **Laundry model** — fixed clean-days heuristic, or per-item "wears before wash"
   from care data (RFC-004's reserved care dimension)?
6. **Multi-destination trips** — one trip with legs (different cities/weather), or
   separate trips chained? (v1: single destination; legs are future.)
7. **Persistence** — compute-only in v1, or introduce the `trips` table now so
   plans can be revisited?
