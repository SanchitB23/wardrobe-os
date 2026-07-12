# Inline Brand Creation — Design (RFC-027)

Date: 2026-07-12
RFC: [RFC-027](../../rfc/RFC-027-Inline-Brand-Creation.md)
Status: Approved by owner (brainstorming session, 2026-07-12)
Target: v2.4.0 · Effort: S

## Context

The `brands` lookup is read-only from the product — every path (`selectLookups`,
`selectImportLookups`, `selectAllBrands`) only `SELECT`s. Adding a brand means
running SQL in Supabase. Two user-facing consequences:

- **Item form** (`ItemFormDialog` → `ItemFormFields`): the Brand field is a
  closed `Select`; a new label can't be added inline.
- **Acquisition promotion** (`inventory-conversion-wizard.tsx`):
  `buildInventoryDraftFromWishlist` maps captured `brandText` via
  `matchLookupId`; on a miss, `brand_id` is `null` and the captured text is
  silently dropped.

**RLS audit (2026-07-12):** all nine lookup tables (`brands`, `colors`,
`categories`, `materials`, `occasions`, `seasons`, `styles`, `subcategories`,
`tags`) have exactly one anon policy each — `mvp_anon_select_*`, SELECT only.
No lookup table currently allows anon INSERT, so `brands` becomes the first
writable lookup. This is consistent with the app's no-auth model (items,
`item_occasions`, etc. are already anon-writable).

**Key structural fact:** the conversion wizard renders the same
`ItemFormFields` component as the item-form dialog (`inventory-conversion-wizard.tsx:171`).
One change to the Brand field serves both entry points.

## Decisions (owner-confirmed)

1. **UI pattern — Select + Add-new dialog** (not a searchable combobox). Keep
   the existing `Select`; add a pinned "＋ Add new brand…" item that opens a
   small `Dialog` (text input + Create). Reuses existing `Select` + `Dialog`
   primitives; no new Popover primitive (none exists in `components/ui/`).
2. **Scope — both entry points now.** Item form and create-on-promote ship
   together; they're the same component, so it's one affordance.
3. **Casing — preserve user input** (after trim + whitespace-collapse). Dedupe
   is case-insensitive, so "nike" resolves to existing "Nike", but a genuinely
   new "adidas"/"ASICS" is saved as typed.
4. **RLS — resolved.** Add anon `INSERT` on `brands` + a `lower(trim(name))`
   unique index. No other lookup to mirror; documented as the first writable
   lookup.

## Architecture

### Domain — `src/domain/lookups/BrandNormalization.ts` (new, pure)

```ts
export function normalizeBrandName(raw: string): string; // trim + collapse ws, keep casing
export function findBrandByName(
  name: string,
  options: { id: string; name: string }[],
): { id: string; name: string } | null; // case/ws-insensitive EXACT match
```

`findBrandByName` is intentionally stricter than `matchLookupId` (no partial
matching) — creation must never silently fold "Nike ACG" into "Nike".

### Repository — inventory lookups repository

```ts
export async function insertBrand(
  name: string,
): Promise<{ data: LookupOption | null; error: string | null }>;
// supabase.from("brands").insert({ name }).select("id, name").single()
```

### Service — inventory (or shared lookup) service

```ts
export async function createBrand(
  name: string,
): Promise<{ data: LookupOption | null; error: string | null }>;
```

1. `normalizeBrandName`; reject empty → error.
2. Fetch current brands; `findBrandByName` hit → return existing (idempotent,
   no insert).
3. Else `insertBrand`. On a unique-index violation (race / normalization
   mismatch), re-fetch and return the existing row rather than erroring.

Acquisition promotion needs **no service change** — the wizard's Brand field
gains the same Add-new affordance via the shared component (below). The only
promotion tweak is surfacing the captured `brandText` (see UI).

### UI — one change in `item-form-fields.tsx`

- The Brand `LookupSelect` gains a pinned "＋ Add new brand…" item. Selecting
  it opens a small `Dialog`: text input (defaulted to the current typed /
  fallback brand text), Create / Cancel. On success the returned brand is
  selected (`onChange(brand_id)`); on failure an inline error shows and the
  typed text is retained.
- `useCreateBrand()` wraps `createBrand`, invalidating the lookups query so the
  new brand appears everywhere (form, inventory filter, purchases analytics)
  without reload.
- **Promotion surfacing:** the conversion wizard passes
  `labelFallbacks={{ brand: wishlist.brandText }}` (mechanism already exists in
  `ItemFormFields`) so an unmatched captured brand is visible; the Add-new
  dialog defaults its input to that text. Captured brand is one click from
  created instead of dropped.

Scope note: the Add-new item is added to the Brand field specifically, not
generalized to all `LookupSelect` uses in this RFC (colors/occasions/etc. are a
future extension).

### AI Layer

Not involved. AI never creates brands (ADR-005).

## Data Model / Schema Impact

No new tables/columns. Additive migration
(`docs/migrations/RFC-027-brand-insert.sql`):

```sql
create policy "anon can insert brands"
  on public.brands for insert to anon with check (true);

create unique index if not exists brands_name_ci_unique
  on public.brands (lower(trim(name)));
```

## Out of scope

- Brand management (rename / merge / delete / logos).
- Auto-creating brands on JSON/CSV import (stays a strict validation error).
- Generalizing inline-create to other lookups.
- Any StyleDNA / recommendation / scoring change.

## Testing

- **Domain:** `normalizeBrandName` (trim, ws-collapse, casing preserved,
  unicode); `findBrandByName` (exact-normalized only — must NOT partial-match).
- **Service:** dedupe path returns existing with no insert call; insert path;
  empty-name rejection; unique-violation recovery.
- **Manual/preview:** create brand from the item-form dialog and from the
  conversion wizard; verify it appears in the inventory brand filter and
  purchases analytics; promote an acquisition with a novel captured brand
  (defaulted into the Add-new dialog); attempt a different-casing duplicate
  (resolves to existing, no new row).
- Gates: `npm test`, lint, `tsc`, build green (repo rule 14).
