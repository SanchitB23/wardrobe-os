# RFC-017: Trip Planner

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Claude (Opus 4.8)
Target Release: v2.0.0
Epic: Travel
Priority: High
Effort: XL
Dependencies:
- RFC-006 Lifestyle Engine (`src/domain/lifestyle`) — the pure planner this RFC makes reusable/editable; already defines `Trip`, `LifestylePlan`, `PlanningStrategy`, `TravelStyle`
- RFC-011 Weather Runtime (`src/runtime/weather`) — the single weather source for "Weather Refresh"
- RFC-012 Recommendation Engine v2 (`src/domain/recommendation/v2`) — per-day outfit decisions (via the Orchestrator)
- RFC-001 Buy vs Skip / Acquisition (`src/domain/acquisition`) — fills packing gaps ("Shopping Before Trip")
- RFC-005 Intelligence Orchestrator (`src/domain/orchestrator`) — how Lifestyle requests recommendation/acquisition (never direct)
- RFC-013 Personalization Engine v2 (`src/domain/personalization/v2`) — taste feeds the per-day recommendation
- RFC-015 Intelligence Center (`src/domain/intelligence`) — future consumer of trip-prep actions (Pack / Clean / Buy)
- ADR-002 (RecommendationContext), ADR-005 (AI does not decide), ADR-006 (caching), ADR-008 (release/versioning)

> **The first v2.0 feature** (Lifestyle Intelligence Platform). It promotes the
> one-shot trip *wizard* into a first-class, persisted, reusable **Trip Planner**.
> Trip is data; the Lifestyle Engine plans; recommendation decides; acquisition
> fills gaps; AI explains (ADR-005).

---

## Trip Planner Philosophy

The same separation as every prior engine, applied to travel:

- **Trip is data.** A trip is a persisted, editable object (destination, dates,
  cities, events, style, notes, packing progress) — not a throwaway form.
- **The Lifestyle Engine plans.** Given a trip + forecast + context it produces a
  deterministic `LifestylePlan` (packing, outfits, laundry, shopping) — unchanged
  from RFC-006. The Trip Planner *owns the trip*; the engine *derives the plan*.
- **Recommendation decides; acquisition fills gaps; AI explains.** Per-day outfits
  come from Recommendation v2, missing items from Buy vs Skip — both **through the
  Orchestrator** (RFC-005). AI narrates the plan; it never plans or decides.

So: **Trip (data) → Trip Planner (CRUD/templates/progress) → Lifestyle Engine
(plan) → Recommendation / Acquisition → Trip Plan → (optional) AI explanation.**
The plan is a pure function of the trip + forecast + wardrobe; the *trip* and the
*packing progress* are the only new persisted, mutable state.

## 1. Problem Statement

Wardrobe OS already plans trips: the Lifestyle Engine (RFC-006) turns a `Trip` +
forecast into a `LifestylePlan` (packing list, per-day outfits, laundry schedule,
shopping suggestions), surfaced at `/lifestyle/trip`. But that planning is
**static and ephemeral**:

- **Trips aren't saved.** The trip lives only in the wizard form for one render.
  There is no persistence (`src/features/lifestyle` has no repository) — close the
  tab and the trip is gone. You cannot come back to a plan, edit it, or compare
  trips.
- **Nothing is reusable.** Every trip is entered from scratch. There are no
  **templates** ("weekend city break", "week-long beach", "business 3-day") and no
  **history** to clone from.
- **It's single-destination.** The `Trip` shape is one `destination` + one date
  range. **Multi-city** itineraries (Delhi → Goa → Bombay, each with its own days
  and weather) aren't representable.
- **Packing is read-only.** The plan lists what to pack, but there's no
  **checklist** you can tick off, no **packing progress**, and no persisted state
  of "I've packed 12 of 18".
- **The plan is a wall of sections.** There's no **timeline** or **outfit
  calendar** view — a day-by-day itinerary of what to wear and do.
- **Weather goes stale.** The forecast is fetched once. As the trip approaches
  there's no **weather refresh** that re-pulls (via the Weather Runtime) and
  re-plans.
- **Shopping isn't trip-anchored.** "Shopping before the trip" (missing items for
  specific dates) exists in the plan but isn't a first-class, trackable pre-trip
  workflow.

