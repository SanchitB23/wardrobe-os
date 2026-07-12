# RFC-023: Ad-hoc Wear Logs & Outfit Promotion

Status: Implemented  
Owner: Sanchit Bhatnagar  
Author: Cursor (Grok)  
Target Release: v2.x  
Epic: Wear Logging / Outfit Management  
Priority: High  
Effort: L  
Dependencies:
- Existing Wear Logs feature (`wear_logs` per-item rows; `createWearLog` /
  `createOutfitWearLogs`; Usage Analytics consumers)
- Outfits feature (`outfits` / `outfit_items`; Wear Outfit dialog)
- Recommendations — “Wear this” / log paths that today insert per-item wear rows
- Trip Planner (RFC-017) — planned outfits may later create wear logs (source=`trip`)
- Personalization / Recommendation context builders that ingest wear history
- ADR-005 (AI does not decide), ADR-007 (tool calling), ADR-008 (release/versioning)

> **Product model (canonical):**
>
> | Concept | Meaning |
> | --- | --- |
> | **Saved Outfit** | Curated, reusable / favorite combination. Lives in the Outfits list. |
> | **Ad-hoc Wear Log** | One-time historical record of what was actually worn. Does **not** create an outfit. |
> | **Outfit Promotion** | User-confirmed save of a repeated ad-hoc combination into a Saved Outfit. Never automatic. |
>
> Canonical flow:
>
> ```
> Select Items
>   → Log Wear
>   → Wear Log Created (source = ad_hoc | outfit | recommendation | trip | ai)
>   → Optional: Suggest “Save as Outfit?” after repeated use
>   → User names + confirms → Saved Outfit (promotion)
> ```

> **Grounding note (current product):** `wear_logs` is **one row per item**.
> Logging an outfit inserts N rows sharing `outfit_id` / `worn_on` / notes.
> There is no first-class “wear event” composition table, no `source` enum, and
> no repeated-combination detection. The UX bias is “wear a saved outfit,” which
> pushes users to create outfits for one-off wears and pollutes the Outfits list.
> Analytics already count per-item `wear_logs` rows — ad-hoc must continue to
> feed that signal without requiring `outfit_id`.

---

## 1. Problem Statement

Wardrobe OS currently treats **saved outfits as the primary path to wear
logging**. That is the wrong product model.

In real life:

- Most days you wear a combination once and move on.
- Only some combinations are worth remembering as favorites.
- Recommendations and trips propose combinations that should be loggable without
  first “saving an outfit.”

Forcing every wear through a saved outfit:

1. **Overpopulates the Outfits list** with one-off combinations.
2. Adds **friction** to daily logging (“create outfit → wear outfit”).
3. Blurs **history** (what I wore) with **curation** (what I want to reuse).

Who feels it today: the owner logging daily wears and browsing Outfits — the
list stops being a curated closet of favorites and becomes a noisy archive.

Why now: inventory, recommendations, trips, and usage analytics are mature
enough that wear history is a first-class signal. Separating ad-hoc logs from
saved outfits unblocks honest daily usage without weakening analytics or
outfit curation.

---

## 2. Goals

1. **Direct item-based wear logging** — select inventory items and create a wear
   log without creating a saved outfit.
2. **Optional saved outfit link** — `outfit_id` nullable; present when the wear
   came from (or was later linked to) a saved outfit.
3. **Wear log item composition** — one wear event owns many items (slots /
   order), not only disconnected per-item rows as the UX model.
4. **Repeated combination detection** — deterministic fingerprint of the item
   set; after N wears, suggest promotion (never auto-save).
5. **Suggested outfit promotion** — user names the outfit and confirms; Outfits
   list stays curated.
6. **Cleaner IA** — Outfits = curated; Wear Logs = history (with source badges).
7. **Analytics continuity** — creating any wear log (ad-hoc or outfit-linked)
   updates item usage analytics.
8. **Backward compatibility** — existing `wear_logs` rows remain readable; no
   destructive migration.

---

## 3. Non-Goals

- Automatic wear detection (sensors, photos, laundry).
- Calendar sync / Google Calendar (parked RFC-016).
- Notifications / reminders to log wears.
- Social sharing.
- Auto-saving outfits from ad-hoc wears.
- Bulk deleting or “cleaning” old outfits as part of this RFC.
- Machine learning for combination similarity (exact set matching only).
- AI deciding what to wear or what to promote (ADR-005) — AI may later *explain*
  a wear log; it must not create outfits or logs without an explicit tool + user
  intent (out of scope here beyond source=`ai` on the schema).

