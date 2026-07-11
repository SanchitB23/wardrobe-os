# RFC-020: Inventory Image Intelligence

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Cursor (Grok)
Target Release: v2.0.1
Epic: Vision / Recommendation
Priority: High
Effort: L
Dependencies:
- RFC-002 Vision Engine (`analyzeImage`, `VisionAnalysis`, `DetectedItem`, `StyleDNACandidate`) — perception only; this RFC never reimplements vision
- RFC-019 Vision Intelligence v2 — closet/outfit/duplicate **workflows**; do not duplicate perception or review-queue patterns already shipped there
- ADR-003 StyleDNA — derived profiles remain the scoring lens; this RFC proposes visual enrichment inputs, not a new DNA engine
- ADR-002 RecommendationContext — accepted visual attrs may feed `buildRecommendationContext` / `deriveStyleDNA` only after merge rules
- RFC-012 Recommendation Engine v2 — consumer of enriched StyleDNA; scoring stays deterministic
- ADR-005 AI does not decide — vision proposes; user confirms; engines score
- Existing inventory image upload (`src/features/inventory/repositories/images.repository.ts`, `uploadItemImage` / `uploadPrimaryItemImage`) — **visual display only today**; no auto vision on upload

> **Number reassignment.** RFC-020 was historically reserved for *Cross-Engine
> Orchestration* (parked — architecture already covered by RFC-005). That topic
> remains cancelled. **RFC-020 is now Inventory Image Intelligence** (this
> document). See [BACKLOG.md](../product/BACKLOG.md) and
> [FUTURE.md](../product/FUTURE.md).

> **Bridge the gap.** Item photos, Vision Engine, Recommendation v2, and Vision
> Intelligence v2 already exist — but inventory images do **not** auto-enrich
> StyleDNA or RecommendationContext. This RFC closes that loop with
> user-confirmed visual attributes.

---

## Inventory Image Intelligence Philosophy

- **Vision detects** (RFC-002). `VisionAnalysis` is observation + confidence.
- **Inventory Image Analyzer interprets** a single primary item photo into
  `VisualStyleAttributes` — not a closet scan, not outfit recognition (those
  stay RFC-019).
- **User confirms.** Accept / Reject before any enrichment affects StyleDNA or
  recommendation scoring.
- **Manual fields win.** Vision never overwrites user-entered colour, material,
  formality, tags, etc. automatically.
- **AI explains** (optional). Never decides scores, eligibility, or merges.

So: **Inventory Image → Vision Engine → VisionAnalysis → VisualStyleAttributes →
StyleDNA merge (accepted only) → RecommendationContext.**

---

## 1. Problem Statement

Wardrobe OS can upload item photos (`item_images` + storage), run Vision on
arbitrary images (RFC-002), run practical vision workflows (RFC-019), and score
outfits with StyleDNA + RecommendationContext (ADR-003 / ADR-002 / RFC-012).
Those pieces do not connect for **owned inventory**:

- Primary images are **display-only** today (`images.repository.ts`, item detail /
  gallery). Upload does not trigger vision analysis.
- StyleDNA (`deriveStyleDNA` in `src/domain/style-dna`) is derived from **manual /
  text metadata** on `StyleDNAItem` (name, colour, material, tags, formality…).
- `VisionAnalysis` is returned to callers and used in acquisition / vision
  workflows — it is **not stored per inventory item** as durable visual style
  attributes.
- Recommendation Context Builder maps wardrobe rows → StyleDNA without any
  image-derived fields.

The owner feels the pain as sparse StyleDNA on well-photographed items: colours,
patterns, and silhouette cues sit in the photo but never reach scoring unless
typed by hand. Vision Intelligence v2 solved capture workflows (scan / outfit /
duplicates), not **enrichment of existing inventory from its primary image**.

Why now: Vision + Reco v2 + StyleDNA are stable; the missing product surface is
per-item visual enrichment with an explicit review step — a natural v2.0.1
follow-on to RFC-019 without expanding perception scope.

## 2. Goals

1. **Analyze primary inventory image** via the existing Vision Engine (RFC-002).
2. **Extract visual attributes:** dominant / secondary colours, pattern, texture,
   material cues, silhouette, formality cues, style tags, and overall visual
   confidence.
3. **Persist** those attributes separately from manual item fields (additive
   `item_visual_attributes` — see §8).
4. **Merge into StyleDNA** only with explicit user acceptance and confidence-aware
   rules; never overwrite manual fields automatically.
