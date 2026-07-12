# RFC-024: Catalog Review v2

Status: Implemented  
Owner: Sanchit Bhatnagar  
Author: Cursor (Grok)  
Target Release: v2.2.0  
Epic: Inventory / Data Quality  
Priority: High  
Effort: L  
Dependencies:
- Existing Import Review surface (`/inventory/review`, `review.service.ts`
  `buildDuplicateReview`, `ReviewCleanupDialog`) — this RFC **replaces** that
  product model, not Vision `/vision/review`
- Inventory CRUD + `ItemFormDialog` (edit remains source of truth)
- RFC-020 Inventory Image Intelligence — visual attrs (`pending` / `accepted` /
  `rejected` / `stale`); Catalog Review surfaces “Visual Analysis Pending” /
  stale; Analyze still lives on item detail / RFC-020 flows
- Wardrobe Health Engine (`WardrobeHealthEngine`) — analytics overlap (unbranded,
  missing tags); Catalog Review is the **actionable** inventory surface; health
  remains diagnostic
- Shopping / Acquisition duplicate engines (`DuplicateEngine`, Buy vs Skip
  overlap) — **not** reused for catalog identity; catalog rules are inventory-
  specific (code + metadata-aware name scoring)
- ADR-005 AI does not decide — no AI verdict on “is this a duplicate?”
- ADR-008 release/versioning

> **Product model (canonical):**
>
> | Concept | Meaning |
> | --- | --- |
> | **Duplicate** | Same physical/logical inventory identity — same code, or same normalized name **and** same category **and** same color (active items). |
> | **Similar item** | Looks related by name but differs in color, brand, and/or category — **not** a duplicate. |
> | **Catalog issue** | Missing or stale metadata / image / visual analysis that degrades engines downstream. |
> | **Dismiss** | User asserts a candidate pair/group is not a duplicate; persisted so it does not reappear. |
> | **Reviewed** | Optional per-item (or per-issue) acknowledgement that the owner has inspected it. |
>
> Canonical flow:
>
> ```
> Import / Inventory edits
>   → Catalog Review loads active catalog
>   → Deterministic engines classify: Duplicates | Similar | Metadata | Images | Visual | Quality
>   → Owner acts: edit · fix metadata · analyze image · dismiss · retire · hard-delete (confirmed)
>   → Catalog quality score updates
> ```

> **Grounding note (current product — audit 2026-07-12):** `/inventory/review`
> (“Import review”) is a **duplicate-cleanup tool** only. Detection is
> name/code-only with Levenshtein ≥ 0.85 and **ignores color/brand/category**.
> Known false positives: *Solid White Shirt* vs *Solid Wine Shirt*; *Olive
> Activewear T-Shirt* vs *White Activewear T-Shirt*. No dismiss persistence, no
> metadata sections, no catalog quality score. Retired items participate in
> matching. Algorithm lives in `review.service.ts` (not `src/domain`). Dashboard
> `needs_review` (missing category/image/rating) is a separate quick filter —
> not this page.

---

## 1. Problem Statement

Bad catalog data poisons **recommendations, wardrobe health, shopping /
acquisition signals, ROI, and AI explanations**. After bulk import (or long-lived
manual entry), the owner needs a single surface to find and fix identity and
completeness problems.

Today’s Import Review fails that job:

1. **False-positive duplicates** — color variants with long shared name tails
   score as duplicates under name-only fuzzy matching.
2. **No “similar vs duplicate” distinction** — different-color shirts are treated
   like true duplicates, pushing retire/delete instead of “keep both.”
3. **No catalog quality sections** — missing color, brand, material, seasons,
   occasions, images, or visual analysis never appear here.
4. **No false-positive escape hatch** — without dismiss, bad groups return every
   visit.
5. **Destructive-first mental model** — cleanup is the primary action; quality
   repair is secondary.

Who feels it: the owner after CSV/JSON import and anyone trusting engines that
read incomplete or wrongly deduped inventory.

Why now: Import, RFC-020 visuals, and acquisitions are shipped; the false-
positive cases are confirmed; next free RFC is **024**.

