# RFC-018C: Acquisition-to-Inventory Pipeline

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Cursor (Grok)
Target Release: v2.0.x
Epic: Acquisitions
Priority: Critical
Effort: L
Dependencies:
- RFC-001 Acquisition Engine / Buy vs Skip — per-item verdict; `ProspectiveItem` / `BuyVsSkipAnalysis`; silent `acquisition_decisions` snapshots
- RFC-003 Shopping Screenshot Understanding — image → `ProspectiveItemCandidate` → Buy vs Skip; product image preview (today ephemeral)
- RFC-018 Shopping Intelligence — `wishlist_items` persistence (`source`, `status`, `purchased_id`, `image_url`); mark-purchased status flip; Shopping dashboard
- RFC-018B Acquisitions Intelligence — Purchase Lifecycle / Accuracy / Opportunity consumers; must gain reliable FK links instead of name-matching only
- RFC-020 Inventory Image Intelligence — post-create optional Visual StyleDNA Analyze → Accept / Reject (manual wins)
- Existing inventory + purchases — `createWardrobeItem`, `uploadPrimaryItemImage`, `createPurchase` (`purchases.item_id` → `wardrobe_items`)
- ADR-005 (AI does not decide), ADR-007 (tool calling), ADR-008 (release/versioning)

> **Letter-suffix evolution of RFC-018 / RFC-018B** (same pattern as RFC-014B).
> Shopping Intelligence persists and ranks the wishlist. Acquisitions Intelligence
> learns from outcomes. **RFC-018C connects the lifecycle end-to-end**: analysis →
> wishlist → purchased → confirmed inventory → image → optional visual StyleDNA →
> ROI / timeline / history. It does **not** replace RFC-001 / 003 / 018 / 018B /
> 020. Engines still decide; AI still explains; the user still confirms inventory.

> **Grounding note (current product):** Buy vs Skip and Screenshot save
> decisions but offer no pipeline CTAs. Wishlist “Purchased” flips `status` only
> (`purchased_id` never written). Purchases require an existing wardrobe item.
> There is no convert-to-inventory wizard and no image carry-forward from
> screenshot preview into `item_images`. Timeline / accuracy largely name-match.

---

## Acquisition-to-Inventory Philosophy

- **Never auto-add to inventory.** Every wardrobe item requires an explicit review
  and confirmation step.
- **Manual edits win.** Prefill from prospective item / vision / wishlist; the
  user corrects before create.
- **Decision history is immutable.** Linking a decision to a wishlist item is
  additive metadata; verdict snapshots are not rewritten.
- **Wishlist and purchase lifecycle are linked** via durable IDs (`wishlist_item_id`,
  `purchased_id`, inventory FK) — not name matching alone.
- **Product image carries forward when possible** — candidate only; user confirms
  before attach as primary.
- **AI explains only** — never creates inventory, never marks purchased, never
  accepts visual attributes (ADR-005).

Canonical flow:

```
Shopping Screenshot / Manual Product
  → Buy/Skip Analysis
  → Add to Wishlist
  → Mark Purchased
  → Review Final Item Details
  → Create Inventory Item
  → Attach Image (confirm)
  → Optional Visual StyleDNA Analysis (RFC-020)
  → ROI / Timeline / History
```

---

## 1. Problem Statement

Wardrobe OS can analyze products, manage wishlist items, track acquisition
decisions, and create inventory items — but these workflows are **not connected
end-to-end**.

Today two islands exist:

```
Shopping Screenshot → Buy/Skip Analysis → Decision History
```

and

```
Inventory Create → Image Upload → Visual StyleDNA (RFC-020)
```

Missing handoffs:

| Gap | Pain |
| --- | --- |
| Buy/Skip verdict → Wishlist | Verdict is saved as history; nothing durable for “I’m still considering this” |
| Wishlist → Purchased | Status flip only; no purchase row / price / date link |
| Purchased → Inventory | No prefill wizard; user re-enters everything in Inventory |
| Screenshot → Inventory image | Preview is ephemeral; `wishlist_items.image_url` unused |
| Purchase → ROI | Purchases only exist after manual inventory + purchase form |
| Timeline accuracy | Stages rely on name matching; `wishlist_item_id` / `purchased_id` unused |