5. **Feed RecommendationContext** only from **accepted** visual attributes (plus
   existing manual metadata).
6. **Review UX** — Analyze / Accept / Reject on item detail; show confidence and
   source image; show diff vs manual fields.
7. **Re-run** analysis when the primary image changes (mark prior row `stale`).
8. **Backfill** existing items with primary images (Developer / Review bulk path).

## 3. Non-Goals

- Automatic overwrite of manual wardrobe fields
- Auto-create inventory items from images (closet scan remains RFC-019)
- Laundry / stain / wear detection
- Body fit / size estimation
- Public image search / reverse image lookup / marketplace crawl
- OCR (labels, receipts, price tags)
- Reimplementing Vision Engine or Vision Intelligence workflow hubs
- Changing Recommendation Engine scoring formulas beyond consuming richer
  StyleDNA inputs (no new multi-objective axes in this RFC)
- Populating `VisionAnalysis.metadata.embeddings` (still reserved)

## 4. User Stories

- As the owner, I analyze an item’s primary photo and see proposed colours /
  pattern / material / style cues so I can enrich StyleDNA without retyping
  everything.
- As the owner, I accept or reject the proposal so recommendation scoring never
  silently trusts a bad vision guess.
- As the owner, I keep my manually entered colour / material / formality when
  they disagree with vision — user-entered always wins.
- As the owner, when I change the primary image, prior visual analysis is marked
  stale and I can re-run analysis against the new photo.
- As a developer, I can bulk-queue backfill for items that have a primary image
  but no accepted visual attributes, under Developer / Review controls.

## 5. UX Flow

### Item detail — Visual Analysis card

| Element | Behaviour |
| --- | --- |
| Card | On item detail (inventory), show status: none / pending / accepted / rejected / stale |
| Analyze | Runs Vision on current **primary** image; writes/updates `item_visual_attributes` as `pending` |
| Accept | Sets status `accepted`; StyleDNA merge may use visual attrs per §6/§9 rules |
| Reject | Sets status `rejected`; visual attrs must not affect StyleDNA / Reco |
| Confidence | Show overall confidence + quality band; flag low-confidence fields |
| Source | Thumbnail / link to the `image_id` analyzed |
| Diff | Side-by-side manual fields vs proposed visual attrs (colour, material, formality, tags, etc.) |

### Primary image change

1. User sets a new primary image (existing upload / set-primary flow).
2. If an accepted or pending visual row exists for the old image → mark `stale`
   (do not auto-reanalyze without consent — Open Question §14 may allow optional
   auto-queue).
3. Card prompts **Re-analyze** against the new primary.

### Bulk backfill

| Surface | Purpose |
| --- | --- |
| Developer Mode and/or Review hub | List items with primary image and missing / stale visual attrs; enqueue Analyze; optional batch Accept is **out of scope** (per-item Accept remains required) |

Flow: Select items → Analyze (pending rows) → owner reviews on item detail →
Accept / Reject individually.

## 6. Architecture

Fits feature-first: components → hooks → services → repositories → Supabase;
pure domain for merge / attribute mapping; Vision Runtime for perception only.

```
Item primary image (item_images)
        ↓
Vision Runtime / RFC-002 analyzeImage
        ↓
VisionAnalysis
        ↓
InventoryImageAnalyzer (domain) → VisualStyleAttributes
        ↓
Repository persist (item_visual_attributes, status=pending)
        ↓
User Accept / Reject (service)
        ↓
StyleDNA Merge (domain) — manual wins; accepted visual fills gaps / soft cues
        ↓
RecommendationContextBuilder → Recommendation Engine v2
```

### Domain Layer

Pure TypeScript (proposed locations; names illustrative):

- `VisualStyleAttributes` — durable, vision-derived attribute shape (not
  `VisionAnalysis` wholesale).
- `InventoryImageAnalyzer` — maps `VisionAnalysis` (+ optional primary
  `DetectedItem` / `StyleDNACandidate`) → `VisualStyleAttributes` + confidence.
  Deterministic; no I/O.
- `StyleDNAVisualMerge` (or extend `deriveStyleDNA` inputs) — merges **accepted**
  visual attrs into the `StyleDNAItem` / StyleDNA derivation path:
  - Manual non-null fields always win.
  - Visual attrs may fill nulls or contribute soft signals only when accepted.
  - Low confidence must not strongly affect scoring (cap weight / ignore below
    threshold — exact threshold in §14).
