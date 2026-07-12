# RFC-027: Inline Brand Creation

Status: Draft
Owner: Sanchit Bhatnagar
Author: Claude Code
Target Release: v2.3.0
Epic: Inventory / Data Quality
Priority: Medium
Effort: S
Dependencies:

- Existing schema: `brands` lookup table (`id`, `name`) — read via
  `selectLookups()` / `selectImportLookups()` / `selectAllBrands()`
- [RFC-018C](RFC-018C-Acquisition-to-Inventory-Pipeline.md) — acquisition
  promotion maps free-text brand → `brand_id` (Implemented)
- [RFC-024](RFC-024-Catalog-Review-v2.md) — Catalog Review metadata
  completeness signals (Implemented)

---

## 1. Problem Statement

The `brands` lookup is **read-only from the product**. Every code path that
touches the table only `SELECT`s from it:

| Surface                           | Brand handling today                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| Item create/edit (`ItemFormDialog`) | Closed `LookupSelect` — pick from existing brands or "None"; no way to add          |
| Acquisition promotion (RFC-018C)  | Free-text `brandText` matched via `matchLookupId`; **no match → `brand_id: null`**, brand text silently dropped |
| JSON / CSV import                 | Unknown brand name → **validation error**; the row cannot import until the brand exists |
| Bulk edit                         | No brand field                                                                        |

There is **no UI, service, or repository path that inserts a brand**. The only
way to add one is a manual insert in Supabase. For a single-user wardrobe
product this is a routine dead end: buy something from a new label, and you
either leave the item unbranded (degrading purchase analytics by-brand
breakdowns, preference signals, and catalog quality) or leave the app to run
SQL.

This should be a small inline affordance — not a management page.

## 2. Goals

1. Let the owner **create a new brand inline** at the moment they need it —
   inside the existing Brand field on the item form — without leaving the flow.
2. **Deduplicate deterministically**: creating "uniqlo " when "Uniqlo" exists
   must resolve to the existing brand, never a near-duplicate row.
3. **Stop silent brand loss** in acquisition promotion: when `brandText`
   matches no brand, offer to create it (one confirmation, defaulting to the
   captured text).
4. New brand is immediately available in all lookup consumers (item form,
   filters, purchases analytics) after creation.
5. Keep it small: no new page, no new route, no schema redesign.

## 3. Non-Goals

- **Brand management surface** (rename, merge, delete, logos, metadata) — not
  page-worthy for this product; parked as a future extension.
- Auto-creating brands during **JSON/CSV import** — import stays strict
  (unknown brand = explicit validation error), which protects against typo
  fan-out on bulk data. Revisit as an opt-in toggle later.
- Extending the same inline-create pattern to other lookups (colors, seasons,
  occasions) in this RFC — the component pattern should permit it, but only
  brand ships here.
- AI suggesting or deciding brands (ADR-005) — brand creation is always an
  explicit user action.
- Any change to StyleDNA, recommendations, or scoring.

## 4. User Stories

- As a wardrobe owner adding an item from a new label, I want to type the brand
  name into the Brand field and create it on the spot, so I don't have to leave
  the form or settle for "None".
- As a wardrobe owner editing an existing item, I want the same inline-create
  ability in the edit dialog.
- As a wardrobe owner promoting an acquisition whose screenshot captured a
  brand we don't know yet, I want to be offered "Create brand ‹X›" instead of
  the brand silently vanishing on promotion.
- As a wardrobe owner, if I type a brand that already exists with different
  casing/spacing, I want the existing brand selected rather than a duplicate
  created.

## 5. UX Flow

**Entry point 1 — Item form (create & edit), primary:**

1. The Brand `LookupSelect` becomes a searchable **combobox**: typing filters
   the existing brand list.
2. When the query matches no existing brand (case/whitespace-insensitive), the
   last option in the list is **“＋ Add brand ‹query›”**.
3. Selecting it creates the brand, selects it in the field, and shows a brief
   success toast. On failure, an inline error appears and the field keeps the
   typed text.
