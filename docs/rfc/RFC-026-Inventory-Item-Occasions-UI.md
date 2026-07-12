# RFC-026: Inventory Item Occasions — UI & Data Model Alignment

Status: Draft  
Owner: Sanchit Bhatnagar  
Author: Cursor  
Target Release: v2.3.0  
Epic: Inventory / Data Quality  
Priority: High  
Effort: M  
Dependencies:

- [RFC-024](RFC-024-Catalog-Review-v2.md) Catalog Review v2 — flags `missing_occasion`
  (Implemented)
- [RFC-025](RFC-025-Similar-Item-Detection-Tightening.md) — adjacent Epic 12 work (Draft)
- ADR-003 Style DNA — occasion suitability derived from metadata
- ADR-005 — AI does not decide; any auto-fill is deterministic + user-confirmed
- Existing schema: `occasions` lookup + `item_occasions` junction (score, notes)

---

## 1. Problem Statement

Catalog Review (RFC-024) surfaces **Missing occasion** for items with no rows in
`item_occasions`, but the product has **no UI path** to fix it after import:

| Surface                           | Occasion support today                                  |
| --------------------------------- | ------------------------------------------------------- |
| JSON Import (`/inventory/import`) | ✅ `occasions: [{ name, score? }]` → `item_occasions`   |
| Item detail (`/inventory/[id]`)   | 👁 Read-only Occasions card                             |
| Item edit (`ItemFormDialog`)      | ❌ No occasion field                                    |
| Bulk edit (`/inventory`)          | ❌ Tags/seasons/styles only — not occasions             |
| Catalog Review edit action        | ❌ Opens form without occasions                         |
| Wear log occasion                 | ⚠️ Event context only — does not write `item_occasions` |

Owners see badges like _Pocket Square · Missing occasion_ with no actionable fix
except re-importing JSON. This erodes Catalog Review trust and leaves curated
occasion scores unused outside import.

**Conceptual tension:** Wardrobe OS has **two occasion concepts**:

1. **`item_occasions`** — explicit owner-curated links to `occasions` lookup
   (optional 0–10 score, notes). Catalog Review checks this table.
2. **StyleDNA `occasion.suitability`** — deterministic 0–10 scores per
   `OccasionKey` (`office`, `gym`, `travel`, …) derived from **formality, tags,
   styles, category keywords** in `StyleDNAEngine` — **not** from `item_occasions`.

Recommendation engines consume **StyleDNA**, not `item_occasions` directly.
Formality (`casual` … `formal`) is already editable on the item form and strongly
influences StyleDNA occasion scores, but does **not** satisfy Catalog Review's
`hasOccasion` check.

We need a product decision: **interpret from existing fields**, **add explicit
occasion input**, or **align Catalog Review with what engines actually use**.

## 2. Goals

1. Give owners a **first-class UI** to set/update item occasions so Catalog Review
   `missing_occasion` issues are actionable.
2. Preserve **deterministic engines** — no AI auto-writing occasion links without
   explicit user confirmation (ADR-005).
3. Reuse existing **`occasions` lookup + `item_occasions`** schema (prefer no
   migration).
4. Clarify relationship between **formality**, **tags**, and **explicit occasions**
   in UX copy and docs.
5. Optionally reduce duplicate data entry via **deterministic suggestions**
   (user accepts/edits).
6. Extend the same pattern consideration to **seasons** and **materials** (same
   gap as occasions) — at minimum document; implement occasions first.

## 3. Non-Goals

- Replacing StyleDNA occasion scoring (engines keep deriving suitability).
- AI inferring occasions from images (future; ADR-005).
- Changing wear-log occasion semantics (event context stays separate).
- New occasion taxonomy design (use existing `occasions` lookup rows).
- Removing `missing_occasion` from Catalog Review without a replacement signal.

## 4. User Stories

- As a wardrobe owner, I want to tag a pocket square with **Office** and **Wedding**
  occasions from the item edit flow so Catalog Review stops flagging it.
- As a wardrobe owner, I want **suggested occasions** based on formality I already
  set, so I am not retyping what the system could infer — but I confirm before save.
- As a wardrobe owner, I want to bulk-add **Travel** season/occasion to selected
  items like I can bulk-add seasons today.
- As a developer, I want one service/repository write path for `item_occasions`
  shared by item edit, bulk edit, and import.

## 5. UX Flow

### Primary flow — Item edit (recommended)

1. Owner opens **Edit item** from `/inventory`, item detail, or Catalog Review.
2. New section **Occasions** (multi-select chips from `occasions` lookup).
3. Optional per-occasion **score** (0–10, default 7 when omitted) — collapsed
   "Advanced" or inline on chip expand; match import JSON semantics.
4. Optional **Suggest from formality & tags** button:
   - Runs pure domain mapper (see §6).
   - Pre-selects suggested occasions in the multi-select **without saving**.
   - Owner adjusts and saves.
5. Save → service replaces `item_occasions` for that item → Catalog Review
   refreshes → `missing_occasion` clears when ≥1 occasion linked.

### Secondary flow — Item detail