---

## 2. Goals

1. **Rename** Import Review → **Catalog Review** (route may keep
   `/inventory/review` with redirect/alias; nav label + page title change).
2. **Metadata-aware duplicate scoring** — replace name-only fuzzy clustering
   with explicit rules (§5 / §9).
3. **Separate sections** on one surface:
   - Duplicates
   - Similar Items
   - Missing Metadata
   - Unbranded Items
   - Missing Images
   - Visual Analysis Pending
   - Data Quality Issues
4. **Dismiss / ignore** false-positive duplicate (and optionally similar) pairs
   or groups — persisted.
5. **Reviewed state** where useful (per-item or per-issue) so progress is visible.
6. **Catalog quality score** — deterministic 0–100 (or equivalent) from issue
   mix / completeness; shown as a KPI, not an AI opinion.
7. **Regression tests** for known false positives and core duplicate rules.
8. **Preserve** retire (default soft) and hard delete (explicit confirmation);
   prefer edit / fix metadata / analyze image as primary actions.
9. Move pure classification into **`src/domain`** (feature service orchestrates
   only).

---

## 3. Non-Goals

- **Automatic merge** of duplicate inventory rows.
- **Automatic delete** or auto-retire of “duplicates.”
- **Automatic metadata overwrite** (vision or AI writing into manual fields).
- Marketplace / retail enrichment APIs.
- Public image search / scraping.
- **AI deciding** catalog correctness, duplicate identity, or quality score
  (ADR-005).
- Replacing Vision Review Queue (`/vision/review`) or Wardrobe Health dashboard
  analytics.
- Shopping wishlist↔wardrobe duplicate engine rewrite (RFC-018).

---

## 4. User Stories

- As the owner, I want **White Shirt vs Wine Shirt** treated as **similar**, not
  duplicate, so I do not retire a valid colorway.
- As the owner, I want **Olive vs White Activewear** under **Similar Items**, so
  I keep both and optionally dismiss the pair.
- As the owner, I want **same-code** rows flagged as hard duplicates so I can
  retire or delete the wrong code.
- As the owner, I want **missing color / brand / material / season / occasion /
  image / visual analysis** listed so I can fix import gaps quickly.
- As the owner, I want to **dismiss** a false-positive duplicate so it stays gone.
- As the owner, I want a **catalog quality score** so I know whether the catalog
  is engine-ready.
- As the owner, I want **retire** by default and **hard delete** only after
  explicit confirmation so accidents are rare.
- As the owner, I want **Analyze image** / **Add image** deep links so RFC-020
  enrichment is reachable from review.

---

## 5. UX Flow

### 5.1 Entry points

| Surface | Role |
| --- | --- |
| Nav **Settings → Review** (relabel **Catalog Review**) | Primary |
| `/inventory/review` | Canonical route (title: Catalog Review) |
| Optional `/inventory/catalog-review` | Redirect to canonical if desired |
| Post-import success CTA on `/inventory/import` | “Open Catalog Review” |
| Command palette | Shortcut to Catalog Review |

### 5.2 Page layout

1. **Header** — “Catalog Review”; short description: quality control for identity
   and completeness (not auto-merge).
2. **KPI strip** — Catalog quality score; total active items; open duplicate
   groups; open issue counts (metadata / images / visual pending).
3. **Filters** — search (code, name, brand, category); toggle **Include retired**
   (default **off**); optional section chips.
4. **Sections** (collapsible cards; empty states per section):

| Section | Content |
| --- | --- |
| **Duplicates** | Groups with reason badge (`same_code` / `same_identity`); member rows |
| **Similar Items** | Pairs/groups: similar name but differing color/brand/category |
| **Missing Metadata** | Sublists or tags: color, material, category, subcategory, season, occasion |
| **Unbranded Items** | Missing brand (and optional “Unbranded” brand sentinel if product uses one) |
| **Missing Images** | No primary image |
| **Visual Analysis Pending** | No visual attrs, or `pending` / `stale` (RFC-020) |
| **Data Quality Issues** | Invalid status, bad/empty code, duplicate codes already covered above, other hard rules |

