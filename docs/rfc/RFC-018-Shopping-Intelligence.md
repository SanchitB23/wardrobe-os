# RFC-018: Shopping Intelligence

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Claude (Opus 4.8)
Target Release: v2.1.0
Epic: Shopping
Priority: Critical
Effort: XL
Dependencies:
- RFC-001 Acquisition Engine / Buy vs Skip (`src/domain/acquisition`) — the per-item decider Shopping Intelligence aggregates; already produces `BuyVsSkipAnalysis` (`decision`, `score`, `wardrobeImpactScore`, `similarExistingItems`, `estimatedCostPerWear`, dimension breakdown incl. `duplicateRisk` / `gapFillValue`)
- RFC-003 Shopping Screenshot Understanding (`interpretShoppingImage` → `ProspectiveItemCandidate`) — one way a wishlist item is captured (screenshot → candidate)
- RFC-017 Trip Planner (`src/features/trips`) — the precedent for a persisted, user-authored entity; trips can anchor a shopping list (future)
- RFC-005 Intelligence Orchestrator (`src/domain/orchestrator`) — how Shopping Intelligence requests acquisition/recommendation/health, never calling engines directly
- RFC-004/013 Personalization (`src/domain/personalization`) — taste feeds each item's Buy Score via acquisition
- RFC-012 Recommendation Engine v2 — outfit potential feeds each item's Impact Score via acquisition
- RFC-015 Intelligence Center (`src/domain/intelligence`) — precedent: *engines decide, the aggregator ranks, AI explains*; a future consumer of `buy` actions
- ADR-002 (RecommendationContext), ADR-005 (AI does not decide), ADR-006 (caching), ADR-008 (release/versioning)

> **v2.1 flagship.** Turns the single-purchase evaluator (RFC-001) into a
> continuous **shopping intelligence system** — a persisted wishlist, a
> deterministic priority queue, wardrobe ROI, duplicate intelligence, and a
> shopping timeline. **Acquisition decides each item; Shopping Intelligence ranks
> and aggregates; AI explains** (ADR-005). Budgeting, price tracking, and
> marketplace integrations are explicit non-goals.

---

## Shopping Intelligence Philosophy

The same separation as the Intelligence Center (RFC-015), applied to buying:

- **Acquisition decides.** Each prospective item's buy/skip verdict, buy score,
  wardrobe impact, and cost-per-wear come from the **Buy vs Skip engine**
  (RFC-001), unchanged. Shopping Intelligence never re-decides a purchase.
- **Shopping Intelligence ranks + aggregates.** Over a *wishlist* of many items
  it composes each item's acquisition analysis (through the Orchestrator) into a
  deterministic **priority queue**, **ROI**, and **duplicate** views. The one new
  deterministic step it owns is *ordering the queue* — not deciding any item.
- **AI explains.** It narrates the dashboard, the ranking, and the ROI; it never
  scores, ranks, or decides.

So: **Wishlist (data) → Shopping Intelligence (rank/aggregate) → Acquisition
(decide, per item) → Recommendation / Personalization (via the Orchestrator) →
Shopping Insights.** The wishlist and purchase history are persisted data; every
score and view is a pure, recomputed function of them + the wardrobe.

## 1. Problem Statement

Wardrobe OS can evaluate **one** purchase well. Buy vs Skip (RFC-001) turns a
prospective item into a `BuyVsSkipAnalysis` — a buy/consider/skip verdict with a
score, wardrobe-impact score, duplicate check, cost-per-wear, and explainable
dimensions — and the Screenshot flow (RFC-003) captures an item from an image.
But shopping is **not a series of isolated evaluations**; it is a *continuous
process*:

- **There is no wishlist.** Items you're considering aren't saved. You can
  evaluate a jacket today, but nothing remembers it, tracks it against the ones
  you evaluated last week, or tells you which to buy first.
- **No prioritization.** Given ten things you might buy, the system can't say
  *which matters most* — there's no priority queue that weighs how badly each
  fills a gap (**Need**), how much it improves the wardrobe (**Impact**), and how
  strong its verdict is (**Buy**).