1. Occasions card gains **Edit** action → same editor (dialog or inline).

### Tertiary flow — Bulk actions

1. `/inventory` bulk toolbar → **Add occasion** / **Remove occasion** (mirror
   existing add/remove season).

### Catalog Review integration

1. Missing Metadata section: **Edit** opens item form with Occasions section visible.
2. Issue badge links to item detail `#occasions` anchor (optional polish).

## 6. Architecture

### Design options (brainstorm)

| Option                         | Description                                                                             | Pros                                                                   | Cons                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **A. Formality proxy**         | Catalog Review treats `formality != null` as "has occasion signal"; no new UI           | Zero UI work; formality already set                                    | `item_occasions` stays empty; filters/analytics using junction table still broken; conflates formality with Office/Gym/Travel |
| **B. Explicit occasions only** | Multi-select UI writes `item_occasions`; no inference                                   | Clear owner intent; matches import model; fixes Catalog Review         | Extra manual work; duplicates signal already in formality/tags                                                                |
| **C. Auto-sync on save**       | Saving formality auto-writes `item_occasions` via deterministic map                     | Less typing                                                            | Silent data writes; hard to override; wedding vs office nuance lost                                                           |
| **D. Hybrid (recommended)**    | Explicit multi-select **+** optional deterministic **Suggest** (preview, user confirms) | Best precision/recall balance; ADR-005 safe; actionable Catalog Review | Slightly more UI                                                                                                              |

**Recommendation: Option D (Hybrid).**

Formality alone is **insufficient** to represent multi-occasion suitability
(e.g. a blazer: `business_casual` formality but suitable for Office + Wedding +
Travel with different scores). Tags partially overlap but are unstructured.
`item_occasions` is the right persisted model for owner-curated suitability;
formality/tags feed **suggestions**, not replacement.

#### Deterministic suggestion engine (domain — pure)

New module: `src/domain/inventory-occasions/` (or extend `src/domain/catalog-review/`)

```ts
export type OccasionSuggestion = {
  occasionName: string; // must resolve to lookup
  score: number; // default 7
  reason: string; // e.g. "formality:business_casual"
};

export function suggestOccasions(input: {
  formality: FormalityEnum | null;
  tags: readonly string[];
  styles: readonly string[];
  categoryName: string | null;
}): OccasionSuggestion[];
```

**Example mapping (initial, tunable in tests):**

| Signal                                 | Suggested occasions          |
| -------------------------------------- | ---------------------------- |
| `formality: business_casual`           | Office (8), Smart Casual (7) |
| `formality: formal`                    | Wedding (8), Office (6)      |
| `formality: casual`                    | Casual (8), Home (7)         |
| Tag/style contains `gym`, `athleisure` | Gym (9)                      |
| Tag/style contains `travel`            | Travel (8)                   |

Suggestions **never persist** until the user saves the form. AI not involved.

#### Catalog Review rule (optional tweak)

Keep `missing_occasion` = no `item_occasions` rows.

**Do not** treat formality alone as satisfying the check (keeps explicit model
honest). Optionally add informational hint in UI: "Formality is set; add occasions
or use Suggest."

### Domain Layer

- `suggestOccasions()` — pure suggestions (new).
- Catalog Review `collectItemIssues` — **unchanged** unless product chooses Option A
  (not recommended).

### Service Layer

- `item-relations.service.ts` (new) or extend `relations.service.ts`:
  - `fetchItemOccasions(itemId)`
  - `replaceItemOccasions(itemId, occasions: { occasionId, score?, notes? }[])`
- Wire into existing create/update item flows or separate save step on dialog.

### Repository Layer

- `relations.repository.ts` — add write helpers mirroring `json-sync.repository.ts`:
  - delete all `item_occasions` for item
  - insert batch
- `bulk-actions.repository.ts` — extend `RelationTable` to include `item_occasions`
  (add/remove occasion bulk actions).

### UI Layer

| Component                                                 | Change                                    |
| --------------------------------------------------------- | ----------------------------------------- |
| `item-form-fields.tsx` or new `item-relations-fields.tsx` | Occasions multi-select + suggest button   |
| `item-form-dialog.tsx`                                    | Load/save occasions on edit               |
| `item-detail-view.tsx`                                    | Edit on Occasions card                    |
| `bulk-edit-dialog.tsx`                                    | Add/remove occasion actions               |
| `inventory-review-view.tsx`                               | No rule change; edit flow gains occasions |

### AI Layer

N/A for v1. Optional future: AI **explains** why suggestions were offered — never
writes occasions.

## 7. Data Flow

```
Edit Item dialog
  → useWardrobeLookups (occasions list)
  → fetchItemOccasions (existing links)
  → [Suggest] suggestOccasions(formality, tags, …) → pre-fill UI only
  → User confirms → replaceItemOccasions
  → invalidate wardrobe + review queries
  → Catalog Review missing_occasion cleared
```

Import path unchanged (`json-sync.repository.ts`).

## 8. Data Model / Schema Impact

**No schema changes required.**

Existing tables:

- `occasions` (id, name, description)
- `item_occasions` (id, item_id, occasion_id, score, notes)