5. **Row actions** — View · Edit · Fix metadata (opens edit focused) · Analyze
   image · Add image · Retire · Hard delete (via cleanup dialog) · Mark reviewed
   · Dismiss (duplicate/similar only).
6. **Bulk** — select within a section; bulk retire / hard-delete with existing
   confirmation pattern; bulk mark reviewed optional.

### 5.3 Duplicate rules (product)

| Rule | Classification |
| --- | --- |
| Same code (normalized, case-insensitive), ≥2 **active** items | **Duplicate** (`same_code`) |
| Same normalized name **+** same category **+** same color (both colors present and equal), ≥2 active | **Duplicate** (`same_identity`) |
| Similar name **+** different color | **Similar item**, not duplicate |
| Similar name **+** different brand and/or category (and not same_identity) | **Similar item**, not duplicate |
| Retired items | **Excluded by default** from scoring; optional include via filter |

**Similar name** (for Similar Items only): deterministic token/Levenshtein helper
with a **stricter** bar than today’s 0.85-on-full-string alone — e.g. shared
garment tokens after stripping known color words, or similarity ≥ threshold
**and** not blocked by color/brand/category disagreement. Exact formula lives in
domain (§9); acceptance tests lock behaviour for the two known FPs.

**Not duplicates:** name-only fuzzy match when colors differ.

### 5.4 Dismiss & reviewed

- **Dismiss duplicate / similar** — persists pair or group key; hidden from
  default lists; “Show dismissed” optional.
- **Mark reviewed** — clears “needs attention” for that item/issue until
  underlying data changes (e.g. still missing color → stays in Missing Metadata
  unless reviewed hides it with a filter “Hide reviewed”).

### 5.5 Destructive actions

Unchanged safety posture:

- Default cleanup = **retire** (`status = retired`).
- **Hard delete** requires dialog + explicit opt-in checkbox (existing
  `ReviewCleanupDialog` pattern).
- No silent deletes; no auto-merge.

---

## 6. Architecture

Preserve feature-first: components → hooks → services → repositories → Supabase;
pure engines in `src/domain`.

### Domain Layer

New (illustrative) module e.g. `src/domain/catalog-review/`:

- `classifyCatalogIssues(items, visuals?, dismissals?)` → sectioned result
- `scoreDuplicateCandidate(a, b)` → `{ kind: 'duplicate' | 'similar' | 'none'; reason }`
- `catalogQualityScore(summary)` → 0–100 deterministic
- `normalizeItemCode` / `normalizeItemName` / color-token strip helpers
- Pure; time/status filters injected; no React/Supabase/AI

**Remove** (or thin-wrap) string-only `areNamesSimilar` clustering from
`review.service.ts` as the source of truth.

### Service Layer

- `getCatalogReview(filters)` — load items (+ visual attrs join), dismissals,
  call domain classifier, return `{ data, error }`
- `dismissCatalogPair` / `undismiss` / `markCatalogReviewed`
- Reuse `bulkCleanupWardrobeItems` (retire / hard_delete)
- Deep-link helpers for RFC-020 analyze (no new vision stack)

### Repository Layer

- Extend review repository: active-by-default fetch; optional retired
- Load `item_visual_attributes` for pending/stale (RFC-020 table)
- Persist dismissals / reviewed rows (§8)
- Existing retire / hard delete paths unchanged in semantics

### UI Layer

- Rename copy: `InventoryReviewView` → Catalog Review (or new
  `catalog-review-view.tsx`); section components; KPI; dismiss controls
- Nav: “Catalog Review”
- Hooks: `useCatalogReview`, mutations for dismiss / reviewed / cleanup

### AI Layer

**None for decisions.** Optional later: explain “why this is similar” from
deterministic reasons — out of scope for v1 of this RFC. No tool that marks
duplicates or overwrites metadata without user action.

---

## 7. Data Flow

