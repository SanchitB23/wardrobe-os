# RFC-007: Today Experience & v1.0 Product Polish

Status: Draft
Owner: Sanchit Bhatnagar
Author: ChatGPT
Target Release: v1.0.0
Epic: Product Experience
Priority: Critical
Effort: L
Dependencies:
- Intelligence Orchestrator (`src/domain/orchestrator`, RFC-005) — the Today page composes engine outputs through it
- Recommendation / Analytics / Health / Acquisition / Lifestyle features — the surfaces Today aggregates (all existing)
- AI Stylist Chat (`/chat`) + the explanation services (RFC-003/004/006) — reused, not extended
- Layout system: `AppShell`, `PageHeader`, `nav-config`, `useDevMode` + `DEVELOPER_SECTION` (existing)
- VERSION.md / CHANGELOG.md — sourced by the About page
- ADR-005 (AI does not decide), ADR-008 (release/versioning)

---

## Experience Philosophy

**One assistant, not many modules.** Every capability already exists; RFC-007
adds no new intelligence. It makes the existing intelligence feel like a single,
coherent daily assistant instead of a set of powerful-but-separate tools.

- **Today is the front door.** The default route answers "what do I do about my
  wardrobe today?" by *surfacing* deterministic engine outputs and one entry to
  the AI stylist — it decides nothing new.
- **Compose, don't recompute.** Today reads through the Intelligence Orchestrator
  (RFC-005) and existing services; it is a *consumer*, not a new engine.
- **AI explains and converses only** (ADR-005). Polish changes presentation, not
  the decision boundary.
- **Ship-ready, not feature-ready.** The bar for v1.0 is cohesion, accessibility,
  performance, and a green release checklist — not more surface area.

## 1. Problem Statement

Wardrobe OS now has nearly every capability it needs — inventory, outfits,
analytics, recommendations, acquisition, vision, personalization, orchestration,
and lifestyle planning. The remaining work is **not adding engines**.

Today the app reads as a collection of individually powerful modules: the user
navigates to a page, uses a tool, navigates elsewhere, uses another. There is no
single place that answers the daily question — *"what should I do about my
wardrobe today?"* — and no consistent connective tissue (navigation, settings,
about, developer surfaces) that makes it feel like **one assistant**.

RFC-007 is the v1.0 product-polish pass: a cohesive **Today** experience,
finalized navigation, a real Settings/About, a cleanly-gated Developer Mode, and
an accessibility + performance + release-readiness sweep.

## 2. Goals

- Make **Today** the default, assistant-style home that lets the user complete
  every major workflow (see today's outfit, ask the stylist, review insights,
  act on shopping suggestions, jump to a trip) without hunting through modules.
- **Finalize the information architecture**: Wardrobe · Stylist · Insights ·
  Lifestyle · Settings, with developer-only tools removed from normal navigation.
- Deliver a real **Settings** experience (Profile, Preferences, AI Runtime,
  Providers, Developer Mode, Theme, About) and an **About** page.
- Consolidate developer surfaces under **Developer Mode** (Playground, Prompt
  Viewer, Cache Viewer, Runtime Statistics, Execution Graph, Feature Flags),
  hidden unless dev mode is on.
- Pass an **accessibility** bar (keyboard nav, focus, contrast, ARIA) and a
  **performance** bar (bundle, caching, lazy loading, code splitting, images).
- Complete the **v1.0 release checklist** (tests, lint, build, a11y, perf, docs,
  version, tag, release notes) per ADR-008.
- Add **no** new engines or AI capabilities.

## 3. Non-Goals

Explicitly **out of scope** for RFC-007:

- **New engines / new AI capabilities** — this is polish, not capability.
- **Calendar** integration, **Notifications**, **Browser Extension**, **OCR** —
  permanently or separately scoped (see ROADMAP / prior RFC non-goals).
- **AI decision-making** — Today and its widgets surface deterministic outputs
  and an AI *chat/explain* entry; AI never decides.
- **Redesigning the engines or their outputs** — Today reshapes presentation, not
  computation.
- **A marketing site / onboarding tour** — the About page is informational, not a
  funnel.