- **No wardrobe ROI.** Spend and utilization aren't connected. There's no view of
  realized cost-per-wear across what you've bought, or projected ROI for what you
  might buy — so "am I buying well?" is unanswerable.
- **Duplicate checks are per-item only.** Buy vs Skip flags items similar to what
  you *own*, but nothing detects duplication *across the wishlist itself* (two
  near-identical candidates) or clusters it into a picture.
- **No shopping timeline / strategy.** There's no history of purchases over time,
  no forward plan of what to buy next, and no sequencing guidance.

We need **Shopping Intelligence**: a persisted wishlist, a deterministic
purchase-priority queue, wardrobe ROI, duplicate intelligence, and a shopping
timeline — a continuous system that composes the existing Acquisition,
Recommendation, and Personalization engines (through the Orchestrator) and
explains the result. Every decision stays with Acquisition; Shopping Intelligence
only ranks and aggregates.

## 2. Goals

- **Wishlist Intelligence** — persist prospective items (from manual entry, a
  URL, or a screenshot via RFC-003) as first-class, editable data with insights.
- **Purchase Prioritization** — a deterministic **priority queue** over the
  wishlist, ordered by a composite of **Need Score**, **Impact Score**, and **Buy
  Score** (each sourced from a deterministic engine).
- **Wardrobe ROI** — realized cost-per-wear across purchase history and projected
  cost-per-wear for wishlist items; an aggregate "are you buying well?" signal.
- **Shopping Strategy** — sequencing / what-to-buy-next guidance derived from the
  queue + wardrobe gaps (deterministic; AI narrates it).
- **Duplicate Intelligence** — duplicate/near-duplicate detection *across the
  wishlist and against the wardrobe*, clustered into a `DuplicateAnalysis`.
- **Shopping Timeline** — purchase history over time + the forward priority queue
  as a plan.
- **Keep it deterministic.** Every score/view is a pure function of the wishlist +
  purchases + wardrobe; **Acquisition decides** each item, AI only explains.

## 3. Non-Goals

Explicitly **out of scope** (verbatim from the brief, plus guardrails):

- **Price tracking** · **Browser extension** · **OCR** · **Coupons** ·
  **Budgeting** · **Marketplace integrations** — Shopping Intelligence plans
  *what to buy and why*, not price surveillance, scraping, deal-hunting, or spend
  limits. (Budgeting and the browser extension are already **Rejected** in
  [FUTURE.md](../product/FUTURE.md); cost-per-wear + Wardrobe ROI give the money
  signal without a budgeting tool. OCR/screenshot capture is provided by RFC-003;
  this RFC only *consumes* its `ProspectiveItemCandidate`.)
- **A new decision engine.** Buy vs Skip (RFC-001) remains the sole purchase
  decider; this RFC adds ranking + aggregation + persistence, not new verdicts.
- **AI shopping decisions.** AI narrates the dashboard; it never ranks, scores, or
  decides what to buy (ADR-005).
- **Automated purchasing / checkout.** No buying on the user's behalf.

## 4. User Stories

- As the owner, I save items I'm considering to a **wishlist** and come back to it.
- As the owner, I see a **priority queue** telling me which wishlist item to buy
  first — and *why* (fills a real gap, high impact, strong verdict).
- As the owner, I capture an item from a **screenshot** (RFC-003) straight into
  the wishlist.
- As the owner, I see my **wardrobe ROI** — realized cost-per-wear on what I've
  bought and projected cost-per-wear on what I'm considering.
- As the owner, I'm warned when two wishlist items are **near-duplicates** of each
  other or of something I own.
- As the owner, I see a **shopping timeline**: what I've bought over time and what
  I plan to buy next.
- As a developer, each wishlist item's verdict comes from the same Buy vs Skip
  engine, so rankings are reproducible and testable.

## 5. UX Flow

Primary surface: **Shopping** (candidate routes **`/shopping`** dashboard,
**`/shopping/wishlist`**, **`/shopping/roi`**; the existing
`/acquisition/advisor` + `/acquisition/screenshot` remain the per-item entry
points and "add to wishlist" hooks).