```
UI Catalog Review
  → useCatalogReview(filters)
  → catalogReview.service.getCatalogReview
  → repositories: wardrobe_items (+ colors/brands/categories),
                  item_visual_attributes,
                  catalog_review_dismissals / reviewed
  → domain.classifyCatalogIssues(...)
  → { duplicates, similar, missingMetadata, unbranded, missingImages,
      visualPending, dataQuality, qualityScore }
  → UI sections + actions

Dismiss:
  UI → service.dismiss → repository insert → invalidate query

Cleanup:
  UI ReviewCleanupDialog → bulkCleanupWardrobeItems → retire | hard_delete

Edit / Analyze / Add image:
  → existing ItemFormDialog / item detail / RFC-020 analyze routes
```

---

## 8. Data Model / Schema Impact

**Prefer additive.** Document only — do not apply in this RFC authoring step.

### Proposed tables (illustrative)

```sql
-- Dismissed duplicate/similar pairs (canonical unordered pair of item ids)
create table if not exists public.catalog_review_dismissals (
  id uuid primary key default gen_random_uuid(),
  item_id_a uuid not null references public.wardrobe_items (id) on delete cascade,
  item_id_b uuid not null references public.wardrobe_items (id) on delete cascade,
  kind text not null check (kind in ('duplicate', 'similar')),
  reason text null,
  created_at timestamptz not null default now(),
  constraint catalog_review_dismissals_ordered check (item_id_a < item_id_b),
  constraint catalog_review_dismissals_unique unique (item_id_a, item_id_b, kind)
);

-- Optional per-item reviewed marker for Catalog Review
create table if not exists public.catalog_review_item_state (
  item_id uuid primary key references public.wardrobe_items (id) on delete cascade,
  reviewed_at timestamptz null,
  updated_at timestamptz not null default now()
);
```

**RLS:** match inventory MVP anon policies (`mvp_anon_*`) used elsewhere for
single-user posture — or authenticated-only if project has moved off anon.

**No change** to `wardrobe_items` core columns required for v1 if checks use
existing FKs / junction tables (seasons, occasions, tags, images,
`item_visual_attributes`).

**Alternative (Open Question §14):** store dismissals in local/prefs only —
rejected for multi-device; prefer DB.

If Open Questions choose **no reviewed table**, omit `catalog_review_item_state`
and use dismissals + “hide issues I’ve dismissed” only.

---

## 9. API / Domain Contracts

Illustrative TypeScript contracts (names may adjust on implement):

```ts
type DuplicateReason = "same_code" | "same_identity";
type SimilarReason = "similar_name_diff_color" | "similar_name_diff_meta";

type CatalogIssueKind =
  | "missing_color"
  | "missing_brand"
  | "missing_material"
  | "missing_category"
  | "missing_subcategory"
  | "missing_season"
  | "missing_occasion"
  | "missing_image"
  | "visual_pending"
  | "visual_stale"
  | "invalid_status"
  | "bad_code";

function scorePair(a: CatalogItemView, b: CatalogItemView): {
  kind: "duplicate" | "similar" | "none";
  reason?: DuplicateReason | SimilarReason;
  score?: number; // optional explainability 0–1
};

function classifyCatalogIssues(input: {
  items: CatalogItemView[];
  visuals: Map<string, VisualStyleAttributesRow>;
  dismissals: Dismissal[];
  includeRetired: boolean;
}): CatalogReviewModel;

function catalogQualityScore(model: CatalogReviewModel): number; // 0–100
```

**Duplicate identity:** `same_identity` requires normalized name equality (or
strict equivalence after normalize) **and** same `category_id` **and** same
`primary_color_id` (both non-null). If either color is null, do **not** treat as
`same_identity` duplicate — route to Missing Metadata / Similar as appropriate.

**Same code:** always duplicate among included items, regardless of color.

Service exports: `getCatalogReview`, `dismissCatalogPair`,
`markCatalogItemReviewed`, existing `bulkCleanupWardrobeItems`.

Routes: no new REST APIs required (client service layer), consistent with
current inventory feature.

---

## 10. Acceptance Criteria