The owner feels this as retyping, lost screenshots, “Purchased” wishlist rows that
never appear in ROI, and Recent Decisions that are read-only archaeology.

Why now: RFC-018 / 018B / 020 are implemented. The missing product surface is the
**pipeline glue** — confirmation-gated handoffs, not new scoring engines.

## 2. Goals

Create a complete acquisition lifecycle from product analysis to inventory
creation:

1. **Actionable Buy/Skip result** — CTAs: Add to Wishlist, Mark Purchased, Create
   Inventory Item (always confirmation-gated for inventory).
2. **Wishlist handoff** — persist prospective item; link
   `acquisition_decisions.wishlist_item_id`; preserve `source`: `manual` \|
   `image` \| `url`.
3. **Purchase bridge** — mark wishlist purchased; create/link `purchases`;
   preserve price/date; set `wishlist_items.purchased_id`.
4. **Inventory conversion wizard** — launch from purchased wishlist (and from
   result CTAs via the same wizard); prefill; review; confirm; prevent accidental
   duplicates.
5. **Image carry-forward** — screenshot/product image becomes a candidate
   inventory primary image; attach only after user confirm.
6. **Visual StyleDNA handoff** — after create, offer Analyze Visual StyleDNA
   (RFC-020); never auto-accept.
7. **Recent Decisions UI** — polished, filterable, actionable cards with
   lifecycle status and source.
8. **Acquisition timeline accuracy** — stages:
   Wishlist → Analysis → Purchased → Inventory Created → First Wear → ROI,
   driven by durable links where possible.

## 3. Non-Goals

Explicitly **out of scope**:

- Price tracking / deal alerts
- Marketplace integration
- Browser extension
- OCR (labels, receipts, price tags)
- **Auto inventory creation** (no silent wardrobe writes)
- Auto purchase detection (bank / email / card)
- Auto visual attribute acceptance (RFC-020 Accept remains required)
- Replacing Buy vs Skip, Shopping Intelligence ranking, or RFC-018B learning math
- New decision scores or AI-ranked conversion

## 4. User Stories

- As the owner, after a Buy/Consider/Skip verdict I can **Add to Wishlist** so the
  item survives beyond the session and stays linked to that decision.
- As the owner, I can **Mark Purchased** with price and date without inventing an
  inventory row yet — then convert when ready.
- As the owner, from a purchased wishlist item I run a **conversion wizard** that
  pre-fills inventory fields from the prospective item / vision / wishlist, lets
  me edit everything, and only creates the wardrobe item when I confirm.
- As the owner, my shopping screenshot can become the inventory photo **after I
  confirm**, so I do not re-upload.
- As the owner, after create I am offered **Analyze Visual StyleDNA** (RFC-020)
  and still Accept / Reject myself.
- As the owner, Recent Decisions show source (manual/image), linked wishlist,
  lifecycle status, and next actions — not only a JSON dump.
- As the owner, the acquisitions timeline shows Inventory Created as its own
  stage and stops relying solely on name matching for linked subjects.
- As a developer, handoffs are covered by Vitest (domain/service contracts) so
  duplicate inventory creation and broken FK links fail tests.

## 5. UX Flow

### 5.1 Entry points

| Surface | Role |
| --- | --- |
| `/acquisition/advisor` | Manual ProspectiveItem → Buy vs Skip → pipeline CTAs |
| `/acquisition/screenshot` | Image → candidate → Buy vs Skip → pipeline CTAs (+ durable image candidate) |
| `BuyVsSkipResult` | Shared result card gains action strip (§5.2) |
| `/acquisitions` / `/acquisitions/decisions` | Recent Decisions → actionable cards (§5.6) |
| `/acquisitions/wishlist` | Mark Purchased; Convert to Inventory |
| `/acquisitions/timeline` | Extended stages including Inventory Created |
| Inventory item detail | Existing RFC-020 Visual Analysis after handoff |