1. **Shopping dashboard (`/shopping`)** — the `ShoppingDashboard`: the priority
   queue (top items to buy next), an ROI summary, duplicate warnings, and recent
   purchases. Lead with **what to buy next**, not analytics (RFC-015 house style).
2. **Wishlist (`/shopping/wishlist`)** — the persisted list; each row shows the
   item, its **Need / Impact / Buy** scores, its acquisition **verdict**, and
   duplicate flags. Add via manual entry, URL, or screenshot; edit; mark
   **purchased** (moves it into purchase history) or **dismissed**.
3. **Item detail** — the full `BuyVsSkipAnalysis` (reusing the RFC-001 result UI)
   plus its priority rationale and duplicates.
4. **ROI (`/shopping/roi`)** — realized cost-per-wear across purchases, projected
   cost-per-wear for the queue, and the aggregate wardrobe-ROI signal.
5. **Explain** — optional AI narration of the dashboard / queue / ROI.

States: **empty** (no wishlist → prompt to add or evaluate), **ranked**,
**duplicate-warning**, and **purchased** (history). Ranking + ROI run server-side
on demand and are cached (ADR-006), recomputed when the wishlist, purchases, or
wardrobe change.

## 6. Architecture

Shopping Intelligence is a **feature + a thin pure aggregation domain** over the
unchanged Acquisition engine — mirroring how the Intelligence Center (RFC-015)
aggregates without deciding.

```
Wishlist (persisted: prospective items + status)
        ↓  Shopping Intelligence service (CRUD · rank · ROI · dedupe)
        ↓  per item, through the Orchestrator (RFC-005):
        └─ acquisition (RFC-001) → BuyVsSkipAnalysis
               ↳ internally composes recommendation (RFC-012) + personalization
                 (RFC-004/013) + wardrobe health
        ↓  pure aggregation (src/domain/shopping):
        ├─ Need Score   ← wardrobe gap severity (health capability)
        ├─ Impact Score ← BuyVsSkipAnalysis.wardrobeImpactScore
        ├─ Buy Score    ← BuyVsSkipAnalysis.score
        ├─ Priority     = deterministic weighted combine(Need, Impact, Buy)
        ├─ ROI          ← purchases + wear logs (realized) + estimatedCostPerWear (projected)
        └─ Duplicates   ← similarExistingItems + cross-wishlist overlap
        ↓
ShoppingDashboard · ShoppingPriority · ShoppingROI · DuplicateAnalysis · WishlistInsights
        ↓
[optional] AI explanation (RFC-014 Explanation) — narrates, never ranks/decides
```

### Domain Layer
- **Acquisition (RFC-001) — unchanged.** `evaluateBuyVsSkip(input, options) →
  BuyVsSkipAnalysis`, pure, `generatedAt` injected. Shopping Intelligence calls it
  once per wishlist item (via the Orchestrator).