We need a **first-class Trip Planner** that makes trips **reusable, editable, and
optimizable** — persisted trip objects, templates, history, multi-city support,
an interactive packing checklist with progress, a trip timeline / outfit calendar,
trip-anchored shopping, and weather refresh — while the deterministic
`LifestylePlan` stays exactly the pure engine output it is today.

## 2. Goals

- **Persist trips** as first-class, editable objects (create / read / update /
  delete), so a plan can be revisited, tweaked, and re-run.
- **Trip Templates** — reusable starting points (style + duration + event shape)
  to spin up a trip in one tap.
- **Trip History** — past + upcoming trips, cloneable into a new trip.
- **Multi-city trips** — an itinerary of city legs, each with its own dates and
  weather; the planner plans across the whole horizon and merges.
- **Packing checklist + progress** — the deterministic packing list rendered as a
  tickable checklist with persisted, per-trip progress (packed / not packed).
- **Trip timeline + outfit calendar** — a day-by-day view: each day's occasion,
  weather, and recommended outfit.
- **Shopping before trip + missing items** — the plan's missing-items /
  buy-suggestions surfaced as a trackable pre-trip shopping list.
- **Weather refresh** — re-pull the forecast from the Weather Runtime (RFC-011)
  and re-plan on demand; the plan stays deterministic given the refreshed input.
- **Keep planning deterministic.** The `LifestylePlan` remains a pure function of
  the (persisted) trip + forecast + wardrobe context; same inputs ⇒ same plan.
- **Engines decide, AI explains.** No new scoring/verdicts here; the Trip Planner
  orchestrates persistence + the existing engines and narrates via AI (ADR-005).

## 3. Non-Goals

Explicitly **out of scope** for RFC-017 (verbatim from the brief, plus guardrails):

- **Flight booking** · **Hotel booking** · **Maps** · **Expense tracking** ·
  **Calendar sync** · **Notifications** — the planner plans wardrobe, not travel
  logistics or spend, and pushes nothing.
- **A new planning engine.** The Lifestyle Engine (RFC-006) is the planner,
  unchanged in spirit; this RFC adds persistence + UX + multi-city, not new
  scoring.
- **AI trip planning.** AI narrates the deterministic plan; it never generates the
  itinerary, outfits, or packing list (ADR-005).
- **Real-time collaboration / sharing.** Single owner; no multi-user trips.
- **Booking/price integrations or a travel API.** Weather is the only external
  data (via the existing Weather Runtime).

## 4. User Stories

- As the owner, I plan a trip, **save it**, and come back a week later to edit the
  dates and re-run the plan.
- As the owner, I start from a **"Business 3-day" template** and only tweak the
  city and dates.
- As the owner, I clone **last month's Goa trip** into a new one instead of
  re-entering everything.
- As the owner, I plan **Delhi → Goa → Bombay** as one multi-city trip and get a
  single packing list that covers all three, with per-city weather.
- As the owner, I tick items off a **packing checklist** and see **"14 / 18
  packed"** persist across sessions.
- As the owner, I see a **day-by-day timeline / outfit calendar**: what the day is
  for, the weather, and what to wear.
- As the owner, a week out I hit **"refresh weather"** and the plan updates to the
  latest forecast.
- As the owner, I see a **pre-trip shopping list** of the gaps the plan found, and
  tick them off as I buy.
- As a developer, I want the persisted trip to feed the same pure Lifestyle Engine
  so the plan is reproducible and testable.

## 5. UX Flow

