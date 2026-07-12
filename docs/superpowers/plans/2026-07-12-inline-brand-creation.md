# Inline Brand Creation (RFC-027) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner create a new brand inline from the item form's Brand field (and, via the same shared component, the acquisition conversion wizard), with case-insensitive dedupe — the first product write path to the `brands` lookup.

**Architecture:** Pure domain normalization/dedupe helpers; a `createBrand` service (normalize → dedupe against a fresh fetch → insert, recovering from a unique-index race); a `useCreateBrand` hook that invalidates lookups; and a "＋ Add new brand…" affordance on the Brand `LookupSelect` that opens a small `Dialog`. Because the conversion wizard renders the same `ItemFormFields`, one field change serves both entry points.

**Tech Stack:** Next.js App Router (client components + anon Supabase client), React, TanStack Query, Vitest, Supabase RLS.

**Spec:** `docs/superpowers/specs/2026-07-12-rfc-027-inline-brand-creation-design.md` · **RFC:** `docs/rfc/RFC-027-Inline-Brand-Creation.md` (Approved)

## Global Constraints

- Feature-first layering (CLAUDE.md 1–6): components → hooks → services → repositories → Supabase. Only repositories touch Supabase; `src/domain/**` stays pure (no I/O, deterministic).
- Casing: **preserve user input** after trim + internal-whitespace collapse. Never title-case.
- Dedupe: case/whitespace-insensitive **exact** match — must NOT partial-match the way `matchLookupId` does (so "Nike ACG" never folds into "Nike").
- Idempotent create: an existing normalized-equal brand returns that row with **no insert**; a unique-index violation recovers by re-fetching and returning the existing row.
- No AI (ADR-005). No new page/route. No change to JSON/CSV import (unknown brand still errors). No change to `matchLookupId` semantics.
- Schema change (CLAUDE.md 11): anon `INSERT` on `brands` + `lower(trim(name))` unique index — additive, documented as a migration file. `brands` becomes the first writable lookup; the migration must be applied to the live DB before browser verification.
- Conventional commits ending `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; `npm test` green before release (rule 14).
- Supabase client for these client-side writes: `createClient` from `@/lib/supabase/client` (the pattern `inventory.repository.ts` already uses).

---

### Task 1: Domain — brand normalization + strict dedupe

**Files:**
- Create: `src/domain/lookups/BrandNormalization.ts`
- Create: `src/domain/lookups/index.ts`
- Test: `src/domain/lookups/tests/brand-normalization.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Task 2's service): `normalizeBrandName(raw: string): string` and `findBrandByName(name: string, options: { id: string; name: string }[]): { id: string; name: string } | null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/lookups/tests/brand-normalization.test.ts
import { describe, expect, it } from "vitest";

import { findBrandByName, normalizeBrandName } from "@/domain/lookups";

describe("normalizeBrandName", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeBrandName("  Uniqlo  ")).toBe("Uniqlo");
    expect(normalizeBrandName("North   Face")).toBe("North Face");
  });

  it("preserves user casing", () => {
    expect(normalizeBrandName("adidas")).toBe("adidas");
    expect(normalizeBrandName("ASICS")).toBe("ASICS");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeBrandName("   ")).toBe("");
    expect(normalizeBrandName("")).toBe("");
  });
});