- **Shopping aggregation (`src/domain/shopping`, pure, new):**
  - `computeNeedScore(item, health)` → 0–100 (how badly a real gap is filled).
  - `priorityScore({ need, impact, buy }, weights)` → 0–100 + reason codes
    (the one new deterministic ranking; tunable weights like RFC-012).
  - `rankWishlist(entries)` → ordered `ShoppingPriority` (deterministic tie-breaks).
  - `analyzeDuplicates(wishlist, wardrobe)` → `DuplicateAnalysis` clusters (reusing
    the acquisition `similarExistingItems` overlap + cross-wishlist comparison).
  - `computeShoppingROI(purchases, wearLogs, queue)` → `ShoppingROI`.
  - All deterministic; no I/O, no scoring of *whether to buy* (that's Acquisition).

### Service Layer
- `src/features/shopping/services/shopping.service.ts` — wishlist CRUD, and
  `getShoppingDashboard()` which loads the wishlist + purchases + wardrobe, runs
  Buy vs Skip per active item (through the Orchestrator, cached per item
  fingerprint), then the pure aggregation, returning `{ data, error }`.

### Repository Layer
- `src/features/shopping/repositories/shopping.repository.ts` — the only code
  touching the new `wishlist_items` table (§8); reads the existing `purchases`,
  `wear_logs`, and wardrobe tables for ROI + duplicates.

### UI Layer
- `src/features/shopping` — dashboard, wishlist, item detail (reusing the RFC-001
  Buy vs Skip result components), ROI, timeline; nav entry under Stylist/Shopping.

### AI Layer
- Optional narration via the RFC-014 **Explanation** capability, fed the computed
  dashboard/priority/ROI. **AI never ranks or decides** (ADR-005).

## 7. Data Flow

```
UI → shoppingService.getShoppingDashboard()                          { data, error }
  → repository: load wishlist_items (active) + purchases + wear logs + wardrobe
  → per active wishlist item, via Orchestrator: acquisition (RFC-001)
        → BuyVsSkipAnalysis { decision, score, wardrobeImpactScore,
                              estimatedCostPerWear, similarExistingItems, … }   [cached]
  → pure aggregation (src/domain/shopping):
        · Need   = computeNeedScore(item, health)
        · Impact = analysis.wardrobeImpactScore
        · Buy    = analysis.score
        · Priority = priorityScore({need, impact, buy}, WEIGHTS) → rankWishlist(...)
        · ROI      = computeShoppingROI(purchases, wearLogs, queue)
        · Dupes    = analyzeDuplicates(wishlist, wardrobe)
  → ShoppingDashboard { priority[], roi, duplicates, timeline, wishlistInsights }
  → [optional] AI explanation (no recompute, no ranking)

UI → add / edit / purchase / dismiss wishlist item → shoppingService.* → repository
```

Same wishlist + purchases + wardrobe + `generatedAt` ⇒ identical scores and
ranking. The wishlist and purchase status are the only new mutable persisted
state; the dashboard is recomputed, never stored.

## 8. Data Model / Schema Impact

**New, additive table** — the wishlist becomes persisted data (like trips in
RFC-017). Purchases already persist (`purchases`); wear logs + wardrobe already
exist. The derived dashboard/scores are **not** stored (recomputed on demand).
Anon RLS consistent with the app's `mvp_anon_*` convention. SQL illustrative;
finalised + called out in the implementing PR. **No migration is applied in this
RFC.**

```sql
-- A prospective purchase the owner is considering.
create table if not exists wishlist_items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text,
  subcategory   text,
  color         text,
  formality     text,
  price         numeric,
  image_url     text,
  source        text not null default 'manual',   -- manual | url | image
  source_url    text,
  notes         text,
  status        text not null default 'active',    -- active | purchased | dismissed
  purchased_id  uuid,                               -- FK-by-convention to purchases(id) once bought
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists wishlist_items_status_idx on wishlist_items (status);
```

**RLS:** a single `mvp_anon_all_wishlist_items` anon policy (SELECT/INSERT/UPDATE/
DELETE), mirroring `ai_cache` / `preference_overrides` / the RFC-017 trip tables.
No change to existing tables — marking an item *purchased* writes a normal row to
the existing `purchases` table and sets `wishlist_items.status`/`purchased_id`.

## 9. API / Domain Contracts

Illustrative; reuses the RFC-001 `ProspectiveItem` / `BuyVsSkipAnalysis` verbatim.

```ts
// Persisted wishlist entry (feature type; maps to wishlist_items).
export interface WishlistItem {
  id: string;
  item: ProspectiveItem;             // RFC-001 shape (name/category/color/formality/price…)
  source: BuyVsSkipInputSource;      // manual | url | image (RFC-001)
  sourceUrl: string | null;
  imageUrl: string | null;
  notes: string | null;
  status: "active" | "purchased" | "dismissed";
  purchasedId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Scores (all 0–100). Buy + Impact come straight from acquisition; Need is derived
// from wardrobe gaps; Priority is the one new deterministic combination.
export interface ShoppingScores {
  need: number;
  impact: number;   // = BuyVsSkipAnalysis.wardrobeImpactScore
  buy: number;      // = BuyVsSkipAnalysis.score
  priority: number;
  reasonCodes: string[];
}

// One ranked wishlist entry = the item + its acquisition verdict + scores.
export interface ShoppingRecommendation {
  wishlistItem: WishlistItem;
  analysis: BuyVsSkipAnalysis;       // RFC-001 — the decision lives here
  scores: ShoppingScores;
}

export type ShoppingPriority = ShoppingRecommendation[];  // priority-desc, deterministic ties

export interface ShoppingROI {
  /** Realized: from purchases + wear logs. */
  realized: { itemId: string; name: string; costPerWear: number | null; wears: number }[];
  /** Projected: from BuyVsSkipAnalysis.estimatedCostPerWear per queued item. */
  projected: { wishlistId: string; name: string; estimatedCostPerWear: number | null }[];
  /** Aggregate wardrobe-ROI signal (0–100) — spend vs utilization. */
  wardrobeRoiScore: number;
}

export interface DuplicateCluster {
  reason: string;
  members: { kind: "wardrobe" | "wishlist"; id: string; name: string }[];
  /** 0–1 max pairwise overlap in the cluster. */
  overlap: number;
}
export interface DuplicateAnalysis { clusters: DuplicateCluster[]; wishlistDuplicateCount: number; }

export interface WishlistInsights { summary: string; topReasons: string[]; }

export interface ShoppingDashboard {
  priority: ShoppingPriority;
  roi: ShoppingROI;
  duplicates: DuplicateAnalysis;
  timeline: { date: string; kind: "purchased" | "planned"; name: string }[];
  wishlistInsights: WishlistInsights;
}

// Pure domain (src/domain/shopping):
export function computeNeedScore(item: ProspectiveItem, health: WardrobeHealth): number;
export function priorityScore(s: { need: number; impact: number; buy: number }, w?: PriorityWeights): { score: number; reasonCodes: string[] };
export function rankWishlist(entries: ShoppingRecommendation[]): ShoppingPriority;
export function analyzeDuplicates(wishlist: WishlistItem[], wardrobe: StyleDNAItem[]): DuplicateAnalysis;
export function computeShoppingROI(purchases: PurchaseRecord[], wearLogs: WearEvent[], queue: ShoppingRecommendation[]): ShoppingROI;

// Service (feature layer):
export function listWishlist(): Promise<Result<WishlistItem[]>>;
export function addWishlistItem(input: Partial<WishlistItem>): Promise<Result<WishlistItem>>;
export function updateWishlistItem(id: string, patch: Partial<WishlistItem>): Promise<Result<WishlistItem>>;
export function markPurchased(id: string, purchase: { price: number; date: string }): Promise<Result<void>>;
export function dismissWishlistItem(id: string): Promise<Result<void>>;
export function getShoppingDashboard(): Promise<Result<ShoppingDashboard>>;
```

## 10. Acceptance Criteria

Spec-level (this RFC defines all of the below — it does):

- [ ] Persisted **Wishlist** (CRUD + status) and the additive schema (§8), documented
      not applied, with RLS implications.
- [ ] **Purchase Prioritization** — a deterministic priority queue from Need ×
      Impact × Buy, with reason codes; Acquisition (not this layer) decides each item.
- [ ] **Wardrobe ROI** — realized (purchases + wears) + projected (cost-per-wear)
      + an aggregate signal.
- [ ] **Duplicate Intelligence** — clusters across wishlist + wardrobe.
- [ ] **Shopping Timeline** — purchase history + forward queue.
- [ ] Outputs: `ShoppingDashboard`, `ShoppingRecommendation`, `ShoppingPriority`,
      `ShoppingROI`, `DuplicateAnalysis`, `WishlistInsights`.
- [ ] Rules honoured: deterministic; AI explains; **Acquisition decides**;
      acquisition/recommendation reached **through the Orchestrator**.
- [ ] Non-goals (price tracking, browser extension, OCR, coupons, budgeting,
      marketplace integrations).
- [ ] Testing plan, risks, future extensions.

Implementation-time acceptance criteria (tracked in that PR):
- [ ] **Wishlist ranking** — the queue orders by priority deterministically.
- [ ] **Priority score** — `priorityScore` combines Need/Impact/Buy with reason codes.
- [ ] **ROI** — realized + projected cost-per-wear compute correctly.
- [ ] **Duplicate analysis** — near-duplicates across wishlist + wardrobe cluster.
- [ ] **Wardrobe impact** — each entry surfaces `wardrobeImpactScore` from acquisition.

## 11. QA / Testing Plan

- **Unit tests (Vitest, pure):**
  - `priorityScore` — monotonic in Need/Impact/Buy; weights change order predictably;
    emits reason codes; deterministic ties.
  - `rankWishlist` — stable, priority-desc ordering.
  - `computeNeedScore` — higher for items filling severe gaps, ~0 for saturated categories.
  - `analyzeDuplicates` — clusters two near-identical wishlist items and a
    wishlist↔wardrobe overlap; ignores unrelated items.
  - `computeShoppingROI` — realized cost-per-wear = price / wears; projected from
    `estimatedCostPerWear`; aggregate signal within 0–100.
  - Determinism: same inputs + `generatedAt` ⇒ identical dashboard.
- **Service/repository (at implementation):** wishlist CRUD + status transitions;
  `markPurchased` writes `purchases` and flips status; `getShoppingDashboard`
  assembles inputs and returns `{ data, error }`.
- **Integration guard:** acquisition/recommendation reached **through the
  Orchestrator** (RFC-005), never directly.
- **Decision guard:** Shopping Intelligence never produces a buy/skip verdict of
  its own — every verdict traces to a `BuyVsSkipAnalysis`.
- **AI guard:** removing AI leaves the dashboard + ranking unchanged.
- **RLS audit:** `wishlist_items` exposes exactly the anon policies the feature needs.
- **Release gate:** `npm test`, `npm run lint`, `npm run build` green (ADR-008).

## 12. Risks & Trade-offs

- **Fan-out cost.** Ranking N wishlist items runs Buy vs Skip N times.
  *Mitigation:* cache each item's analysis per fingerprint (ADR-006); recompute
  only changed items; the pure aggregation is cheap.
- **Double-counting the decision.** A priority score could be mistaken for a
  verdict. *Mitigation:* priority *orders* the queue; the verdict is always the
  item's `BuyVsSkipAnalysis.decision`, shown alongside — never overridden.
- **ROI needs history.** Realized ROI is thin until purchases + wears accrue.
  *Mitigation:* show projected cost-per-wear meanwhile; label realized vs projected.
- **Duplicate false positives.** Overlap heuristics may over-cluster.
  *Mitigation:* reuse the tuned acquisition `similarExistingItems` overlap; show
  overlap scores; cluster only above a threshold.
- **Scope creep toward commerce.** Prices, coupons, checkout are tempting.
  *Mitigation:* hard non-goals — plan *what/why*, never price or purchase.

## 13. Future Extensions

- **Trip-anchored shopping (RFC-017)** — a wishlist scoped to an upcoming trip,
  feeding the trip's "shopping before the trip" list.
- **Intelligence Center `buy` actions (RFC-015)** — surface the top priority item
  as a prioritised action on Today.
- **Gap-driven auto-wishlist** — propose wishlist items from wardrobe gaps.
- **Wishlist from Screenshot batch** — capture several items at once (RFC-003).
- **Realized-vs-predicted learning** — compare projected vs actual cost-per-wear to
  sharpen future ROI (still deterministic; no ML).

## 14. Open Questions

1. **Route/IA** — a new `/shopping` group, or fold under the existing Stylist
   "Acquisition" area? How do Advisor/Screenshot relate to the wishlist?
2. **Priority weights** — fixed constants, personalization-tuned, or user-adjustable
   (like RFC-012 weights)? Defaults for Need/Impact/Buy?
3. **Wishlist capture** — do URL and image sources auto-run Buy vs Skip on add, or
   lazily at dashboard time?
4. **Purchase linkage** — does `markPurchased` create the `purchases` row here, or
   defer to the existing purchases flow and just link?
5. **Duplicate scope** — wishlist-vs-wishlist only, wishlist-vs-wardrobe only, or
   both (this RFC assumes both)?
6. **ROI aggregate** — what exactly is `wardrobeRoiScore` (utilization-weighted
   spend? cost-per-wear distribution percentile?)?
7. **Caching key** — per-item analysis cache vs whole-dashboard cache; how does a
   wardrobe change (new item, wear) invalidate downstream ROI/priority?