### 5.2 BuyVsSkipResult CTAs

After a successful analysis, show (context-aware enablement):

| CTA | Behaviour |
| --- | --- |
| **Add to Wishlist** | Create (or reuse) active wishlist row from prospective item; set `source`; persist image candidate when present; link decision `wishlist_item_id`; toast + link to wishlist item |
| **Mark Purchased** | Ensure wishlist row exists (create if needed) → capture purchase price/date (dialog) → set `status = purchased` → do **not** create inventory |
| **Create Inventory Item** | Ensure wishlist exists → open **Inventory Conversion Wizard** (prefer marking purchased first or within wizard); never skip review |

Disable / replace with deep links when already linked:

- Already on wishlist → “View Wishlist Item”
- Already purchased → “Convert to Inventory” / “View Inventory” if converted
- Already converted → “View Inventory Item” (no second create)

### 5.3 Wishlist handoff

1. Map `ProspectiveItem` (+ optional analysis summary) → `SaveWishlistInput`.
2. `source` must be recorded correctly:
   - Advisor manual form → `manual`
   - Screenshot flow → `image`
   - URL-originated entry (when present) → `url`
3. If a decision id is known, update/link `acquisition_decisions.wishlist_item_id`
   (additive; do not mutate `analysis` jsonb).
4. Idempotency: if this decision already has `wishlist_item_id`, do not create a
   second wishlist row — navigate to the linked item.

### 5.4 Purchase bridge

1. From wishlist or Mark Purchased CTA: dialog for **purchase price** (default
   prospective `estimatedPrice`) and **purchase date** (default today).
2. Set `wishlist_items.status = 'purchased'`.
3. Persist purchase intent fields on the wishlist row until inventory exists
   (see §8) — **do not** invent a `purchases` row without `item_id` (current
   schema requires inventory FK).
4. When inventory conversion completes, create `purchases` with
   `item_id` + price/date/source and set `wishlist_items.purchased_id`.

### 5.5 Inventory Conversion Wizard

Multi-step, confirmation-gated:

1. **Launch** from purchased wishlist item (primary) or Create Inventory CTA
   (secondary; wizard may set purchased + capture price/date if missing).
2. **Prefill** inventory form fields from wishlist / `ProspectiveItem` /
   last linked `BuyVsSkipAnalysis` / `VisionAnalysis` candidate (category
   free-text → category lookup best-effort; user must confirm FK fields).
3. **Image step** — if candidate image exists, show thumbnail: Attach as primary
   / Skip. Default unchecked or explicit Confirm (never silent attach).
4. **Review screen** — final summary of fields + image choice + purchase
   price/date; require **Confirm create**.
5. **Create** — `createWardrobeItem` → optional `uploadPrimaryItemImage` /
   attach from stored candidate → `createPurchase` → set `purchased_id` +
   `inventory_item_id` on wishlist → success state with links.
6. **Duplicate guard** — if wishlist already has `inventory_item_id` or an
   in-flight conversion token, block second create and deep-link to existing item.
7. **Post-create offer** — “Analyze Visual StyleDNA” → RFC-020 item detail flow
   (pending → Accept/Reject). Optional; skip allowed.

States: prefill / edit → image confirm → review → creating → success / error.

### 5.6 Recent Decisions UI

Replace thin name+badge / raw JSON-first UX with actionable cards:

**Card fields:** item name, verdict + score, source (`manual` / `image` / `url`),
linked wishlist (if any), lifecycle status (derived), created time.

**Actions (contextual):**

- Add to Wishlist
- View Wishlist Item
- Mark Purchased
- Convert to Inventory
- View Inventory (when linked)

**Filters:**

- Verdict: Buy / Consider / Skip
- Source: Manual / Image (/ URL if used)
- Linkage: Linked / Unlinked
- Sort / chips: Recent / High Score