- [ ] Page title / nav read **Catalog Review** (not “Import review”).
- [ ] *Solid White Shirt* vs *Solid Wine Shirt* is **not** in Duplicates; appears
      under **Similar Items** (or not grouped as duplicate).
- [ ] *Olive Activewear T-Shirt* vs *White Activewear T-Shirt* is **not** a
      duplicate; similar-items behaviour as above.
- [ ] Same normalized code (≥2 active items) appears under **Duplicates**.
- [ ] Same name + same category + same color (≥2 active) appears under
      **Duplicates**.
- [ ] Retired items excluded by default; optional include works.
- [ ] Sections exist: Duplicates, Similar Items, Missing Metadata, Unbranded,
      Missing Images, Visual Analysis Pending, Data Quality Issues.
- [ ] Missing image section lists items without primary image.
- [ ] Visual Analysis Pending includes missing / pending / stale visual attrs
      (RFC-020).
- [ ] False-positive pairs can be **dismissed** and stay dismissed after reload.
- [ ] Edit, view, retire, hard-delete (confirmed), fix metadata, analyze/add
      image actions are reachable and non-silent.
- [ ] Catalog quality score is shown and deterministic for a fixed fixture set.
- [ ] Unit tests cover duplicate rules + the two known false positives.
- [ ] AI does not classify duplicates or overwrite metadata.
- [ ] No automatic merge or automatic delete.

---

## 11. QA / Testing Plan

### Domain (required)

- `same_code` grouping (case-insensitive).
- `same_identity` when name+category+color match.
- White vs Wine shirts → **similar**, not duplicate.
- Olive vs White activewear → **similar**, not duplicate.
- Similar name + different brand/category → similar.
- Retired excluded by default.
- Dismissals suppress pairs.
- `catalogQualityScore` monotonicity smoke (more issues ⇒ lower score).

### Service / repository

- Fetch filters; dismissal CRUD; cleanup modes still retire vs hard_delete.

### UI (manual / light)

- Section empty states; dismiss; hard-delete checkbox; deep link to analyze.
- Post-import CTA opens Catalog Review.

### Regression

- Existing inventory import code-uniqueness tests (if added) remain green.
- RFC-020 Accept/Reject behaviour unchanged.

---

## 12. Risks & Trade-offs

| Risk | Mitigation |
| --- | --- |
| Over-strict `same_identity` misses true dupes with null color | Null color ≠ identity match; surface Missing Metadata |
| Similar-name threshold still noisy | Separate section; dismiss; strip color tokens |
| Schema for dismissals | Additive; cascade on item delete |
| Overlap with Wardrobe Health | Health stays analytics; Catalog Review is actionable |
| Confusion with `/vision/review` | Copy + nav clarify “catalog” vs “vision session” |
| Moving logic to domain is a larger diff | Required for testability; thin service wrapper |

Trade-off: **no merge in v1** — safer, explicit; merge can be a future RFC.

---

## 13. Future Extensions

- Safe **merge wizard** (pick survivor fields, re-link wears/purchases).
- Import-batch scoped review (`import_batch_id`).
- Completeness score per category.
- AI **explanation** of why two items are similar (reasons only).
- Sync dismissals to shopping duplicate UX.
- Background “catalog health” card on Today / Intelligence Center.

---

## 14. Open Questions

1. **Route:** keep `/inventory/review` only, or add `/inventory/catalog-review`
   redirect?
2. **Reviewed state:** separate table vs “dismiss issues” only?
3. **Unbranded:** null `brand_id` only, or also a dedicated “Unbranded” brand row?
4. **Similar clustering:** pairs only vs transitive groups?
5. **Quality score weights:** exact formula (owner preference before Approve)?
6. **Include `rating` in Missing Metadata?** (dashboard `needs_review` uses it;
   Catalog Review checklist omitted rating — confirm.)
7. **Migration timing:** apply dismissals SQL with implementation PR or earlier?

---

## Document control

| Version | Date | Notes |
| --- | --- | --- |
| 0.1 | 2026-07-12 | Draft from Import Review audit + product brief |