## 4. User Stories

- As the owner, I open the app and **Today** greets me, shows today's outfit, a
  single insight, any shopping nudge, and a stylist prompt — so I act in seconds.
- As the owner, I can **complete any major task from Today** — wear/save today's
  outfit, ask the stylist, open a flagged shopping suggestion, start a trip plan —
  without learning the module map.
- As the owner, I want **navigation that reads as one product** (Wardrobe /
  Stylist / Insights / Lifestyle / Settings), not an ever-growing tool list.
- As the owner, I want **Settings** where I actually control preferences, theme,
  AI runtime/providers, and can read an **About** page (version, what's new).
- As a developer, I want **Developer Mode** to reveal the Playground, prompt/cache
  inspectors, runtime stats, and the orchestrator execution graph — and to stay
  hidden for a normal user.
- As any user, I want the app to be **keyboard-navigable, legible, and fast**.

## 5. UX Flow

### Today (default route `/`)
A single scannable column of composable **widgets**, each backed by an existing
engine/service and each linking to its full surface. Sections (in order):

1. **Good Morning** — time-aware greeting + date (client local time).
2. **Today's Outfit** — the top recommendation (reuses the recommendation card);
   actions: wear today / save / open Recommendations.
3. **Ask Stylist** — a prompt box that deep-links into `/chat` with the question.
4. **Today's Insight** — one high-signal insight (from the Insight engine).
5. **Trip Summary** — a **future placeholder** (links to `/lifestyle/trip`); shows
   an upcoming trip once trips are persisted (RFC-006 future).
6. **Shopping Suggestions** — flagged gaps/buy-vs-skip nudges (reuses shopping card).
7. **Quick Actions** — Add Item, Create Outfit, Plan a Trip, Log a Wear.
8. **Recent Activity** — latest wears / added items / saved outfits.
9. **Wardrobe Health** — the headline health score + one action (links to Health).

Each widget has its own empty/loading/error state and degrades independently
(one failing widget never blanks the page).

### Navigation (finalized IA)
Primary sidebar groups:
- **Wardrobe** — Inventory, Outfits, Wear Logs
- **Stylist** — Recommendations, Chat, Advisor, Screenshot *(Acquisition folds in here)*
- **Insights** — Overview, Health, Usage, Purchases, Insight Center
- **Lifestyle** — Trip Planner
- **Settings** — Settings, Import, Review

Developer tools are **removed from normal navigation** and shown only when
Developer Mode is on (existing `DEVELOPER_SECTION` + `useDevMode`).

### Settings (`/settings`)
Sectioned: **Profile**, **Preferences** (→ RFC-004 `/settings/preferences`),
**AI Runtime**, **Providers**, **Developer Mode** (toggle), **Theme**, **About**.

### About (`/settings/about`)
**Version** (from VERSION.md), **Release Notes** (from CHANGELOG.md),
**Architecture** summary, **AI Runtime** (active provider/model, capability map),
**Credits**, **Links** (docs, RFCs, roadmap).

### Developer Mode
Consolidated dev hub (gated): **Playground** (`/ai/playground`), **Prompt Viewer**,
**Cache Viewer** (the `ai_cache`), **Runtime Statistics** (provider/latency/cost),
**Execution Graph** (an inspector for an orchestrator `ExecutionReport`, RFC-005),
**Feature Flags**.

## 6. Architecture

RFC-007 is almost entirely **UI layer**. It introduces **no domain engine** and
**no new AI**. It composes existing features.

### Domain Layer
None new. Today reads existing engine outputs (recommendation, insights, health,
acquisition, lifestyle) — ideally via the Intelligence Orchestrator (RFC-005) so
the composition + failure isolation live in one place.

### Service Layer
- A thin **Today aggregation** service composes the widgets' data from existing
  services (best-effort, per-widget: one failure ⇒ that widget errors, others
  render). Preferably one orchestrator request for the engine-backed widgets, plus
  direct reads for activity.
- No new persistence services beyond an optional profile/feature-flags read (§8).

### Repository Layer
None new (reads reuse existing repositories). Feature flags + profile are the only
candidates for new storage, deferred (§8).

### UI Layer (the bulk)
- **Today** (`app/page.tsx` → a `TodayView` composing widget components), each
  widget a small client component with its own state.
- **Navigation** — finalize `nav-config` groups; keep the dev section gated.
- **Settings** — a sectioned settings view + an **About** route.
- **Developer Mode** — a dev hub view aggregating the tools above.
- **Accessibility + performance** passes across shared components.

### AI Layer
Reused only: the "Ask Stylist" widget deep-links to the existing chat; explanation
buttons reuse existing explanation services. **No new prompts, tools, or
decisions.** AI explains/converses only (ADR-005).

## 7. Data Flow

```
Today (/)
  → TodayService.load()                                          { data, error }
     → (preferred) orchestrate({ capabilities: [recommendation, analytics, health, …] })  (RFC-005)
     → + direct reads: recent activity (wear logs), shopping nudges (acquisition/health gaps)
     → assemble a TodayViewModel of independent widget slices
  → each widget renders its slice (own empty/loading/error); a failed slice is isolated
  → "Ask Stylist" → deep-link to /chat?q=…            (existing chat; AI converses)
  → "Explain" affordances → existing explanation services (AI explains, no recompute)
```

No widget computes a decision; each surfaces a deterministic output or an AI
conversation/explanation entry.

## 8. Data Model / Schema Impact

**No database schema changes required for v1.0.** Theme is client-side
(next-themes), Developer Mode is client-side (`useDevMode`), and Today reads
existing tables.

Future (optional, additive — documented, not built here):
- `user_profile` (display name, home city, lifestyle defaults) so Profile + trip
  defaults persist.
- `feature_flags` (key → bool) if flags need to be server-driven rather than
  local. Additive, anon-RLS consistent with the app.

## 9. API / Domain Contracts

Mostly UI; the one new shape is the Today view-model (illustrative):

```ts
// A composed, presentation-only view model (no new engine).
export interface TodayViewModel {
  greeting: { partOfDay: "morning" | "afternoon" | "evening"; dateLabel: string };
  todaysOutfit: WidgetState<UnifiedOutfitRecommendation | null>;
  insight: WidgetState<{ title: string; detail: string } | null>;
  shopping: WidgetState<{ need: string; decision: string }[]>;
  health: WidgetState<{ score: number; topAction: string | null }>;
  recentActivity: WidgetState<{ kind: string; label: string; at: string }[]>;
  tripSummary: WidgetState<null>; // future placeholder
}

/** Each widget resolves independently so one failure never blanks Today. */
export type WidgetState<T> =
  | { status: "ok"; data: T }
  | { status: "empty" }
  | { status: "error"; message: string };
```

No changes to any engine's public contract. Feature flags (if built) would expose
a small client `useFeatureFlag(key)` reading local state.

## 10. Acceptance Criteria

Approved-ready when this RFC defines all of the below (it does):

- [ ] The Today page layout (9 sections) as the default route, each widget backed
      by an existing engine/service and independently degradable.
- [ ] A finalized navigation IA (Wardrobe / Stylist / Insights / Lifestyle /
      Settings) with developer tools gated out of normal nav.
- [ ] Settings (Profile, Preferences, AI Runtime, Providers, Developer Mode,
      Theme, About) and an About page sourced from VERSION/CHANGELOG.
- [ ] A consolidated Developer Mode hub (Playground, Prompt/Cache viewers, Runtime
      stats, Execution Graph, Feature Flags).
- [ ] Accessibility scope (keyboard nav, focus, contrast, ARIA) and performance
      scope (bundle, caching, lazy loading, code splitting, images).
- [ ] The v1.0 release checklist (§11).
- [ ] Explicit non-goals (no new engines/AI, no calendar/notifications/extension/OCR).

Implementation-time acceptance criteria (tracked in that PR — not this RFC):
- [ ] A user can complete every major workflow starting from Today.
- [ ] Navigation is finalized; developer tools are hidden unless Dev Mode is on.
- [ ] Keyboard-only navigation reaches every primary action; visible focus rings;
      contrast meets WCAG AA; interactive elements have accessible names.
- [ ] No single widget failure blanks the Today page.
- [ ] AI remains explanation/conversation-only; removing AI leaves every
      deterministic surface unchanged.
- [ ] The release checklist passes green before the v1.0 tag.

## 11. QA / Testing Plan

- **Component/unit (Vitest + RTL where applicable):** the Today aggregation
  (widget slices resolve independently; a thrown slice → `error` state, others
  `ok`); greeting part-of-day boundaries (injected clock); nav active-route
  resolution; dev-mode gating (dev section hidden when off).
- **Accessibility:** keyboard traversal of Today + nav + settings; focus-visible
  on all interactive elements; automated axe checks in tests where feasible;
  manual contrast audit (light + dark).
- **Performance:** a bundle review (route-level code splitting, lazy-load heavy/
  dev-only surfaces), image optimization, and confirming caching (TanStack Query
  + AI cache) is in place. Record before/after route bundle sizes.
- **Preview verification:** every primary workflow driven from Today; light/dark;
  dev mode on/off.
- **Release gate (ADR-008):** `npm test`, `npm run lint`, `npm run build` all
  green before any tag.

### v1.0 Release Checklist
- [ ] Tests green (`npm test`)
- [ ] Lint clean (or documented baseline)
- [ ] Build passes (`npm run build`)
- [ ] Accessibility pass (keyboard/focus/contrast/ARIA)
- [ ] Performance pass (bundle/caching/lazy/splitting/images)
- [ ] Documentation updated (README, ARCHITECTURE, ENGINE, ROADMAP, VERSION)
- [ ] `VERSION.md` + `CHANGELOG.md` finalized for v1.0.0
- [ ] Annotated git tag `v1.0.0` (only after tests pass — ADR-008)
- [ ] Release notes written

## 12. Risks & Trade-offs

- **Today over-fetch / latency.** Composing many widgets can be slow.
  *Mitigation:* one orchestrator request for engine-backed widgets + parallel
  best-effort reads; per-widget loading; cache; lazy-load below-the-fold widgets.
- **Cohesion vs. depth.** A busy Today can overwhelm. *Trade-off:* one high-signal
  item per section, each linking to its full surface — Today summarises, modules
  go deep.
- **IA churn.** Regrouping nav (Acquisition → Stylist) can disorient.
  *Mitigation:* routes are preserved; only grouping/labels change (as in prior nav
  work); redirects if any route moves.
- **Scope creep into features.** Polish invites "just one more thing."
  *Mitigation:* hard non-goals; anything new is a post-v1.0 RFC.
- **Accessibility regressions later.** *Mitigation:* bake a11y checks into shared
  components + tests so they don't rot.
- **"Done" ambiguity.** *Mitigation:* the explicit release checklist is the
  definition of done for v1.0.

## 13. Future Extensions

- **Trip Summary (live)** — once trips persist (RFC-006 future), Today shows the
  next trip's readiness.
- **Calendar-aware Today** — surface today's events/occasions (a future consumer,
  still no calendar write).
- **Personalized Today ordering** — order widgets by the user's behaviour
  (RFC-004), still deterministic.
- **Server-driven feature flags** — the optional `feature_flags` table (§8).
- **Home-screen / PWA install** — an installable Today, later.

## 14. Open Questions

1. **Acquisition placement** — fold Advisor + Screenshot under **Stylist** (as
   proposed) or a dedicated **Shopping** group? (Leaning Stylist to keep the top
   level to five groups.)
2. **Today via Orchestrator** — one `orchestrate()` request for all engine-backed
   widgets, or per-widget calls? (Leaning one request for cohesion + isolation.)
3. **About source of truth** — parse VERSION/CHANGELOG at build time, or hand-curate
   an About view-model that references them?
4. **Feature flags now or later** — ship a local-only flag mechanism for v1.0, or
   defer entirely?
5. **Profile persistence** — does v1.0 need a `user_profile` table, or is a
   client-only profile (name, home city) enough for the Today greeting + trip
   defaults?
6. **Ask Stylist entry** — deep-link a prefilled `/chat` message, or an inline
   mini-composer on Today that opens chat on submit?