Keep expandable analysis detail for power users; do not make JSON the primary UI.

### 5.7 Timeline

Extend hub timeline stages to:

```
Wishlist → Analysis → Purchased → Inventory Created → First Wear → ROI
```

Resolution preference (deterministic):

1. Linked inventory + wears / CPW → First Wear / ROI
2. Linked `inventory_item_id` → Inventory Created
3. Wishlist `purchased` (and/or `purchased_id`) → Purchased
4. Linked or name-matched decision → Analysis
5. Else → Wishlist

RFC-018B lifecycle (`analyzed` / `bought` / `established` / …) remains the
learning layer; map **Inventory Created** into hub UX stages without forking a
second scoring system. Prefer FK resolution; keep name-match as fallback for
legacy unlinked rows.

## 6. Architecture

Feature-first glue over existing services. **No new purchase-decision engine.**

```
UI (BuyVsSkipResult / Decisions / Wishlist / Wizard)
  → hooks
  → acquisitionPipeline.service (orchestrates handoffs)
      → shopping (wishlist CRUD, decisions link)
      → inventory (create item, images)
      → purchases (create purchase after item exists)
      → optional RFC-020 analyze handoff
  → repositories → Supabase
Domain: timeline stage resolver (+ thin pipeline helpers / duplicate guards)
AI: explain only (existing Buy vs Skip / StyleDNA explain); never writes pipeline state
```

### Domain Layer

Pure TypeScript; time injected where timestamps matter.

| Module (illustrative) | Responsibility |
| --- | --- |
| Extend `AcquisitionTimeline` | Add `inventory_created` stage; prefer FK-linked subjects |
| `PipelineLifecycle` helper | Map wishlist + decision + purchase + inventory links → UI lifecycle status |
| `mapProspectiveToInventoryDraft` | Deterministic prefill DTO (text → draft fields); no I/O |
| `assertConversionAllowed` | Duplicate guard: already converted / missing required confirmations |

Do **not** reimplement BuyVsSkip, Priority, Opportunity, or Visual merge engines.

### Service Layer

New orchestration in shopping / acquisitions feature (name illustrative:
`acquisitionPipeline.service.ts`), returning `{ data, error }`:

- `addAnalysisToWishlist({ decisionId?, item, source, imageCandidate? })`
- `markWishlistPurchased({ wishlistId, price, date })`
- `linkDecisionToWishlist(decisionId, wishlistId)`
- `convertWishlistToInventory({ wishlistId, draft, attachImage, confirmToken })`
  — creates item → image → purchase → links; single transactional *intent*
  (best-effort compensating errors documented in §12)
- `getDecisionCardModel(decision)` — enriched view model for Recent Decisions

Reuse: `analyzeBuyVsSkip` / `recordDecisionSilent`, wishlist repository,
`createWardrobeItem`, `uploadPrimaryItemImage` / storage attach,
`createPurchase`, RFC-020 `analyzeItemPrimaryImage` (offer only).

### Repository Layer

- Extend decision repository: update `wishlist_item_id`; filter by linkage/source
- Extend shopping repository: write `purchased_id`, `inventory_item_id`, purchase
  intent fields, `image_url` / storage path
- Inventory + images + purchases repositories unchanged in responsibility;
  pipeline service calls them
- **No component → Supabase**

### UI Layer

- `BuyVsSkipResult` — action strip + hooks (no business logic in component)
- Inventory Conversion Wizard components under shopping or inventory feature
- `DecisionHistoryView` / hub Recent Decisions — cards, filters, actions
- Timeline view — new stage label/order
- Screenshot advisor — pass `source: "image"` into analysis + durable image
  candidate upload on wishlist handoff

### AI Layer

- Unchanged roles: explain Buy vs Skip; RFC-020 vision propose + optional explain
- **No** AI tool that creates inventory or marks purchased without the same
  confirmation UX (if chat tools are added later, they must invoke the same
  service guards — out of scope for this RFC’s UI, noted in §13)