---

## 4. User Stories

- As the owner, I want to **quickly log what I wore today** from inventory items
  so that I don’t invent a saved outfit for a one-off combination.
- As the owner, I want to **multi-select items in Inventory** and log them
  together so that logging matches how I actually dressed.
- As the owner, I want **“Wear this” on a recommendation** to create a wear log
  without forcing me to save an outfit first.
- As the owner, I want **“Wear Outfit” on a saved outfit** to create a wear log
  that links `outfit_id` so favorites still have a one-tap path.
- As the owner, I want the system to **notice when I’ve worn the same combo N
  times** and ask “Save as Outfit?” so curation is opt-in, not the default.
- As the owner, I want a **Wear Log detail** that shows items, source, linked
  outfit (if any), and actions to edit items or promote to an outfit.
- As the owner, I want the **Outfits list to stay curated** so favorites remain
  browsable.
- As the owner, I want **usage / CPW / personalization** to count ad-hoc wears the
  same as outfit wears so analytics stay honest.

---

## 5. UX Flow

### 5.1 Entry points

| Entry | Primary action | Default `source` | `outfit_id` |
| --- | --- | --- | --- |
| Quick Log Wear (`/wear-logs/new` or hub CTA) | Select date + items + occasion + notes | `ad_hoc` | null |
| Inventory multi-select → Log Wear | Same as quick log with items prefilled | `ad_hoc` | null |
| Recommendation → Wear this outfit | Confirm date/occasion; items from recommendation | `recommendation` | null (unless user also saves outfit — separate) |
| Saved Outfit → Wear Outfit | Existing dialog; items from outfit | `outfit` | set |
| Trip day / planned outfit (later) | Log planned combo as worn | `trip` | optional |
| Wear Log detail → Save as Outfit | Promotion wizard | n/a (creates outfit; may back-link) | set after confirm |

### 5.2 Quick Log Wear

1. Choose **date** (default today).
2. Select **one or more active inventory items** (search / category chips).
3. Optional: **occasion**, **notes**, **weather/context** (reuse Weather Runtime
   snapshot when available; editable override allowed).
4. Save → creates one wear log event + item rows.
5. Toast with link to Wear Log detail. **No outfit is created.**

### 5.3 Repeated combination suggestion

After a successful ad-hoc (or any) log whose **combination fingerprint** has
reached threshold `N` (default **3**, env/`settings` override):

- Soft prompt (toast / banner on Wear Logs or post-save sheet):
  “You’ve worn this combination N times. **Save as Outfit?**”
- Dismissible; do not block save.
- “Save as Outfit” opens promotion flow (§5.4).

### 5.4 Outfit promotion

1. Prefill items from the wear log (ordered).
2. User enters **name** (required); optional notes/tags per existing outfit create.
3. Confirm → create `outfits` + `outfit_items`.
4. Optionally set `outfit_id` on **this** wear log (and optionally offer “link
   past wears of this combo” — default **this log only** in v1 of the RFC).
5. Never auto-name or auto-save without confirm.

### 5.5 Wear Log detail

Shows: date, occasion, weather/context summary, notes, **source badge**, item
thumbnails / names (ordered), linked outfit (if any).

Actions:

- Edit items / metadata (non-destructive; confirmation if removing all items).
- Save as Outfit (promotion).
- Open linked outfit (when present).
- Delete wear log (confirm) — removes event + composition; analytics recount.

### 5.6 Outfits list

Unchanged curation semantics: only rows in `outfits`. Ad-hoc wear logs **never**
appear here. Badge/count of wears may still show on an outfit when `outfit_id`
links exist.

### 5.7 Wear Logs list

Primary history surface: one card per **wear event** (not one row per item).
Filters: date range, source, linked/unlinked outfit, item contains, occasion.
Expand or open detail for composition.

---

## 6. Architecture

Feature-first glue. **No new scoring engine.** Deterministic fingerprinting +
threshold check only. AI does not decide promotion (ADR-005).