- Unit tests required for analyzer + merge (CLAUDE.md domain rule).

**Does not** replace ADR-003’s pure derivation model: DNA remains derived at
read time; this RFC adds optional **accepted** visual inputs to the item shape
fed into derivation — not LLM-on-the-scoring-path (ADR-005 / ADR-003 rejected
alternative).

### Service Layer

Orchestration returning `{ data, error }`:

- `analyzeItemPrimaryImage(itemId)` — load primary image → call Vision → analyze
  → upsert visual attrs as `pending`.
- `acceptItemVisualAttributes(itemId)` / `rejectItemVisualAttributes(itemId)`.
- `markVisualAttributesStaleOnPrimaryChange(itemId, newImageId)`.
- `backfillVisualAnalysis(itemIds)` — enqueue / run analyze for Developer path
  (rate-limit aware; no auto-accept).
- Map accepted attrs into the wardrobe snapshot path used by
  `buildRecommendationContext` / StyleDNA item mapping.

### Repository Layer

- Existing: `src/features/inventory/repositories/images.repository.ts`
  (`item_images`, storage signed URLs) — unchanged responsibility (persistence of
  images only).
- New: repository for `item_visual_attributes` (select by item_id, upsert, status
  transitions, stale on image change).
- No component → Supabase calls.

### UI Layer

- Item detail **Visual Analysis** card (hooks only; no business logic in
  components).
- Developer / Review bulk backfill list + actions.
- Reuse existing item image display components; do not invent a second vision hub
  that duplicates `/vision` (RFC-019).

### AI Layer

- Perception only via existing Vision Runtime / `POST /api/ai/vision` (or
  equivalent shared path).
- Optional AI **explanation** of proposed attrs after analysis — never writes
  status, never merges, never scores (ADR-005, ADR-007 tool pattern if exposed
  to chat later).
- No direct DB access from the model.

## 7. Data Flow

1. **UI** — Owner opens item detail → Visual Analysis card → Analyze.
2. **Hook** — `useItemVisualAnalysis` (name TBD) calls service.
3. **Service** — Resolve primary `item_images` row → signed URL / bytes → invoke
   Vision Engine (`analyzeImage`) with source e.g. `gallery` / inventory-specific
   source string.
4. **Domain** — `InventoryImageAnalyzer(analysis) → VisualStyleAttributes`.
5. **Repository** — Upsert `item_visual_attributes` with `status = pending`,
   `image_id`, confidence, extracted fields, optional vision summary JSON.
6. **UI** — Show pending proposal + diff vs manual fields.
7. **Accept** — Service sets `accepted`; subsequent StyleDNA / Recommendation
   builds include merge.
8. **Reject** — Service sets `rejected`; merge ignores row.
9. **Primary change** — Image service / hook notifies visual-attrs service →
   `stale`; Analyze again produces a new pending row for the new `image_id`.
10. **Recommendation** — `RecommendationContextBuilder` / StyleDNA mapping loads
    accepted visual attrs (if any) and applies merge rules before
    `deriveStyleDNA`.

## 8. Data Model / Schema Impact

**Additive only.** Prefer a first-class table over stuffing opaque JSON onto
`wardrobe_items`, so status / RLS / staleness / image FK stay queryable for
backfill and review. A JSON column for the raw vision summary (or full attribute
payload) is acceptable **inside** the row for forward-compatible fields.

### Proposed table: `item_visual_attributes`

Documented SQL only — **do not apply in this RFC task**.

```sql
-- DOCUMENTATION ONLY — not applied by this RFC
create table if not exists public.item_visual_attributes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  image_id uuid not null references public.item_images (id) on delete cascade,

  -- Optional opaque VisionAnalysis / analyzer snapshot for debug & re-merge
  vision_summary jsonb,

  dominant_colors jsonb,       -- e.g. [{ name, family, hex, coveragePct, confidence }]
  secondary_colors jsonb,
  pattern text,
  texture text,
  material_guess text,
  silhouette text,
  formality_guess text,
  style_tags text[] default '{}',

  confidence numeric not null check (confidence >= 0 and confidence <= 1),

  status text not null
    check (status in ('pending', 'accepted', 'rejected', 'stale'))
    default 'pending',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  rejected_at timestamptz
);

-- One active row per item (latest analysis); history optional later
create unique index if not exists item_visual_attributes_item_id_uidx
  on public.item_visual_attributes (item_id);

create index if not exists item_visual_attributes_status_idx
  on public.item_visual_attributes (status);

create index if not exists item_visual_attributes_image_id_idx
  on public.item_visual_attributes (image_id);

alter table public.item_visual_attributes enable row level security;

-- Align with existing MVP anon policies on item_images / wardrobe_items
-- (normalize to mvp_anon_* if/when RFC-008-style policy cleanup lands)
create policy mvp_anon_select_item_visual_attributes
  on public.item_visual_attributes for select to anon using (true);

create policy mvp_anon_insert_item_visual_attributes
  on public.item_visual_attributes for insert to anon with check (true);

create policy mvp_anon_update_item_visual_attributes
  on public.item_visual_attributes for update to anon using (true) with check (true);

create policy mvp_anon_delete_item_visual_attributes
  on public.item_visual_attributes for delete to anon using (true);
```