## 7. Data Flow

### 7.1 Analysis → Wishlist

```
UI CTA Add to Wishlist
  → pipeline.addAnalysisToWishlist
  → [optional] persist image candidate to storage → image_url
  → shopping.insertWishlist (source, ProspectiveItem fields)
  → decision.repository link wishlist_item_id
  → return { wishlistItem }
```

### 7.2 Wishlist → Purchased

```
UI Mark Purchased (price, date)
  → pipeline.markWishlistPurchased
  → update wishlist status=purchased + purchase intent fields
  → timeline subjects resolve to Purchased
  → (no purchases row yet)
```

### 7.3 Purchased → Inventory (+ purchase + image)

```
UI Wizard Confirm
  → assertConversionAllowed(wishlist)
  → createWardrobeItem(draft)                    // user-confirmed fields
  → if attachImage: upload/attach primary image  // from candidate
  → createPurchase({ item_id, price, date })
  → wishlist: purchased_id, inventory_item_id, status=purchased
  → offer RFC-020 analyze (optional navigation)
```

### 7.4 Decision → UI enrichment

```
listDecisions
  → join/lookup wishlist by wishlist_item_id
  → derive lifecycle via PipelineLifecycle / timeline resolver
  → DecisionCardModel → filters/actions
```

### 7.5 Screenshot source correctness

```
ScreenshotAdvisor analyzeBuyVsSkip(item, { inputSource: "image", ... })
  → acquisition_decisions.source = "image"
  → metadata.inputSource = "image"
```

(Today screenshot often records `manual` — this RFC requires fixing the handoff.)

## 8. Data Model / Schema Impact

**Prefer additive columns.** Document SQL only in this RFC — **do not apply
migrations while authoring**. Implementing PR must call out SQL + RLS.

### 8.1 Already present (must start using)

| Column | Table | Today | This RFC |
| --- | --- | --- | --- |
| `wishlist_item_id` | `acquisition_decisions` | Almost always null | Set on wishlist handoff |
| `purchased_id` | `wishlist_items` | Never written | Set when `purchases` row created |
| `image_url` | `wishlist_items` | Rarely populated | Set from durable image candidate |
| `source` | both | Screenshot often wrong | Correct `manual` / `image` / `url` |

### 8.2 Proposed additive columns on `wishlist_items`

```sql
-- DOCUMENTATION ONLY — not applied by this RFC
alter table public.wishlist_items
  add column if not exists inventory_item_id uuid,
  add column if not exists purchase_price numeric,
  add column if not exists purchase_date date,
  add column if not exists image_storage_path text;

-- inventory_item_id: FK-by-convention to wardrobe_items(id) after conversion
-- purchase_price / purchase_date: intent before purchases row exists
-- image_storage_path: durable candidate for primary attach (alongside image_url)
```

Optional uniqueness guard (implementation choice; see §14):

```sql
-- DOCUMENTATION ONLY
create unique index if not exists wishlist_items_inventory_item_id_uidx
  on public.wishlist_items (inventory_item_id)
  where inventory_item_id is not null;
```

### 8.3 `purchases`

No required schema change if conversion always creates inventory first, then
`createPurchase({ item_id, ... })`. Do **not** make `item_id` nullable in this
RFC (avoids orphan purchases).

### 8.4 RLS

Any new columns inherit existing `mvp_anon_*` policies on `wishlist_items`.
No new tables required for Draft v1.

### 8.5 Immutability

- Do not UPDATE `acquisition_decisions.analysis` / verdict fields when linking
- Only allow setting `wishlist_item_id` when null, or no-op if already equal
  (never retarget to a different wishlist silently)

## 9. API / Domain Contracts

Illustrative; names may be adjusted at implementation.