Primary surface: **Trips** (candidate routes **`/trips`**, **`/trips/[id]`**,
**`/trips/new`** — replacing/expanding today's single `/lifestyle/trip`).

1. **Trips list (`/trips`)** — upcoming + past trips (history), each a card with
   destination(s), dates, and packing progress. Actions: **New trip**, **From
   template**, **Clone**.
2. **New / edit trip** — a form over the persisted `Trip` (destination or
   **cities**, dates, events, travel style, planning strategy, notes). Save
   persists; it does not require generating the plan.
3. **Trip detail (`/trips/[id]`)** — the plan, in tabs/sections:
   - **Timeline / Outfit Calendar** — day-by-day: occasion · weather · recommended
     outfit (from Recommendation v2).
   - **Packing** — the deterministic packing list as an interactive **checklist**
     with **progress** (`14 / 18`), grouped by slot.
   - **Laundry** — the wash schedule + re-wears.
   - **Shopping before trip** — missing items + buy suggestions as a tickable list.
   - **Warnings / trade-offs** — from the plan.
   - **Refresh weather** — re-pull + re-plan.
   - **Explain** (optional) — AI narration of the plan.
4. **Templates** — a small set of built-in templates + "save this trip as
   template".

States: **empty** (no trips → prompt to create), **draft** (trip saved, plan not
yet generated), **planned**, **stale weather** (forecast older than N days → offer
refresh), and **past** (read-only history, cloneable). Planning runs server-side
on demand; the plan is cached (ADR-006) and recomputed on edit / refresh.

## 6. Architecture

The Trip Planner is a **feature layer** (persistence + orchestration + UX) over
the **pure Lifestyle Engine**. The engine and its plan are unchanged; the new
persisted state is the **trip** and its **packing progress**.

```
Trip (persisted: destination/cities/dates/events/style/strategy/notes/progress)
        ↓  Trip Planner service (CRUD · templates · clone · refresh)
        ↓  assemble LifestyleInput (trip → forecast via Weather Runtime + context)
Lifestyle Engine  planLifestyle(...)                                   ← PURE (RFC-006)
        ↓  requests, through the Orchestrator (RFC-005):
        ├─ recommendation (RFC-012) → per-day outfits
        └─ acquisition (RFC-001)    → fill packing gaps
        ↓
LifestylePlan (packing · outfits · laundry · shopping · warnings · trade-offs)
        ↓  Trip Planner projects → Trip Plan view (timeline · calendar · checklist)
        ↓
[optional] AI explanation (RFC-014 Explanation capability) — narrates, never plans
```

### Domain Layer
- **Lifestyle Engine — unchanged** (`src/domain/lifestyle`, RFC-006). Still
  `planLifestyle(input, options) → LifestylePlan`, pure, `generatedAt` injected.
- **Multi-city (pure extension)** — a trip may carry an ordered `cities[]` (legs),
  each a `{ city, startDate, endDate }`. The planner expands legs into the trip's
  `TripDay[]` (each day tagged with its city + that city's forecast) and runs the
  engine over the merged horizon, so one packing list covers the whole itinerary.
  A single-destination trip is the one-leg case (backward compatible).
- **Trip Planner domain helpers (pure)** — template expansion (`template → Trip`),
  clone (`Trip → Trip` with shifted dates), and a **packing-progress projection**
  (`packingList + checkedIds → { packed, total, remaining }`). Deterministic; no
  I/O.
- **Deterministic packing checklist** — the checklist *items* are the engine's
  packing list (deterministic); the *checked state* is user data layered on top
  (never affects the plan).

### Service Layer
- `src/features/trips/services/trips.service.ts` — trip CRUD, list (history),
  clone, template instantiation, and `getTripPlan(tripId, { refreshWeather })`
  which assembles the `LifestyleInput` (trip → forecast via the Weather Runtime;
  recommendation context; wardrobe), calls `planLifestyle`, and returns
  `{ data, error }`. Plan cached (ADR-006) keyed on a trip fingerprint + forecast.
- Packing-progress + shopping-checklist writes (tick / untick) persist to the trip.

### Repository Layer
- `src/features/trips/repositories/trips.repository.ts` — the only code touching
  the new `trips` tables (§8). Reads/writes trips, cities, events, and packing
  progress via the Supabase anon client (anon RLS).

### UI Layer
- `src/features/trips` — Trips list, new/edit form, trip detail (timeline / outfit
  calendar / packing checklist / laundry / shopping / warnings), template picker,
  weather-refresh, and the nav entry (replacing "Trip Planner").

### AI Layer
- Optional plan narration via the RFC-014 **Explanation** capability, fed the
  already-computed `LifestylePlan`. **AI never plans, packs, or decides** (ADR-005).

## 7. Data Flow

```
UI → tripsService.getTripPlan(tripId, { refreshWeather? })            { data, error }
  → repository: load Trip (+ cities + events + packing progress)      (Supabase)
  → forecast: Weather Runtime (RFC-011) per city/leg — cached (60-min TTL)
  → assemble LifestyleInput { trip (+cities→TripDay[]), forecast, recommendation
      context, wardrobe, preferences/health/usage/purchase }
  → planLifestyle(input, { generatedAt, strategy })                   ← PURE (RFC-006)
      · per-day outfit  ← recommendation capability (RFC-012) via Orchestrator
      · packing gaps    ← acquisition capability (RFC-001) via Orchestrator
  → LifestylePlan (packing · outfits · laundry · shopping · warnings · trade-offs · planScore)
  → project → Trip Plan view: timeline / outfit calendar / packing checklist
      (checklist state merged from persisted packing progress)
  → [optional] AI explanation (no recompute, no decisions)

UI → tick packing item → tripsService.setPackingProgress(tripId, itemId, packed) → repository
```

`planLifestyle` and the multi-city expansion are pure and deterministic: identical
trip + forecast + wardrobe + `generatedAt` ⇒ identical `LifestylePlan`. Persisted
trip edits and packing-progress ticks are ordinary mutable state and never change
the plan's determinism (they change its *inputs*, or sit *beside* it).

## 8. Data Model / Schema Impact

**New, additive tables** — trips become first-class persisted data (today nothing
persists). The derived `LifestylePlan` is **not** stored (recomputed on demand,
like every other engine output); only the trip *inputs* and *packing progress*
persist. Anon RLS consistent with the app's `mvp_anon_*` policy (Supabase anon
key, no auth). SQL is illustrative — finalised + called out in the implementing PR.

```sql
-- A saved trip (single- or multi-city; a template is a trip with is_template=true).
create table if not exists trips (
  id                uuid primary key default gen_random_uuid(),
  name              text,                         -- e.g. "Goa long weekend"
  destination       text,                         -- primary/label (multi-city uses trip_cities)
  start_date        date not null,
  end_date          date not null,
  travel_style      text not null default 'standard',   -- minimal | standard | overpacker
  planning_strategy text not null default 'balanced',   -- minimal | balanced | luxury | business
  laundry_available boolean not null default false,
  luggage_kind      text not null default 'carry_on',   -- carry_on | checked | unbounded
  notes             text,
  is_template       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Ordered city legs for multi-city trips (a single-destination trip has 0–1 rows).
create table if not exists trip_cities (
  id          uuid primary key default gen_random_uuid(),
  trip_id     uuid not null references trips(id) on delete cascade,
  city        text not null,
  start_date  date not null,
  end_date    date not null,
  sort_order  integer not null default 0
);

-- Events within a trip (occasion + optional formality hint on a date).
create table if not exists trip_events (
  id             uuid primary key default gen_random_uuid(),
  trip_id        uuid not null references trips(id) on delete cascade,
  event_date     date not null,
  occasion       text not null,
  formality_hint text
);

-- Packing checklist progress (checked item ids). Separate from the deterministic plan.
create table if not exists trip_packing_progress (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  item_id    uuid not null,             -- FK-by-convention to wardrobe_items
  packed     boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (trip_id, item_id)
);
```

**RLS:** each table gets the four anon policies the feature needs (SELECT always;
INSERT/UPDATE/DELETE for the owner's trips + progress). No change to existing
tables. **No migration is applied in this RFC** — it documents the impact.

## 9. API / Domain Contracts

Illustrative (final names settled at implementation). Reuses the RFC-006
`LifestylePlan` / `PlanningStrategy` / `TravelStyle` verbatim.

```ts
// Persisted trip (feature type; maps to the `trips` + child tables).
export interface TripRecord {
  id: string;
  name: string | null;
  destination: string | null;
  startDate: string;                 // ISO date
  endDate: string;
  cities: TripCity[];                // [] or 1 = single-destination; ≥2 = multi-city
  events: TripEvent[];               // RFC-006 shape
  travelStyle: TravelStyle;          // RFC-006
  planningStrategy: PlanningStrategy; // RFC-006
  laundry: LaundryAvailability;      // RFC-006
  luggage: LuggageConstraint;        // RFC-006
  notes: string | null;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TripCity {
  city: string;
  startDate: string;
  endDate: string;
  sortOrder: number;
}

/** Persisted packing progress (checked state), merged into the checklist view. */
export interface PackingProgress {
  packedItemIds: string[];
}

/** The derived Trip Plan view = the pure LifestylePlan + progress + projections. */
export interface TripPlanView {
  trip: TripRecord;
  plan: LifestylePlan;               // RFC-006 — packing / outfits / laundry / shopping / warnings
  timeline: TripTimelineDay[];       // day → occasion · weather · recommended outfit
  packingChecklist: {
    bySlot: Record<string, { itemId: string; label: string; packed: boolean }[]>;
    packed: number;
    total: number;
  };
  weather: { source: "live" | "manual" | "seasonal_fallback"; refreshedAt: string };
}

export interface TripTimelineDay {
  date: string;
  city?: string;
  occasion: string;
  weather: { condition: string; season: string };
  outfitItemIds: string[];
  score: number;
  uncovered: boolean;
}

// Built-in templates (pure): a template expands into a draft TripRecord.
export type TripTemplateId = "weekend_city" | "week_beach" | "business_3day" | "custom";
export function expandTemplate(id: TripTemplateId, opts: { startDate: string; destination?: string }): TripRecord;

// Service surface (feature layer):
export function listTrips(): Promise<Result<TripRecord[]>>;              // history + upcoming
export function getTrip(id: string): Promise<Result<TripRecord>>;
export function saveTrip(trip: Partial<TripRecord>): Promise<Result<TripRecord>>;
export function cloneTrip(id: string, newStartDate: string): Promise<Result<TripRecord>>;
export function deleteTrip(id: string): Promise<Result<void>>;
export function getTripPlan(id: string, opts?: { refreshWeather?: boolean }): Promise<Result<TripPlanView>>;
export function setPackingProgress(id: string, itemId: string, packed: boolean): Promise<Result<void>>;
```

## 10. Acceptance Criteria

This RFC is **Approved-ready** when it defines all of the below (it does):

- [ ] Persisted, first-class trips (CRUD) and the additive schema (§8), documented
      not applied, with RLS implications.
- [ ] Trip **templates** (expand → draft trip) and **history** (list + clone).
- [ ] **Multi-city** trips (ordered city legs → merged `TripDay[]`, one packing
      list) as a pure extension; single-destination is the one-leg case.
- [ ] Packing **checklist + progress** as persisted state layered on the
      deterministic packing list (never affecting the plan).
- [ ] Trip **timeline / outfit calendar** projection (day → occasion · weather ·
      recommended outfit).
- [ ] **Shopping before trip / missing items** surfaced from the plan's shopping
      plan as a trackable list.
- [ ] **Weather refresh** via the Weather Runtime (RFC-011) → re-plan.
- [ ] The `LifestylePlan` stays the pure RFC-006 output (engines decide; AI
      explains); recommendation/acquisition reached through the Orchestrator.
- [ ] Non-goals (booking, maps, expenses, calendar sync, notifications).
- [ ] Testing plan, risks, future extensions.

Implementation-time acceptance criteria (tracked in that PR — not this RFC):
- [ ] **Reusable trips** — a saved trip can be reopened, edited, and re-planned.
- [ ] **Templates** — a template instantiates a draft trip in one action.
- [ ] **Packing progress** — ticking items persists and shows `N / M`.
- [ ] **Timeline** — the day-by-day outfit calendar renders with weather + outfit.
- [ ] **Trip history** — past + upcoming trips list and clone.
- [ ] **Deterministic planning** — same trip + forecast + wardrobe + `generatedAt`
      ⇒ identical `LifestylePlan`; refresh changes only via the new forecast.

## 11. QA / Testing Plan

- **Unit tests (Vitest, pure):**
  - Multi-city expansion: `cities[]` → the correct `TripDay[]` (right city + date +
    forecast per day); single-destination = one-leg equivalence.
  - Template expansion: each `TripTemplateId` → the expected draft trip shape.
  - Clone: date-shift preserves duration + events offset correctly.
  - Packing-progress projection: `packingList + checkedIds → { packed, total }`;
    checked state never alters the plan.
  - Timeline projection: `LifestylePlan.tripPlan.dailyOutfits → TripTimelineDay[]`.
  - Determinism: same trip + forecast + `generatedAt` ⇒ identical plan (re-uses the
    RFC-006 engine determinism guarantee).
- **Service/repository (at implementation):** CRUD + clone + template round-trip;
  packing-progress persistence; `getTripPlan` assembles inputs and returns
  `{ data, error }`; weather-refresh re-pulls + re-plans.
- **RLS audit:** the new tables expose exactly the anon policies the feature needs
  (SELECT/INSERT/UPDATE/DELETE for trips + progress).
- **Integration guard:** the planner reaches recommendation/acquisition **through
  the Orchestrator**, never calling those engines directly (RFC-005).
- **AI guard:** removing AI leaves the plan + timeline unchanged (narration only).
- **Release gate:** `npm test`, `npm run lint`, `npm run build` green (ADR-008).

## 12. Risks & Trade-offs

- **First persisted user-authored entity.** Trips are the app's first
  create/edit/delete domain object beyond wardrobe items. *Mitigation:* additive
  tables, anon RLS mirroring existing patterns, a thin repository, and a
  supabase-rls audit before merge.
- **Multi-city complexity.** Merging legs into one plan risks packing/laundry edge
  cases (a warm leg + a cold leg). *Mitigation:* the engine already plans across a
  horizon; legs only change *which forecast* each day uses. Warnings surface
  conflicting climates; the single packing list is the union.
- **Plan vs progress coupling.** The checklist mixes deterministic plan items with
  mutable checked state. *Mitigation:* keep them separate — the plan is recomputed
  and pure; progress is keyed by `(trip, item)` and merged only in the view. A
  re-plan that drops an item simply drops its checklist row.
- **Stale weather.** A saved trip's forecast ages. *Mitigation:* a `refreshedAt` +
  a "stale weather" state + one-tap refresh via the Weather Runtime (cached,
  never throws).
- **Scope creep toward travel logistics.** Booking/maps/expenses are tempting.
  *Mitigation:* hard non-goals — the planner plans *wardrobe* for a trip, nothing
  else.
- **Caching correctness.** Editing a trip must invalidate its cached plan.
  *Mitigation:* cache key includes the trip fingerprint + forecast; edits bump it.

## 13. Future Extensions

- **Intelligence Center trip actions (RFC-015)** — surface `Pack` / `Clean` /
  `Buy-before-trip` as prioritised actions when a trip is upcoming.
- **Capsule reuse across trips** — suggest a capsule proven on a past similar trip.
- **Trip retrospective** — after a trip, reconcile packed vs actually-worn (via
  wear logs) to sharpen future packing confidence.
- **Shared/exported itinerary** — a read-only export of the outfit calendar.
- **Calendar-aware events** — pull event dates once Calendar Intelligence is
  reconsidered (currently parked — see [FUTURE.md](../product/FUTURE.md)).
- **Laundry detection (Vision v2, RFC-019)** — feed real laundry state into the
  wash schedule.

## 14. Open Questions

1. **Route/IA** — new `/trips` (list) + `/trips/[id]` replacing `/lifestyle/trip`,
   or keep `/lifestyle/*` as the namespace? How does it sit under the Stylist /
   Lifestyle nav group?
2. **Templates source** — a small built-in set (code constants) only, or also
   "save any trip as a template" (a `trips` row with `is_template=true`)? Both?
3. **Multi-city weather** — one Weather Runtime query per city leg (N calls,
   cached), or a single bounding query? How are inter-city travel days handled
   (which city's weather)?
4. **Packing-progress lifecycle** — when a re-plan drops/adds items, do we keep
   orphaned progress rows, prune them, or show "no longer in plan"?
5. **Plan persistence** — keep the plan strictly recomputed (current lean), or
   snapshot it per trip for offline/history fidelity (a `trip_plan_snapshot`)?
6. **Weather-staleness threshold** — after how many days does a saved plan's
   forecast read as "stale" and prompt a refresh?
7. **Shopping-before-trip tracking** — is the pre-trip shopping list its own
   checklist (persisted ticks), or does it defer to the acquisition/wishlist flow
   (RFC-018 Shopping Intelligence)?