```
UI (Quick Log / Inventory / Recommendation / Outfit Wear / Wear Log detail)
  → hooks
  → wear-logs.service (orchestrates create / edit / promote)
      → domain: combination fingerprint, threshold, promote draft mapping
      → outfits.service (create outfit on promote only)
      → repositories → Supabase
  → usage analytics / personalization consumers read item-level wear facts
```

### Domain Layer

Pure TypeScript under e.g. `src/domain/wear-logs/` (or extend
`src/domain/wardrobe/`):

| Module | Responsibility |
| --- | --- |
| `WearCombination` | Normalize item ids → sorted unique set → stable `combinationKey` (hash or joined UUID digest) |
| `detectRepeatedCombination` | Given key + historical counts → `{ shouldSuggest, count, threshold }` |
| `mapWearLogToOutfitDraft` | Prefill outfit create DTO from wear log items (no I/O) |
| Types | `WearLogSource`, `WearLogEvent`, `WearLogItem`, `PromoteOutfitInput` |

Domain must **not** import React, Supabase, or AI.

### Service Layer

Extend `src/features/wear-logs/services/wear-logs.service.ts` (and thin
orchestration helpers):

- `createAdHocWearLog({ date, itemIds, occasionId?, notes?, weather?, source })`
- `createWearLogFromOutfit(...)` — wraps existing Wear Outfit path with
  `source='outfit'` + `outfit_id`
- `createWearLogFromRecommendation(...)`
- `updateWearLogItems(...)` / `updateWearLogMeta(...)`
- `promoteWearLogToOutfit({ wearLogId, name, linkThisLog })`
- `getWearLogDetail(id)` / `listWearLogs(filters)` — **event-centric** list
- `getCombinationSuggestion(combinationKey)` — for post-save UI

Return `{ data, error }` everywhere. Creating a wear log must update the same
usage signals analytics already depend on (see §7 / §8 dual-write or cutover).

### Repository Layer

- New tables for event + items (see §8).
- Additive writes; keep reading legacy `wear_logs` during compatibility window.
- Outfit create reuses `outfits` / `outfit_items` repositories — no duplicate
  outfit persistence path.

### UI Layer

| Surface | Notes |
| --- | --- |
| `/wear-logs` | Event cards, filters, suggestion banners |
| `/wear-logs/new` (or modal) | Quick Log Wear |
| `/wear-logs/[id]` | Detail + promote / edit |
| Inventory | Multi-select → Log Wear |
| Recommendation result | “Wear this outfit” → ad-hoc/recommendation log |
| Outfits | Wear Outfit unchanged; list stays curated |
| Nav / Today (optional) | Shortcut CTA “Log what you wore” |

### AI Layer

N/A for decisions. Optional later: explain a wear log or suggest a name for
promotion — **user must confirm**; name suggestion is not auto-save. No AI in
MVP of this RFC unless an existing chat tool is extended to call the same
service contracts (ADR-007).

---

## 7. Data Flow

### 7.1 Ad-hoc create

```
UI Quick Log
  → useCreateAdHocWearLogMutation
  → wearLogsService.createAdHocWearLog
      → domain: validate ≥1 item; build combinationKey
      → repo: insert wear_events (+ weather/notes/source/outfit_id null)
      → repo: insert wear_event_items (item_id, slot?, sort_order)
      → compatibility: ensure item-level usage facts exist for analytics
        (dual-write to legacy wear_logs OR write only to new tables and point
         analytics readers at wear_event_items — see §8 / Open Questions)
      → domain: count prior logs with same combinationKey
  → return { wearLog, suggestion? }
UI toast + optional “Save as Outfit?”
```

### 7.2 Saved outfit wear

```
WearOutfitDialog
  → createWearLogFromOutfit
      → source=outfit, outfit_id set
      → same composition insert from outfit_items
```

### 7.3 Recommendation wear

```
Recommendation “Wear this”
  → createWearLogFromRecommendation(itemIds, …)
      → source=recommendation, outfit_id null
```

### 7.4 Promotion

```
Wear Log detail / suggestion CTA
  → promoteWearLogToOutfit({ name, linkThisLog: true })
      → domain mapWearLogToOutfitDraft
      → outfits.service.createOutfit (user-confirmed)
      → optionally update wear_events.outfit_id
  → Outfits list gains one curated row; wear history unchanged
```

---

## 8. Data Model / Schema Impact

### 8.1 Current state (problem)

`public.wear_logs` today:

| Column | Role |
| --- | --- |
| `id` | Row id |
| `item_id` | **Required** — one item per row |
| `worn_on` | Date |
| `outfit_id` | Nullable |
| `occasion_id` | Nullable |
| `notes` / `comfort_rating` | Optional |

There is **no** composition parent, **no** `source`, **no** weather on the log,
**no** sort order across items in a single wear event.

### 8.2 Target product model

**WearLog (event):**

- `id`
- `date` (`worn_on`)
- `occasion_id` nullable
- `weather` / context (nullable JSON or FK to weather snapshot fields — keep
  narrow: season/condition/temp summary)
- `notes` nullable
- `source`: `outfit` \| `ad_hoc` \| `recommendation` \| `trip` \| `ai`
- `outfit_id` nullable
- `combination_key` (deterministic; indexed) for repeat detection
- `created_at`

**WearLogItems:**

- `wear_log_id`
- `item_id`
- `slot` / category text or lookup nullable (optional; can derive from item)
- `sort_order`

### 8.3 Proposed additive schema (illustrative SQL)

Prefer **new tables** to avoid a destructive reshape of `wear_logs`:

```sql
-- RFC-023 — additive only. Do not DROP or rewrite wear_logs in place.

create type public.wear_log_source as enum (
  'outfit',
  'ad_hoc',
  'recommendation',
  'trip',
  'ai'
);

create table public.wear_events (
  id uuid primary key default gen_random_uuid(),
  worn_on date not null,
  occasion_id uuid null references public.occasions (id),
  outfit_id uuid null references public.outfits (id),
  source public.wear_log_source not null default 'ad_hoc',
  notes text null,
  weather jsonb null, -- narrow snapshot { season, condition, temperatureC, ... }
  combination_key text not null,
  created_at timestamptz not null default now()
);

create table public.wear_event_items (
  wear_event_id uuid not null references public.wear_events (id) on delete cascade,
  item_id uuid not null references public.wardrobe_items (id),
  slot text null,
  sort_order int not null default 0,
  primary key (wear_event_id, item_id)
);

create index wear_events_worn_on_idx on public.wear_events (worn_on desc);
create index wear_events_source_idx on public.wear_events (source);
create index wear_events_outfit_id_idx on public.wear_events (outfit_id)
  where outfit_id is not null;
create index wear_events_combination_key_idx on public.wear_events (combination_key);
create index wear_event_items_item_id_idx on public.wear_event_items (item_id);
```

**RLS:** inherit the project’s existing single-tenant / `mvp_anon_*` pattern used
by `wear_logs` and `outfits` (same policies family). Document exact policy names
in the migration PR; no public anonymous write beyond current app access model.

### 8.4 Compatibility strategy (non-destructive)

1. **Do not drop** `wear_logs`.
2. **Backfill (optional, reversible):** for each legacy row, create a
   `wear_events` row (source = `outfit` if `outfit_id` else `ad_hoc`) + one
   `wear_event_items` row. Grouping heuristic for same-day outfit wears:
   group by `(worn_on, outfit_id, coalesce(notes,''), occasion_id)` when
   `outfit_id` is set; otherwise **one event per legacy row** (safe default).
3. **Write path (cutover):** new UI writes `wear_events` + `wear_event_items`.
4. **Analytics readers:** either
   - **A (preferred long-term):** switch Usage Analytics / RecommendationContext
     wear ingestion to read `wear_event_items ⨝ wear_events`, or
   - **B (transition):** dual-write flattened rows into legacy `wear_logs` so
     existing engines need zero change in the first release.

Open Question §14 picks A vs B for v1 implementation.

### 8.5 Rules (persistence)

- Wear log **can exist without** `outfit_id`.
- Saved outfit wear **sets** `outfit_id` + `source='outfit'`.
- Recommendation wear sets `source='recommendation'`; `outfit_id` null unless
  user also saved an outfit in a separate action.
- Trip / AI sources reserved; writers may land in follow-ups.
- Ad-hoc may later set `outfit_id` via promotion.
- Creating a wear log **must** update item usage analytics (via A or B above).
- Creating a wear log **must not** insert into `outfits` / `outfit_items`.

---

## 9. API / Domain Contracts