```ts
type PipelineSource = "manual" | "image" | "url";

type HubTimelineStage =
  | "wishlist"
  | "analysis"
  | "purchased"
  | "inventory_created"
  | "first_wear"
  | "roi";

type DecisionLifecycleStatus =
  | "analyzed"
  | "on_wishlist"
  | "purchased"
  | "in_inventory"
  | "worn"
  | "roi";

interface ImageCandidate {
  /** Signed or public URL for preview */
  url: string;
  /** Storage path if already uploaded */
  storagePath?: string;
  /** Local upload bytes/path handled only in service — not in domain */
}

interface AddToWishlistFromAnalysisInput {
  decisionId?: string;
  item: ProspectiveItem;
  source: PipelineSource;
  imageCandidate?: ImageCandidate | null;
  analysisSummary?: Pick<BuyVsSkipAnalysis, "decision" | "score" | "summary">;
}

interface MarkPurchasedInput {
  wishlistId: string;
  purchasePrice: number;
  purchaseDate: string; // ISO date
}

interface InventoryConversionDraft {
  /** Prefill + user edits mapped toward CreateWardrobeItemInput */
  name: string;
  categoryText: string | null;
  categoryId: string | null;
  brandId: string | null;
  color: string | null;
  formality: string | null;
  material: string | null;
  notes: string | null;
  // …other inventory fields as needed
}

interface ConvertToInventoryInput {
  wishlistId: string;
  draft: InventoryConversionDraft;
  attachImage: boolean;
  /** User explicitly confirmed the review step */
  confirmed: true;
}

interface DecisionCardModel {
  decision: AcquisitionDecisionRecord;
  source: PipelineSource;
  wishlistItemId: string | null;
  inventoryItemId: string | null;
  lifecycleStatus: DecisionLifecycleStatus;
  actions: Array<
    | "add_to_wishlist"
    | "view_wishlist"
    | "mark_purchased"
    | "convert_to_inventory"
    | "view_inventory"
  >;
}

// Service contracts
addAnalysisToWishlist(input: AddToWishlistFromAnalysisInput): Promise<Result<WishlistItem>>;
markWishlistPurchased(input: MarkPurchasedInput): Promise<Result<WishlistItem>>;
convertWishlistToInventory(input: ConvertToInventoryInput): Promise<
  Result<{ itemId: string; purchaseId: string; wishlist: WishlistItem }>
>;
buildDecisionCardModel(decision: AcquisitionDecisionRecord, ctx: ...): DecisionCardModel;

// Domain
resolveHubTimelineStage(subject: TimelineSubjectLinks): HubTimelineStage;
mapProspectiveToInventoryDraft(item: ProspectiveItem): InventoryConversionDraft;
assertConversionAllowed(wishlist: WishlistItem): { ok: true } | { ok: false; reason: string };
```

**Screenshot / advisor requirement:** callers of `analyzeBuyVsSkip` must pass
`inputSource` (and wishlist id when known) so `acquisition_decisions.source` and
analysis metadata stay truthful.

## 10. Acceptance Criteria

- [x] Buy/Skip result can be saved to wishlist (CTA + persistence)
- [x] Screenshot analysis source is recorded as `image` (not silently `manual`)
- [x] Wishlist item can be marked purchased with price and date preserved
- [x] Purchased wishlist item can create an inventory item through the review wizard
- [x] Product image can be attached to the inventory item (user-confirmed)
- [x] Decision history links to wishlist item (`wishlist_item_id`)
- [x] Purchase history links to inventory item (`purchases.item_id` + wishlist
      `purchased_id` / `inventory_item_id`)
- [x] Timeline reflects lifecycle accurately, including **Inventory Created**
- [x] Recent Decisions UI is actionable and polished (cards, filters, actions)
- [x] No duplicate inventory item is created accidentally for the same wishlist row
- [x] User must confirm before inventory create (no auto-add)
- [x] Manual edits in the wizard win over prefill / vision suggestions
- [x] Decision snapshots remain immutable when linking wishlist
- [x] Optional Visual StyleDNA offer reuses RFC-020 (no auto-accept)
- [x] Tests cover lifecycle handoffs (wishlist link, purchase bridge, conversion
      guard, timeline stage resolution, source tagging)