describe("findBrandByName", () => {
  const options = [
    { id: "b1", name: "Uniqlo" },
    { id: "b2", name: "Nike" },
    { id: "b3", name: "The North Face" },
  ];

  it("matches case-insensitively", () => {
    expect(findBrandByName("uniqlo", options)?.id).toBe("b1");
    expect(findBrandByName("UNIQLO", options)?.id).toBe("b1");
  });

  it("matches whitespace-insensitively", () => {
    expect(findBrandByName("  nike ", options)?.id).toBe("b2");
    expect(findBrandByName("The  North   Face", options)?.id).toBe("b3");
  });

  it("does NOT partial-match (stricter than matchLookupId)", () => {
    expect(findBrandByName("Nike ACG", options)).toBeNull();
    expect(findBrandByName("North Face", options)).toBeNull(); // "The North Face" ≠ "North Face"
  });

  it("returns null for empty input", () => {
    expect(findBrandByName("", options)).toBeNull();
    expect(findBrandByName("   ", options)).toBeNull();
  });

  it("returns null when no option matches", () => {
    expect(findBrandByName("Zara", options)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/lookups/tests/brand-normalization.test.ts`
Expected: FAIL — cannot resolve `@/domain/lookups`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/lookups/BrandNormalization.ts
/**
 * Pure brand-name helpers (RFC-027). Normalization preserves the user's
 * casing (only trims + collapses internal whitespace); dedupe is
 * case/whitespace-insensitive EXACT match — deliberately stricter than
 * matchLookupId, which partial-matches. Creation must never silently fold a
 * distinct brand (e.g. "Nike ACG") into an existing one ("Nike").
 */

export function normalizeBrandName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function dedupeKey(value: string): string {
  return normalizeBrandName(value).toLowerCase();
}

export function findBrandByName(
  name: string,
  options: { id: string; name: string }[],
): { id: string; name: string } | null {
  const key = dedupeKey(name);
  if (!key) return null;
  return options.find((option) => dedupeKey(option.name) === key) ?? null;
}
```

```ts
// src/domain/lookups/index.ts
export {
  normalizeBrandName,
  findBrandByName,
} from "@/domain/lookups/BrandNormalization";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/lookups/tests/brand-normalization.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/domain/lookups
git commit -m "feat: brand normalization + strict dedupe domain helpers (RFC-027)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Migration + repository + service + hook (the write path)

**Files:**
- Create: `docs/migrations/RFC-027-brand-insert.sql`
- Modify: `src/features/inventory/repositories/inventory.repository.ts` (append `selectBrands`, `insertBrand`)
- Modify: `src/features/inventory/services/inventory.service.ts` (append `createBrand`)
- Modify: `src/features/inventory/hooks/index.ts` (append `useCreateBrandMutation`)
- Test: `src/features/inventory/services/tests/create-brand.service.test.ts` (create dir if needed)

**Interfaces:**
- Consumes: `normalizeBrandName`, `findBrandByName` (Task 1); `createClient` from `@/lib/supabase/client`; `toError`; `LookupOption`; the existing hook patterns in `hooks/index.ts` (`useMutation`, `invalidateWardrobeQueries`, `wardrobeKeys`, `unwrapData`, `toast`).
- Produces (used by Task 3):
  - `selectBrands(): Promise<{ data: LookupOption[] | null; error: Error | null }>`
  - `insertBrand(name: string): Promise<{ data: LookupOption | null; error: Error | null }>`
  - `createBrand(name: string): Promise<{ data: LookupOption | null; error: Error | null }>`
  - `useCreateBrandMutation()` — `mutateAsync(name: string) → LookupOption`

- [ ] **Step 1: Write the migration file**

```sql
-- docs/migrations/RFC-027-brand-insert.sql
-- RFC-027 Inline Brand Creation. Additive: makes `brands` the first
-- product-writable lookup (anon INSERT), guarded by a case/whitespace-
-- insensitive unique index. Consistent with the app's no-auth anon model.

create policy "mvp_anon_insert_brands"
  on public.brands for insert
  to anon
  with check (true);

create unique index if not exists brands_name_ci_unique
  on public.brands (lower(btrim(name)));
```

(The controller applies this to the live DB before browser verification — see Task 3. The service handles the unique-index violation gracefully regardless.)

- [ ] **Step 2: Write the failing service test**

```ts
// src/features/inventory/services/tests/create-brand.service.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the repository layer the service depends on.
const selectBrands = vi.fn();
const insertBrand = vi.fn();
vi.mock("@/features/inventory/repositories/inventory.repository", () => ({
  selectBrands: (...args: unknown[]) => selectBrands(...args),
  insertBrand: (...args: unknown[]) => insertBrand(...args),
}));

import { createBrand } from "@/features/inventory/services/inventory.service";

beforeEach(() => {
  selectBrands.mockReset();
  insertBrand.mockReset();
});

describe("createBrand", () => {
  it("rejects empty / whitespace-only names without inserting", async () => {
    const result = await createBrand("   ");
    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    expect(insertBrand).not.toHaveBeenCalled();
  });

  it("returns the existing brand (no insert) when a normalized match exists", async () => {
    selectBrands.mockResolvedValue({
      data: [{ id: "b1", name: "Uniqlo" }],
      error: null,
    });
    const result = await createBrand("  uniqlo ");
    expect(result.data).toEqual({ id: "b1", name: "Uniqlo" });
    expect(insertBrand).not.toHaveBeenCalled();
  });

  it("inserts a new brand with preserved casing when no match", async () => {
    selectBrands.mockResolvedValue({ data: [], error: null });
    insertBrand.mockResolvedValue({
      data: { id: "b9", name: "ASICS" },
      error: null,
    });
    const result = await createBrand("  ASICS ");
    expect(insertBrand).toHaveBeenCalledWith("ASICS");
    expect(result.data).toEqual({ id: "b9", name: "ASICS" });
  });

  it("recovers from a unique-index violation by returning the existing row", async () => {
    // First fetch: empty (race). Insert: unique violation. Re-fetch: now present.
    selectBrands
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{ id: "b1", name: "Uniqlo" }],
        error: null,
      });
    insertBrand.mockResolvedValue({
      data: null,
      error: "duplicate key value violates unique constraint \"brands_name_ci_unique\"",
    });
    const result = await createBrand("Uniqlo");
    expect(result.data).toEqual({ id: "b1", name: "Uniqlo" });
    expect(result.error).toBeNull();
  });
});
```

- [ ] **Step 3: Run it — verify RED**

Run: `npx vitest run src/features/inventory/services/tests/create-brand.service.test.ts`
Expected: FAIL — `createBrand` not exported.

- [ ] **Step 4: Repository — append to `inventory.repository.ts`**

```ts
export async function selectBrands(): Promise<{
  data: LookupOption[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id, name")
    .order("name");
  if (error) {
    return { data: null, error: toError(error.message) };
  }
  return { data: (data ?? []) as LookupOption[], error: null };
}

export async function insertBrand(
  name: string,
): Promise<{ data: LookupOption | null; error: string | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("brands")
    .insert({ name })
    .select("id, name")
    .single();
  if (error) {
    return { data: null, error: error.message };
  }
  return { data: data as LookupOption, error: null };
}
```

(Note: `insertBrand` returns `error: string | null` so the service can pattern-match on the unique-violation message; `selectBrands` returns `Error | null` to match the file's other reads.)

- [ ] **Step 5: Service — append to `inventory.service.ts`**

```ts
import { findBrandByName, normalizeBrandName } from "@/domain/lookups";
import {
  insertBrand,
  selectBrands,
  // ...existing repository imports
} from "@/features/inventory/repositories/inventory.repository";

export async function createBrand(
  name: string,
): Promise<{ data: LookupOption | null; error: Error | null }> {
  const normalized = normalizeBrandName(name);
  if (!normalized) {
    return { data: null, error: new Error("Brand name is required.") };
  }

  const existing = await selectBrands();
  if (existing.error) {
    return { data: null, error: existing.error };
  }
  const match = findBrandByName(normalized, existing.data ?? []);
  if (match) {
    return { data: match, error: null };
  }

  const inserted = await insertBrand(normalized);
  if (inserted.error) {
    // Unique-index race: someone/thing created the normalized-equal brand
    // between our fetch and insert. Recover by re-fetching + resolving.
    const refetch = await selectBrands();
    const recovered = findBrandByName(normalized, refetch.data ?? []);
    if (recovered) {
      return { data: recovered, error: null };
    }
    return { data: null, error: new Error(inserted.error) };
  }
  return { data: inserted.data, error: null };
}
```

Add `LookupOption` to the file's type imports if not already present.

- [ ] **Step 6: Hook — append to `hooks/index.ts`**

```ts
export function useCreateBrandMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => unwrapData(await createBrand(name)),
    onSuccess: async (brand: LookupOption) => {
      await invalidateWardrobeQueries(queryClient);
      toast.success(`Added brand ${brand.name}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add brand.");
    },
  });
}
```

Add imports: `createBrand` from `@/features/inventory/services/inventory.service`; ensure `LookupOption` is imported. `invalidateWardrobeQueries` invalidates `wardrobeKeys.all`, which covers the inventory lookups query (item form + inventory filter). **Also check** whether purchases analytics reads brands under a different query key (`grep -rn "queryKey" src/features/purchases`); if so, invalidate that key too so the acceptance criterion "appears in purchases analytics without reload" holds.

- [ ] **Step 7: Verify GREEN + full suite**

Run: `npx vitest run src/features/inventory/services/tests/create-brand.service.test.ts` — PASS.
Run: `npx tsc --noEmit` — clean. `npm test` — green.

- [ ] **Step 8: Commit**

```bash
git add docs/migrations/RFC-027-brand-insert.sql src/features/inventory src/domain/lookups
git commit -m "feat: createBrand write path with dedupe + RLS migration (RFC-027)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: UI — "Add new brand" affordance on the Brand field

**Files:**
- Modify: `src/features/inventory/components/item-form-fields.tsx`
- Create: `src/features/inventory/components/add-brand-dialog.tsx`

**Interfaces:**
- Consumes: `useCreateBrandMutation` (Task 2); `Dialog*` from `@/components/ui/dialog`; `Input`, `Button`, `Label`; the existing `LookupSelect` in `item-form-fields.tsx`.
- Produces: a Brand field that, on picking "＋ Add new brand…", opens `AddBrandDialog`; on create, selects the new brand via the field's existing `onChange`. Nothing downstream depends on new exports.

- [ ] **Step 1: Create `AddBrandDialog`**

```tsx
// src/features/inventory/components/add-brand-dialog.tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateBrandMutation } from "@/features/inventory/hooks";

export function AddBrandDialog({
  open,
  defaultName,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  defaultName?: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (brandId: string) => void;
}) {
  const [name, setName] = useState(defaultName ?? "");
  const createBrand = useCreateBrandMutation();

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      const brand = await createBrand.mutateAsync(name);
      onCreated(brand.id);
      onOpenChange(false);
      setName("");
    } catch {
      // onError toast already shown; keep dialog + typed text for retry.
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setName(defaultName ?? "");
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add new brand</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="new-brand-name">Brand name</Label>
          <Input
            id="new-brand-name"
            value={name}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="e.g. Uniqlo"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createBrand.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!name.trim() || createBrand.isPending}
          >
            {createBrand.isPending ? "Adding…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add a creatable variant of the Brand field in `item-form-fields.tsx`**

Rather than change every `LookupSelect`, add an `onCreate`/`createLabel` path used only by the Brand field. Extend `LookupSelectProps` with an optional `onAddNew?: () => void`; when present, render a pinned item at the bottom of `SelectContent`:

```tsx
// inside LookupSelect's SelectContent, after the options.map(...)
{onAddNew ? (
  <SelectItem value="__add_new__">＋ Add new brand…</SelectItem>
) : null}
```

and intercept it in `onValueChange`:

```tsx
onValueChange={(next) => {
  if (next === "__add_new__") {
    onAddNew?.();
    return; // do not change the field value
  }
  onChange(next ? next : null);
}}
```

Then in `ItemFormFields`, manage the dialog state and wire the Brand field:

```tsx
const [addBrandOpen, setAddBrandOpen] = useState(false);
// current brand text to seed the dialog: selected name, else fallback (captured brandText), else ""
const brandSeed =
  lookups.brands.find((b) => b.id === form.brand_id)?.name ??
  labelFallbacks?.brand ??
  "";
```

```tsx
<LookupSelect
  label="Brand"
  value={form.brand_id}
  options={lookups.brands}
  fallbackLabel={labelFallbacks?.brand}
  onChange={(brand_id) => onChange({ ...form, brand_id })}
  onAddNew={() => setAddBrandOpen(true)}
/>
```

and render the dialog once (near the end of the returned fragment):

```tsx
<AddBrandDialog
  open={addBrandOpen}
  defaultName={brandSeed}
  onOpenChange={setAddBrandOpen}
  onCreated={(brand_id) => onChange({ ...form, brand_id })}
/>
```

Add `useState` to the React import and import `AddBrandDialog`.

- [ ] **Step 3: Verify types + tests**

Run: `npx tsc --noEmit` — clean. `npm test` — green (no unit tests for this UI; domain + service already covered).

- [ ] **Step 4: Apply the migration + browser-verify (item form)**

The controller applies `docs/migrations/RFC-027-brand-insert.sql` to the live DB (via the Supabase MCP) before this step. Then, in the item form (`/inventory` → Add item):
1. Open the Brand select → "＋ Add new brand…" is the last item.
2. Pick it → dialog opens → type a novel brand → Create → toast, dialog closes, the new brand is selected in the field.
3. Reopen the Brand select → the new brand is present (lookups refreshed, no page reload).
4. Add-new again with a different-casing duplicate (e.g. existing "Uniqlo" → type "uniqlo") → resolves to the existing brand, no duplicate row (confirm via the select list / a quick `select count(*)` if needed).
5. Save the item and confirm `brand_id` persisted.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/components
git commit -m "feat: add-new brand affordance on the item Brand field (RFC-027)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Promotion surfacing in the conversion wizard

**Files:**
- Modify: `src/features/shopping/components/inventory-conversion-wizard.tsx`

**Interfaces:**
- Consumes: the `labelFallbacks.brand` prop on `ItemFormFields` (exists) and the wishlist's captured brand text (`buildInventoryDraftFromWishlist` input / wishlist row).
- Produces: nothing new.

- [ ] **Step 1: Pass the captured brand text as the Brand fallback**

The wizard already renders `<ItemFormFields form={form} lookups={lookups} .../>`. When `matchLookupId` missed, `form.brand_id` is null and the captured text is otherwise invisible. Pass it through so it (a) shows as the field's fallback label and (b) seeds the Add-new dialog:

```tsx
<ItemFormFields
  form={form}
  lookups={lookups}
  filteredSubcategories={filteredSubcategories}
  onChange={handleFormChange}
  labelFallbacks={{ brand: wishlist.brandText ?? null }}
/>
```

Confirm the wishlist field name for the captured brand (`wishlist.brandText` or similar) by reading the `WizardBody` props / `buildInventoryDraftFromWishlist`; use the real field. If the draft already resolved a `brand_id`, the fallback is simply unused (the selected brand name wins).

- [ ] **Step 2: Verify types + browser (conversion wizard)**

Run: `npx tsc --noEmit` — clean.
Browser: promote an acquisition whose captured brand is NOT in the lookup → the Brand field shows the captured text as its (unselected) label; opening "＋ Add new brand…" pre-fills the dialog with that text; Create → brand created + selected; finish promotion → inventory item has the new `brand_id`. Promote another leaving brand empty → `brand_id: null` (today's behavior preserved).

- [ ] **Step 3: Commit**

```bash
git add src/features/shopping/components/inventory-conversion-wizard.tsx
git commit -m "feat: surface captured brand for inline create on promotion (RFC-027)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Final gates + docs

**Files:**
- Modify: `docs/rfc/RFC-027-Inline-Brand-Creation.md` (Status → Implemented; tick §10)
- Modify: `docs/product/BACKLOG.md`, `docs/rfc/README.md` (rows → Implemented)
- Modify: `CHANGELOG.md` (Unreleased → `### Added — RFC-027 Inline Brand Creation`)

- [ ] **Step 1: Gates** — `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` all green.
- [ ] **Step 2: Confirm migration applied** — the anon INSERT policy + unique index exist on the live `brands` table (the create path fails without them).
- [ ] **Step 3: Docs** — RFC-027 `Status: Implemented` + tick §10 acceptance criteria (honest about what was browser-verified); flip BACKLOG + README index rows; add a CHANGELOG entry under `[Unreleased]` describing inline brand creation on the item form + conversion wizard, case-insensitive dedupe, and the `brands` anon-insert migration.
- [ ] **Step 4: Commit**

```bash
git add docs CHANGELOG.md
git commit -m "docs: mark RFC-027 implemented (inline brand creation)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Release (version bump / tag / GitHub release) is a separate owner-initiated step (CLAUDE.md 13) — do not tag here.