4. If the query *does* normalize to an existing brand, no add-option is shown —
   the existing entry is highlighted instead.

**Entry point 2 — Acquisition promotion (RFC-018C):**

1. During promotion, when `matchLookupId(draft.brandText, lookups.brands)`
   returns `null` and `brandText` is non-empty, the promotion review UI shows
   the brand as **“New brand: ‹text› (will be created)”** with the ability to
   edit the name or clear it.
2. On confirm, the brand is created first, then the item is inserted with the
   new `brand_id`. Clearing keeps today's behaviour (`brand_id: null`).

No new pages or routes. Both flows stay inside existing dialogs/views.

## 6. Architecture

Feature-first, existing layers only. No new feature folder — this lives in
`features/inventory` (shared lookup write) and is consumed by
`features/shopping` for promotion.

### Domain Layer

Pure helpers (new module `src/domain/lookups/BrandNormalization.ts` or
colocated with existing lookup domain code):

- `normalizeBrandName(raw: string): string` — trim, collapse internal
  whitespace. Preserves user casing for display.
- `findBrandByName(name: string, options: LookupOption[]): LookupOption | null`
  — case-insensitive, whitespace-insensitive exact match (stricter than
  `matchLookupId`'s partial matching: creation must never fuzzy-match).

Deterministic, no I/O; unit-tested.

### Service Layer

`inventory` (or shared lookup) service:

- `createBrand(name: string): Promise<{ data: LookupOption | null; error: string | null }>`
  1. Normalize via domain helper; reject empty results.
  2. Fetch current brands (existing repository read).
  3. If `findBrandByName` hits → return the existing brand (idempotent success,
     no insert).
  4. Otherwise insert via repository and return the new row.

`acquisitionPipeline.service` gains an optional pre-step: when the caller
confirms a new brand, call `createBrand` and feed the returned id into the
existing item build (no change to `matchLookupId` semantics).

### Repository Layer

- `insertBrand(name: string)` in the inventory (lookups) repository — first
  write path to `brands`: `supabase.from("brands").insert({ name }).select("id, name").single()`.

### UI Layer

- Extend/replace `LookupSelect` (in `item-form-fields.tsx`) with a
  **creatable combobox** variant (`CreatableLookupSelect`), enabled only for
  Brand for now. Uses the existing select/command primitives; no new page.
- Promotion review UI (`features/shopping`): "New brand" row state described
  in §5.
- Hook: `useCreateBrand()` wrapping the service, invalidating/refetching the
  lookups query so all consumers see the new brand.

### AI Layer

Not involved. Screenshot understanding already extracts `brandText`; nothing
about that changes. AI never creates brands (ADR-005).

## 7. Data Flow

**Item form:**
User types unmatched name → selects "Add brand" → `useCreateBrand()` →
`createBrand()` service → normalize + dedupe (domain) → `insertBrand()`
repository → Supabase `brands` insert → service returns `LookupOption` → hook
refreshes lookups → form selects new `brand_id` → item saved with it.

**Acquisition promotion:**
Promotion view builds draft → `matchLookupId` misses → UI shows "will be
created" → on confirm, `createBrand(brandText)` → returned id passed into the
existing promotion insert (`brand_id` now set instead of null).

## 8. Data Model / Schema Impact

**No new tables or columns.** Two additive changes:

1. **RLS**: `brands` currently needs only `SELECT` for the anon role. Inline
   creation requires an anon `INSERT` policy (app uses the anon key, no auth):

   ```sql
   create policy "anon can insert brands"
     on public.brands for insert
     to anon
     with check (true);
   ```

2. **Recommended** duplicate guard at the database level (defense in depth
   behind the service-level dedupe):

   ```sql
   create unique index if not exists brands_name_ci_unique
     on public.brands (lower(trim(name)));
   ```

   Insert failures from this index surface as a friendly "brand already
   exists" error and the service re-fetches + selects the existing row.

Both are additive; no data migration. Exact current policies on `brands` to be
confirmed before implementation (see §14).

## 9. API / Domain Contracts

```ts
// domain
export function normalizeBrandName(raw: string): string;
export function findBrandByName(
  name: string,
  options: { id: string; name: string }[],
): { id: string; name: string } | null;

// repository
export async function insertBrand(
  name: string,
): Promise<{ data: LookupOption | null; error: string | null }>;

// service
export async function createBrand(
  name: string,
): Promise<{ data: LookupOption | null; error: string | null }>;

// UI
<CreatableLookupSelect
  label="Brand"
  value={form.brand_id}
  options={lookups.brands}
  onChange={(brand_id) => ...}
  onCreate={(name) => ...}   // wired to useCreateBrand
/>
```

No route handlers; all client-side via existing Supabase anon client.

## 10. Acceptance Criteria

- [ ] Typing an unknown brand in the item form's Brand field shows an
      "Add brand ‹name›" option; selecting it creates the brand and selects it.
- [ ] Creating a brand whose normalized name equals an existing brand
      (case/whitespace differences) selects the existing brand and inserts no
      new row.
- [ ] Empty/whitespace-only input never creates a brand and shows no add option.
- [ ] The new brand appears without a page reload in: item form selects,
      inventory brand filter, and purchases analytics brand lookups.
- [ ] Promoting an acquisition with unmatched non-empty `brandText` offers
      brand creation; confirming yields an inventory item with the new
      `brand_id`; declining preserves today's `brand_id: null` behaviour.
- [ ] JSON/CSV import behaviour is unchanged (unknown brand still errors).
- [ ] Insert failure (network/RLS/unique violation) shows an inline error and
      does not clear the user's typed text.

## 11. QA / Testing Plan

- **Unit (Vitest, domain):** `normalizeBrandName` (trim, whitespace collapse,
  unicode-safe casing), `findBrandByName` (exact-normalized only — must NOT
  partial-match the way `matchLookupId` does).
- **Unit (service):** `createBrand` dedupe path (returns existing, no insert
  call), insert path, empty-name rejection, unique-violation recovery.
- **Existing tests:** acquisition pipeline tests extended for the
  create-then-promote path; `matchLookupId` behaviour unchanged.
- **Manual/preview:** create brand from item form (create + edit dialogs);
  verify appearance in inventory filters and purchases analytics; promote an
  acquisition with a novel brand; attempt duplicate with different casing.
- `npm test` green before release (repo rule 14).

## 12. Risks & Trade-offs

- **Typo fan-out / lookup pollution.** Inline creation makes it easy to mint
  "Unqilo". Mitigated by normalized dedupe + unique index; accepted residual
  risk for a single-user product. A merge tool is deliberately deferred (§13).
- **Fuzzy vs strict matching mismatch.** Promotion matching (`matchLookupId`)
  allows partials; creation dedupe is strict. A brand like "Nike ACG" won't
  dedupe against "Nike" — this is correct (they're different brands) but worth
  stating: creation never blocks on a partial match.
- **RLS surface widening.** Opening anon `INSERT` on `brands` is consistent
  with the app's existing no-auth model (items are already anon-writable);
  negligible added exposure.
- **Creatable-combobox complexity** vs the current simple `Select`. Contained
  by shipping the creatable variant for Brand only.

## 13. Future Extensions

- Inline creation for other lookups (colors, occasions, materials) reusing
  `CreatableLookupSelect` — pairs naturally with RFC-026's occasions work.
- Lightweight brand merge/rename (fix a typo'd brand and repoint items).
- Opt-in "create missing brands" toggle on JSON/CSV import.
- Brand aliases (e.g. "UNIQLO U" → Uniqlo) feeding `matchLookupId`.

## 14. Open Questions

1. Confirm current RLS policies on `brands` (audit before implementation —
   `supabase-rls-auditor`); does any other lookup table already allow anon
   inserts we should mirror?
2. Should the acquisition-promotion flow (entry point 2) ship in the same
   release, or land the item-form combobox first and follow up? (Both are
   small; default: same release.)
3. Casing policy: preserve user input exactly (proposed) or title-case on save?