## 11. QA / Testing Plan

### Unit / domain (Vitest)

- `mapProspectiveToInventoryDraft` field mapping + null handling
- `assertConversionAllowed` blocks when `inventory_item_id` already set
- `resolveHubTimelineStage` for each stage with FK links vs name-match fallback
- Decision card action matrix (unlinked / wishlisted / purchased / inventoried)

### Service / integration (Vitest with mocked repositories)

- Add to wishlist links `wishlist_item_id` and is idempotent per decision
- Mark purchased writes intent fields + status; does not call `createWardrobeItem`
- Convert: order item → image(optional) → purchase → wishlist links
- Convert failure mid-flight: no second inventory on retry when link already set
- Screenshot path sets `source: "image"` on decision insert

### Manual / preview

- Advisor → Add to Wishlist → appear on `/acquisitions/wishlist` with source
- Screenshot → verdict → Mark Purchased → timeline Purchased → Convert →
  inventory detail shows image when attached → offer Visual StyleDNA
- Recent Decisions filters + actions against linked and unlinked rows
- Attempt double Convert → blocked with link to existing item
- Confirm decision JSON / verdict unchanged after linking

### Release gate

- `npm test` green
- No live Gemini/OpenAI required for pipeline unit tests
- Schema migration (if any) reviewed for additive-only + RLS

## 12. Risks & Trade-offs

| Risk | Mitigation |
| --- | --- |
| `purchases.item_id` required → cannot create purchase before inventory | Purchase intent on wishlist until conversion; document clearly in UX copy |
| Partial failure (item created, purchase failed) | Idempotent retry: detect `inventory_item_id`, resume purchase + link; surface error |
| Category text vs inventory `category_id` mismatch | Best-effort map + force user confirm on review; never invent FK silently |
| Image storage cost / orphans | Upload candidate on wishlist handoff only; delete policy deferred (§13) |
| Duplicate inventory via parallel clicks | UI disable + `assertConversionAllowed` + unique index on `inventory_item_id` |
| Breaking 018B name-match accuracy during transition | Dual-path resolver: FK first, name fallback for legacy |
| Scope creep into marketplace / OCR / auto-buy | Hard non-goals; reject in review |

**Trade-off chosen:** confirmation friction over automation. Acquisitions remain
user-owned; intelligence stays explainable.

## 13. Future Extensions

- Chat / tool-calling wrappers that invoke the same pipeline services with the
  same confirmation requirements (ADR-007)
- Receipt / order-email assisted purchase date (still user-confirmed; not OCR in
  this RFC)
- Batch convert multiple purchased wishlist items
- Stronger FK constraints + `ON DELETE` behaviours once multi-user auth exists
- Candidate image cleanup job for dismissed / abandoned wishlist rows
- Deeper 018B accuracy when every buy decision has `wishlist_item_id` +
  `inventory_item_id`
- Intelligence Center action: “Convert purchased wishlist item”

## 14. Open Questions

1. **Where should the Conversion Wizard live in IA?** Modal from Acquisitions vs
   dedicated route (e.g. `/acquisitions/convert/[wishlistId]`) — default
   proposal: dedicated route for deep-linking from Decisions + result CTAs.
2. **Should “Create Inventory Item” from BuyVsSkipResult require Mark Purchased
   first?** Default: wizard can collect purchase price/date and set purchased in
   the same confirmed flow.
3. **Unique index on `wishlist_items.inventory_item_id`?** Default: yes (partial
   unique) at implementation.
4. **Image candidate storage bucket** — reuse inventory item-images bucket with a
   `wishlist/` prefix, or temporary staging bucket? Needs Owner pick before
   Approve.
5. **Backfill:** one-time script to link legacy decisions↔wishlist by normalized
   name? Default: **no** in v1 (FK going forward only); optional Developer tool
   later.
6. **Target patch version within v2.0.x?** Owner to pin (e.g. v2.0.2) at Approve.