```ts
type WearLogSource =
  | "outfit"
  | "ad_hoc"
  | "recommendation"
  | "trip"
  | "ai";

interface WearLogItemInput {
  itemId: string;
  slot?: string | null;
  sortOrder?: number;
}

interface CreateWearLogEventInput {
  wornOn: string; // ISO date
  items: WearLogItemInput[]; // length >= 1
  occasionId?: string | null;
  notes?: string | null;
  weather?: Record<string, unknown> | null;
  source: WearLogSource;
  outfitId?: string | null; // required when source === "outfit"
}

interface WearLogEvent {
  id: string;
  wornOn: string;
  occasionId: string | null;
  outfitId: string | null;
  source: WearLogSource;
  notes: string | null;
  weather: Record<string, unknown> | null;
  combinationKey: string;
  items: Array<{
    itemId: string;
    slot: string | null;
    sortOrder: number;
  }>;
  createdAt: string;
}

interface CombinationSuggestion {
  combinationKey: string;
  count: number;
  threshold: number;
  shouldSuggestPromote: boolean;
}

// Domain
function buildCombinationKey(itemIds: readonly string[]): string;
function shouldSuggestOutfitPromotion(
  count: number,
  threshold?: number,
): boolean;
function mapWearLogToOutfitDraft(
  wearLog: WearLogEvent,
): { nameHint: string | null; itemIds: string[] };

// Service
createWearLogEvent(input: CreateWearLogEventInput): Promise<Result<{
  wearLog: WearLogEvent;
  suggestion: CombinationSuggestion;
}>>;
promoteWearLogToOutfit(input: {
  wearLogId: string;
  name: string;
  linkThisLog?: boolean;
}): Promise<Result<{ outfitId: string; wearLog: WearLogEvent }>>;
listWearLogEvents(filters: …): Promise<Result<WearLogEvent[]>>;
getWearLogEvent(id: string): Promise<Result<WearLogEvent>>;
updateWearLogEvent(…): Promise<Result<WearLogEvent>>;
deleteWearLogEvent(id: string): Promise<Result<null>>;
```

Legacy `createWearLog` / `createOutfitWearLogs` remain until callers migrate;
new surfaces must use `createWearLogEvent`.

**Threshold:** default `WEAR_COMBO_PROMOTE_THRESHOLD=3` (env or settings).

---

## 10. Acceptance Criteria

- [x] User can create a wear log **without** a saved outfit (`source=ad_hoc`,
      `outfit_id` null).
- [x] A wear log can contain **multiple** inventory items with stable order.
- [x] Saved outfit **Wear Outfit** still works and sets `source=outfit` +
      `outfit_id`.
- [x] Recommendation can create a wear log directly (`source=recommendation`)
      without requiring a saved outfit.
- [x] Usage analytics count wears from ad-hoc logs (item-level facts updated).
- [x] Repeated identical combinations are detected via deterministic
      `combination_key`.
- [x] After threshold N, UI can suggest “Save as Outfit?” (non-blocking).
- [x] User can promote a wear log to a saved outfit with an explicit name +
      confirm; **no automatic save**.
- [x] Outfits list remains curated — ad-hoc logs never appear as outfits.
- [x] Existing `wear_logs` rows remain readable; migration is **additive** /
      non-destructive.
- [x] Wear Log detail shows items, source, linked outfit (if any), edit +
      promote actions.
- [x] Domain combination matching is deterministic and unit-tested.
- [x] No AI auto-promotion or auto-logging (ADR-005).

---

## 11. QA / Testing Plan

### Unit (Vitest — domain)

- `buildCombinationKey` — order-insensitive; duplicates collapsed; stable.
- `shouldSuggestOutfitPromotion` — below / at / above threshold.
- `mapWearLogToOutfitDraft` — item order preserved; empty rejected.
- Grouping / backfill helpers (if pure) for legacy row → event mapping.

### Service / repository (mocked Supabase)

- Ad-hoc wear log creation (event + items; no outfit insert).
- Saved outfit wear log creation (`outfit_id` + source).
- Recommendation wear log creation.
- Usage analytics update path (dual-write or new reader — assert item counts).
- Repeated combo detection after N inserts.
- Outfit promotion creates outfit + optional link; does not duplicate items
  incorrectly.
- Edit wear log items; delete event cascades items.
- Backward compatibility: list still surfaces legacy-only rows during
  transition (or after backfill).

### Manual / preview