### RLS implications

- Mirror the current single-user / anon MVP posture used by `item_images`
  (see inventory image policies). When access guard / auth hardens, tighten
  policies in the same pass as other inventory tables — not a special case.
- Service role / edge paths (if any) must not bypass Accept semantics in app
  code even if RLS is permissive.

### What does **not** change

- No required new columns on `wardrobe_items` for colour/material (manual fields
  stay canonical).
- `item_images` schema unchanged; FK from visual attrs → `image_id` only.

## 9. API / Domain Contracts

Illustrative contracts (implementation may rename; behaviour is normative):

```ts
/** Status of persisted visual analysis for an inventory item. */
export type VisualAttributeStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "stale";

/** Vision-derived style cues stored separately from manual item fields. */
export interface VisualStyleAttributes {
  itemId: string;
  imageId: string;
  visionSummary?: unknown;
  dominantColors: ColorObservation[]; // reuse vision ColorObservation shape
  secondaryColors: ColorObservation[];
  pattern: string | null;
  texture: string | null;
  materialGuess: string | null;
  silhouette: string | null;
  formalityGuess: string | null;
  styleTags: string[];
  confidence: number; // 0–1
  status: VisualAttributeStatus;
}

export function analyzeInventoryImage(
  analysis: VisionAnalysis,
  opts: { itemId: string; imageId: string; generatedAt: string },
): VisualStyleAttributes;

export interface StyleDNAMergeInput {
  manual: StyleDNAItem;
  visual: VisualStyleAttributes | null;
  /** Only `accepted` visual rows may contribute. */
}

export function mergeVisualIntoStyleDNAItem(
  input: StyleDNAMergeInput,
): StyleDNAItem;
```

**Merge rules (normative):**

1. If `visual` is null or status ≠ `accepted` → return manual unchanged.
2. For each overlapping field (colour, material, formality, style tags…): if
   manual value is present → keep manual; else may adopt visual guess.
3. Soft signals (pattern, silhouette, secondary colours) may attach as tags /
   StyleDNA input extensions only when accepted and confidence ≥ threshold.
4. Below-threshold confidence → treat as non-contributing (no strong scoring
   effect).
5. Never mutate persisted manual columns on Accept — Accept only flips visual
   status (and timestamps). Optional “Apply to manual fields” is a **future**
   explicit action (§13), not default Accept behaviour.

**Service signatures (sketch):**

```ts
analyzeItemPrimaryImage(itemId: string): Promise<{ data: VisualStyleAttributes | null; error: Error | null }>;
acceptItemVisualAttributes(itemId: string): Promise<{ data: VisualStyleAttributes | null; error: Error | null }>;
rejectItemVisualAttributes(itemId: string): Promise<{ data: VisualStyleAttributes | null; error: Error | null }>;
```

## 10. Acceptance Criteria

- [ ] Analyzing an item with a primary image produces a `pending`
      `item_visual_attributes` row linked to that `image_id`.
- [ ] Extracted fields include dominant/secondary colours, pattern, texture,
      material_guess, silhouette, formality_guess, style_tags, and confidence.
- [ ] Manual wardrobe fields are never overwritten by Analyze or Accept.
- [ ] Rejected and pending attrs do not change StyleDNA / RecommendationContext
      relative to manual-only baseline.
- [ ] Accepted attrs may fill gaps / soft cues in StyleDNA merge per §9; user
      entered values still win on conflict.
- [ ] Low-confidence analyses do not strongly affect recommendation scoring
      (threshold behaviour documented and tested).
- [ ] Item detail shows Visual Analysis card with Analyze / Accept / Reject,
      confidence, source image, and manual-vs-visual diff.