RLS: reuse existing anon MVP policies on `item_occasions` (RFC-008).

If `occasions` lookup is empty in a deployment, UI shows empty state + link to
seed/import docs — out of scope unless seed migration needed (see §14).

## 9. API / Domain Contracts

### New / extended service functions

```ts
// features/inventory/services/item-relations.service.ts
export async function fetchItemOccasionLinks(itemId: string): Promise<{
  data: ItemOccasionRelation[] | null;
  error: Error | null;
}>;

export async function saveItemOccasions(
  itemId: string,
  input: { occasionId: string; score?: number | null; notes?: string | null }[],
): Promise<{ data: true | null; error: Error | null }>;
```

### Bulk edit action types (extend `BulkEditAction`)

```ts
| { type: "add_occasion"; occasionId: string }
| { type: "remove_occasion"; occasionId: string }
```

### Domain

```ts
export function suggestOccasions(
  input: SuggestOccasionsInput,
): OccasionSuggestion[];
```

## 10. Acceptance Criteria

- [ ] Owner can add/remove ≥1 occasion on item edit; persists to `item_occasions`.
- [ ] Catalog Review `missing_occasion` clears after save when ≥1 occasion linked.
- [ ] Item detail Occasions card shows linked occasions with Edit entry point.
- [ ] **Suggest from formality & tags** pre-fills multi-select without auto-save.
- [ ] Bulk add/remove occasion works for multi-selected inventory rows.
- [ ] JSON import behaviour unchanged.
- [ ] No AI writes to `item_occasions`.
- [ ] Domain tests for `suggestOccasions()` mapping cases.
- [ ] Service/repository tests for replace semantics (delete + insert).

## 11. QA / Testing Plan

**Unit**

- `suggestOccasions` — formality-only, tag gym, combined signals, empty input.
- Catalog Review — item with occasions saved no longer emits `missing_occasion`.

**Integration**

- Save item occasions → reload detail → scores visible.
- Bulk add occasion → filter inventory by occasionIds includes items.

**Manual**

1. Open Catalog Review → Missing Metadata → Pocket Square → Edit → add Office →
   save → badge gone.
2. Set formality only → Suggest → verify pre-fill → save → verify persisted.
3. Bulk select 3 items → add Travel occasion.

**Release gate:** `npm test`, `lint`, `tsc`, `build` green.

## 12. Risks & Trade-offs

| Risk                                                                | Mitigation                                                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Duplicate signals (formality + occasions + StyleDNA) confuse owners | In-form helper text explaining difference                                                                        |
| Suggestion map wrong for edge categories (accessories)              | Conservative defaults; user always confirms                                                                      |
| `item_occasions` vs StyleDNA drift                                  | Document: explicit occasions for catalog/filtering; StyleDNA for engine scoring — future RFC could merge signals |
| Scope creep (materials, seasons, features)                          | Ship occasions first; same editor pattern in follow-up                                                           |
| Empty `occasions` lookup in DB                                      | Seed script or document required lookup rows                                                                     |

**Trade-off:** Explicit entry costs owner time vs inferring from formality only;
hybrid minimizes cost while keeping owner in control.

## 13. Future Extensions

- **Unified Item Relations editor** — occasions + seasons + materials + tags in one
  panel (fixes all RFC-024 metadata gaps except category/color on core form).
- **StyleDNA merge** — feed high-confidence `item_occasions` scores into StyleDNA
  as overrides (deterministic blend, not AI).
- **Catalog Review quick-fix** — inline occasion chip picker without full edit dialog.
- **Occasion lookup admin** — settings page to add custom occasions (Office, Diwali,
  etc.).
- **Acquisition handoff** — map Buy vs Skip `intendedOccasions` → `item_occasions` on
  inventory conversion (RFC-018C extension).

## 14. Open Questions

1. **Scores required?** Default 7 for all, or hide scores until "Advanced" (match
   import optional score)?
2. **Option A fallback?** Should Catalog Review downgrade severity or suppress
   `missing_occasion` when formality is set, even before UI ships?
3. **Seed data:** Does production `occasions` table have standard rows (Office, Gym,
   Travel, …)? If not, include additive seed migration in this RFC or separate chore?
4. **Scope:** Include seasons + materials in same release (M → L) or occasions-only?
5. **Create flow:** Add occasions on **new item** create, or edit-only v1?

---

## Appendix: Why formality ≠ occasion

| Field              | Storage                        | Engine use                                         | Example                   |
| ------------------ | ------------------------------ | -------------------------------------------------- | ------------------------- |
| Formality          | `wardrobe_items.formality`     | StyleDNA formality rank, office/wedding verdicts   | `business_casual`         |
| Occasions          | `item_occasions` → `occasions` | Catalog Review, filters, health analytics, display | Office 9/10, Wedding 7/10 |
| StyleDNA occasions | Derived in memory              | Recommendation eligibility & scoring               | `suitability.office = 8`  |

A pocket square may have **no formality** but still suit **Wedding** and **Office**
as explicit occasions — formality proxy (Option A) would miss this nuance.