- Quick Log from empty state → Wear Logs list shows one event card with N items.
- Inventory multi-select → log → no new row in Outfits.
- Wear saved outfit → Outfits wear count / link OK.
- Recommendation “Wear this” → history only.
- Hit threshold → suggestion appears → dismiss vs promote.
- Promote → outfit appears once with correct items.

### Must be green before release

- Existing Vitest suite green.
- New RFC-023 domain tests green.
- Migration applied on preview; RLS smoke check.
- `npm test` green before any release tag that includes this work.

---

## 12. Risks & Trade-offs

| Risk | Mitigation |
| --- | --- |
| Dual model confusion (`wear_logs` vs `wear_events`) | Short compatibility window; document cutover; prefer single writer ASAP |
| Backfill over-grouping same-day ad-hoc rows | Default one-event-per-legacy-row; only group when `outfit_id` set |
| Threshold too aggressive / noisy suggestions | Default N=3; dismissible; per-combination “don’t ask again” (stretch) |
| Analytics miss ad-hoc wears | Acceptance criterion + test; dual-write if readers not migrated |
| Users still create outfits out of habit | IA copy: “Log wear” vs “Save outfit”; post-save education |
| Slot/category complexity | Optional `slot` in v1; derive from item category when null |
| Weather jsonb sprawl | Narrow schema; reuse Weather Runtime snapshot fields only |

**Trade-off chosen:** event-centric history + curated outfits over “everything is
an outfit.” Slightly more schema complexity in exchange for daily-use honesty.

---

## 13. Future Extensions

- Trip Planner one-tap “Log as worn” for a day outfit (`source=trip`).
- Vision-assisted “what I’m wearing” → proposed item set → confirm log
  (`source` stays user-confirmed; vision does not auto-write).
- “Don’t suggest this combo again” preference store.
- Link **all** historical events with the same `combination_key` on promote.
- Wear calendar heat map (still not RFC-016 calendar sync).
- Chat tool `logWear` via ADR-007 calling the same service.
- Comfort rating / photos on the event (not just legacy per-item comfort).

---

## 14. Open Questions

1. **Analytics cutover:** ~~dual-write vs reader switch~~ → **Resolved: dual-write
   to legacy `wear_logs` for v1** so Usage / ROI / Recommendation / Personalization
   readers need no change.
2. **Table naming:** ~~collision with `wear_logs`~~ → **Resolved: `wear_events` /
   `wear_event_items`** (product copy: Wear Log / Wear Log Items).
3. **Promotion threshold default:** ~~3 vs 2~~ → **Resolved: 3** (`DEFAULT_PROMOTE_THRESHOLD`).
4. **Backfill grouping:** deferred (optional migration helper); safe default remains
   one-event-per-legacy-row for ad-hoc orphans.
5. **Edit semantics:** ~~allow changing `worn_on`?~~ → **Resolved: yes** on detail.
6. **Recommendation path:** ~~always `recommendation`?~~ → **Resolved:** unlinked →
   `recommendation`; linked saved outfit id → `outfit` path from recommendations.
7. **Suggestions for `source=outfit`?** → **Resolved: no** (`alreadyCurated`).

---

## Appendix A — Combination key (normative sketch)

```
uniqueSortedIds = sort(unique(itemIds))
combinationKey = sha256(uniqueSortedIds.join("|")).slice(0, 32)
```

Empty item set is invalid. Single-item wears are valid ad-hoc logs (still no
outfit required). Suggestions may optionally require `uniqueSortedIds.length >= 2`
so single-item habits do not spam “Save as Outfit?” — **default: suggest only
when ≥2 items** (Open Question if product wants otherwise).

---

## Appendix B — Modules to touch (implementation later — not this Draft)

| Area | Likely touch |
| --- | --- |
| Domain | `src/domain/wear-logs/**` (new) |
| Feature | `src/features/wear-logs/**`, inventory multi-select CTA, recommendation wear CTA, outfits wear dialog source tagging |
| Schema | `docs/migrations/RFC-023-*.sql` + `types/database.ts` |
| Analytics | `analytics.repository` / usage engine inputs |
| Docs | `ARCHITECTURE.md`, `ENGINE.md` (wear facts), `CHANGELOG` on release |
| Tests | domain combination + service promotion + backfill helpers |

**This RFC is documentation-only at authoring time** — no application code or
live schema changes ship with Draft publication.