- [ ] Changing primary image marks existing visual row `stale` and does not
      auto-accept a new analysis.
- [ ] Bulk backfill can enqueue Analyze for items missing visual attrs without
      auto-accepting.
- [ ] No automatic destructive updates; no auto-create items; ADR-005 preserved
      (AI/vision does not decide scores).
- [ ] Domain analyzer + merge covered by Vitest; feature-first layering preserved
      (no Supabase in components / domain).

## 11. QA / Testing Plan

### Unit (required)

- `InventoryImageAnalyzer` — fixed `VisionAnalysis` fixtures → stable
  `VisualStyleAttributes` (determinism with injected `generatedAt` where
  relevant).
- `mergeVisualIntoStyleDNAItem` — manual wins; null fill; rejected/pending/stale
  ignored; low confidence ignored; accepted soft tags applied.
- StyleDNA / RecommendationContext regression — accepted visual gap-fill changes
  DNA only where expected; scoring still deterministic for identical inputs.

### Integration / service (mocked Vision)

- Analyze upserts pending; Accept / Reject transitions; primary change → stale.
- Backfill selects correct candidates (has primary image, no accepted attrs).

### Manual / preview

- Item with rich primary photo: Analyze → review diff → Accept → Today /
  recommendation surfaces reflect richer cues without clobbering typed colour.
- Item with bad / ambiguous photo: low confidence → Accept still safe (weak
  effect) or Reject leaves baseline unchanged.
- Primary image swap → stale badge → re-analyze.
- Developer backfill: run on a small set; confirm pending-only and per-item
  Accept still required.

### Release gate

- `npm test` green before any release tag that includes this feature (project
  release rule).

## 12. Risks & Trade-offs

| Risk | Mitigation |
| --- | --- |
| Vision mis-tags colour/material → bad outfits | Pending by default; Accept required; manual wins; low-confidence cap |
| Cost / latency of backfill on large closet | Batch under Developer; rate-limit; reuse Vision cache (ADR-006 / image hash) where available |
| Duplicating RFC-019 scope | Explicit non-goals; no closet scan / outfit log here; item-detail card only |
| Storing full `VisionAnalysis` vs slim attrs | Slim typed columns + optional `vision_summary` JSON for debug |
| ADR-003 historically rejected persisting derived DNA | We persist **observations + review status**, not StyleDNA itself; DNA still derived at read time |
| Unique-per-item upsert loses history | v1 accepts overwrite; history table deferred (§13) |
| Permissive anon RLS | Match existing MVP tables; harden with auth later |

**Trade-off chosen:** separate reviewed visual attrs table + merge-on-read over
auto-writing wardrobe columns — maximizes safety and ADR-005 alignment at the
cost of an Accept step.

## 13. Future Extensions

- Explicit “Apply accepted colour/material to manual fields” one-shot action
- Visual attribute history / audit log
- Auto-queue re-analyze on primary change (still pending Accept)
- Use accepted attrs in Vision Intelligence duplicate similarity (RFC-019)
- Embeddings / visual search once `metadata.embeddings` is populated
- Chat tools: `analyzeItemImage` / `getItemVisualAttributes` (ADR-007) — explain
  only
- Multi-image consensus (primary + secondary angles)

## 14. Open Questions

1. **Confidence threshold** — exact numeric floor below which accepted attrs
   contribute zero weight (e.g. 0.4 vs 0.6)?
2. **Auto re-analyze on primary change** — prompt only, or optionally auto-run
   Analyze (still `pending`)?
3. **One row per item vs append-only history** — confirm unique-per-item for v1?
4. **Where does bulk backfill live** — `/developer` only, or also a Review
   surface adjacent to RFC-019 review queue (without merging queues)?
5. **Formality / silhouette enums** — free text from vision vs constrained unions
   aligned to wardrobe enums?
6. **Secondary images** — analyze primary only in v1 (assumed), or allow
   “analyze this image” on any gallery image?
7. **Cache key** — always key Vision cache by image hash so re-Analyze of the
   same bytes is cheap (recommended: yes)?

---

## Target release note

**Target Release: v2.0.1** · Epic: Vision / Recommendation · Priority: High ·
Effort: L. Depends on shipped Vision Engine (RFC-002), Vision Intelligence v2
workflows (RFC-019) as adjacent product context, StyleDNA (ADR-003),
RecommendationContext (ADR-002), and Recommendation Engine v2 (RFC-012). Does
not claim ROADMAP ship status until Implemented / Released.
