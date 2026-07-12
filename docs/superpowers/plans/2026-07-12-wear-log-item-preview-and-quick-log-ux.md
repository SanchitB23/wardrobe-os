# Wear-log Item Preview & Quick Log UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users preview a wardrobe item in a read-only modal (with a swap-to-edit path) from the Wear Log detail and Quick Log form, fix the clipped Quick Log dropdowns, and allow multiple items in the Top and Accessory slots.

**Architecture:** One new shared `ItemPreviewDialog` in the inventory feature (loads item detail + lookups, renders a compact read-only snapshot, swaps to the existing `ItemFormDialog` for editing). Wear Log detail and Quick Log consume it. Quick Log's slot state moves to arrays and its selection→entries mapping is extracted to a pure, unit-tested domain helper. No schema change.

**Tech Stack:** Next.js (App Router, custom build — read `node_modules/next/dist/docs/` before Next-specific work), React, TanStack Query, base-ui `Select`/`Dialog` wrappers under `components/ui`, Vitest (node environment), Tailwind.

## Global Constraints

- Components must not call Supabase directly, and must not contain business logic — they call hooks. (CLAUDE.md 2–3)
- `src/domain/**` stays pure TypeScript — no React, Supabase, AI, or I/O; deterministic. (CLAUDE.md 6)
- Add/update Vitest tests for any domain change. (CLAUDE.md 10)
- No database schema change in this work. `wear_event_items` already stores N rows per event, each with a nullable `slot` string.
- Path alias: `@/*` → repo root (`./*`); e.g. `@/components/ui/select` → `components/ui/select.tsx`. Feature/domain/shared aliases map into `src/`.
- Test runner: `environment: "node"`, `include: ["src/**/*.test.ts"]`. There is **no** React component test infra (0 `.tsx` tests). Do **not** add jsdom/testing-library. UI tasks are verified in the browser preview; only pure `.ts` logic gets Vitest tests.
- Multi-select scope (locked): **Top + Accessory** multi; **Bottom + Footwear** single.
- Preview scope (locked): compact snapshot, not a full mirror of the inventory detail page.
- Edit flow (locked): swap — while editing, the preview is hidden; closing the edit dialog returns to the preview.

---

### Task 1: Pure domain helper — Quick Log slot selection → entries

Extract and generalize Quick Log's inline `selectedEntries()` into a pure, array-based, de-duplicating helper so multiple items per slot is representable and unit-tested.

**Files:**
- Create: `src/domain/wear-logs/quick-log-selection.ts`
- Modify: `src/domain/wear-logs/index.ts`
- Test: `src/domain/wear-logs/quick-log-selection.test.ts`

**Interfaces:**
- Produces:
  - `interface WearLogSlotEntry { itemId: string; slot: string | null }`
  - `function buildWearLogSlotEntries(slotPicks: Readonly<Partial<Record<string, readonly string[]>>>, slotOrder: readonly string[], extraIds?: readonly string[]): WearLogSlotEntry[]`

- [ ] **Step 1: Write the failing test**

Create `src/domain/wear-logs/quick-log-selection.test.ts`:

```ts
/**
 * Domain tests — Quick Log slot selection → wear-event entries (RFC-023 follow-up).
 */

import { describe, expect, it } from "vitest";

import { buildWearLogSlotEntries } from "@/domain/wear-logs";

const ORDER = ["top", "bottom", "footwear", "accessory"] as const;

describe("buildWearLogSlotEntries", () => {
  it("maps one item per slot in slot order", () => {
    const entries = buildWearLogSlotEntries(
      { top: ["t1"], bottom: ["b1"], footwear: ["f1"] },
      ORDER,
    );
    expect(entries).toEqual([
      { itemId: "t1", slot: "top" },
      { itemId: "b1", slot: "bottom" },
      { itemId: "f1", slot: "footwear" },
    ]);
  });

  it("keeps multiple items within one slot", () => {
    const entries = buildWearLogSlotEntries(
      { top: ["under", "over"], accessory: ["watch", "ring"] },
      ORDER,
    );
    expect(entries).toEqual([
      { itemId: "under", slot: "top" },
      { itemId: "over", slot: "top" },
      { itemId: "watch", slot: "accessory" },
      { itemId: "ring", slot: "accessory" },
    ]);
  });

  it("appends slot-less extras and de-dupes (slotted wins)", () => {
    const entries = buildWearLogSlotEntries(
      { top: ["t1"] },
      ORDER,
      ["x1", "t1"],
    );
    expect(entries).toEqual([
      { itemId: "t1", slot: "top" },
      { itemId: "x1", slot: null },
    ]);
  });

  it("skips empty/undefined slot arrays and empty ids", () => {
    const entries = buildWearLogSlotEntries(
      { top: [], bottom: undefined, footwear: [""] },
      ORDER,
    );
    expect(entries).toEqual([]);
  });

  it("de-dupes a repeated id across slots (first occurrence wins)", () => {
    const entries = buildWearLogSlotEntries(
      { top: ["dup"], accessory: ["dup"] },
      ORDER,
    );
    expect(entries).toEqual([{ itemId: "dup", slot: "top" }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/wear-logs/quick-log-selection.test.ts`
Expected: FAIL — `buildWearLogSlotEntries` is not exported from `@/domain/wear-logs`.

- [ ] **Step 3: Write the helper**

Create `src/domain/wear-logs/quick-log-selection.ts`:

```ts
/**
 * Quick Log slot selection → wear-event item entries (RFC-023 follow-up).
 *
 * Pure: flattens per-slot item-id arrays (in slot order) plus slot-less extras
 * into ordered, de-duplicated { itemId, slot } entries for createAdHocWearLog.
 * De-dupes by itemId — first occurrence wins, so a slotted pick beats an extra.
 */

export interface WearLogSlotEntry {
  itemId: string;
  slot: string | null;
}

export function buildWearLogSlotEntries(
  slotPicks: Readonly<Partial<Record<string, readonly string[]>>>,
  slotOrder: readonly string[],
  extraIds: readonly string[] = [],
): WearLogSlotEntry[] {
  const seen = new Set<string>();
  const entries: WearLogSlotEntry[] = [];

  for (const slot of slotOrder) {
    for (const itemId of slotPicks[slot] ?? []) {
      if (!itemId || seen.has(itemId)) continue;
      seen.add(itemId);
      entries.push({ itemId, slot });
    }
  }

  for (const itemId of extraIds) {
    if (!itemId || seen.has(itemId)) continue;
    seen.add(itemId);
    entries.push({ itemId, slot: null });
  }

  return entries;
}
```

- [ ] **Step 4: Export from the domain barrel**

Modify `src/domain/wear-logs/index.ts` — append after the existing `export { ... } from "@/domain/wear-logs/WearCombination";` block:

```ts
export type { WearLogSlotEntry } from "@/domain/wear-logs/quick-log-selection";

export { buildWearLogSlotEntries } from "@/domain/wear-logs/quick-log-selection";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/domain/wear-logs/quick-log-selection.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain/wear-logs/quick-log-selection.ts src/domain/wear-logs/quick-log-selection.test.ts src/domain/wear-logs/index.ts
git commit -m "feat(wear-logs): pure helper mapping Quick Log slot picks to entries"
```

---

### Task 2: `ItemPreviewDialog` shared component

Read-only compact snapshot of an item with a swap-to-edit button. Reused by Tasks 3 and 5. No unit test (no component test infra) — verified in the browser preview during Task 6.

**Files:**
- Create: `src/features/inventory/components/item-preview-dialog.tsx`

**Interfaces:**
- Consumes: `useWardrobeItemDetail(itemId)` → `{ item, images, relations } | undefined` (item includes `primary_image_url`); `useWardrobeLookups()` → `WardrobeLookups`; existing `ItemFormDialog`, `ItemImage`, shared badges.
- Produces:
  - `type ItemPreviewDialogProps = { itemId: string | null; open: boolean; onOpenChange: (open: boolean) => void }`
  - `function ItemPreviewDialog(props: ItemPreviewDialogProps): JSX.Element`

- [ ] **Step 1: Create the component**

Create `src/features/inventory/components/item-preview-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2Icon, PencilIcon } from "lucide-react";

import { ItemFormDialog } from "@/features/inventory/components/item-form-dialog";
import { ItemImage } from "@/features/inventory/components/item-image";
import { buildItemImageAltText } from "@/features/inventory/services/images.service";
import {
  useWardrobeItemDetail,
  useWardrobeLookups,
} from "@/features/inventory/hooks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ColorSwatch,
  FormalityBadge,
  MetadataBadge,
  RatingBadge,
  StatusBadge,
  UsageBadge,
} from "@/shared/ui";
import {
  formatEnumLabel,
  type LookupOption,
  type WardrobeLookups,
} from "@/types/wardrobe";

type ItemPreviewDialogProps = {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const EMPTY_LOOKUPS: WardrobeLookups = {
  categories: [],
  subcategories: [],
  brands: [],
  colors: [],
  seasons: [],
  occasions: [],
  materials: [],
};

function PreviewField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="text-sm">
        {children ?? (value?.trim() ? value : "—")}
      </dd>
    </div>
  );
}

export function ItemPreviewDialog({
  itemId,
  open,
  onOpenChange,
}: ItemPreviewDialogProps) {
  const [editOpen, setEditOpen] = useState(false);

  const detailQuery = useWardrobeItemDetail(itemId ?? "");
  const lookupsQuery = useWardrobeLookups();

  const detail = detailQuery.data;
  const item = detail?.item;
  const lookups = lookupsQuery.data ?? EMPTY_LOOKUPS;

  return (
    <>
      {/* Preview is hidden while editing (swap), shown again when edit closes. */}
      <Dialog open={open && !editOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{item?.name ?? "Item preview"}</DialogTitle>
            <DialogDescription>
              {item ? item.code : "Loading item…"}
            </DialogDescription>
          </DialogHeader>

          {detailQuery.isPending ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
              <Loader2Icon className="size-5 animate-spin" /> Loading…
            </div>
          ) : detailQuery.isError || !item || !detail ? (
            <p className="py-8 text-center text-sm text-destructive">
              {detailQuery.error?.message ?? "Item not found."}
            </p>
          ) : (
            <div className="space-y-4">
              {item.primary_image_url ? (
                <ItemImage
                  src={item.primary_image_url}
                  alt={buildItemImageAltText(item.name, "product")}
                  containerClassName="aspect-[3/4] w-full max-w-56 rounded-lg border bg-muted/30"
                  className="h-full w-full object-cover"
                />
              ) : null}

              <div className="space-y-1">
                {item.brand?.name ? (
                  <p className="text-sm text-muted-foreground">
                    {item.brand.name}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  {item.status ? <StatusBadge status={item.status} /> : null}
                  {item.usage ? <UsageBadge usage={item.usage} /> : null}
                  {item.rating !== null ? (
                    <RatingBadge value={item.rating} />
                  ) : null}
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-3">
                <PreviewField label="Category" value={item.category?.name} />
                <PreviewField
                  label="Subcategory"
                  value={item.subcategory?.name}
                />
                <PreviewField label="Color">
                  {item.primary_color?.name ? (
                    <ColorSwatch colorName={item.primary_color.name} showLabel />
                  ) : (
                    "—"
                  )}
                </PreviewField>
                <PreviewField
                  label="Fit"
                  value={item.fit ? formatEnumLabel(item.fit) : null}
                />
                <PreviewField label="Formality">
                  {item.formality ? (
                    <FormalityBadge formality={item.formality} />
                  ) : (
                    "—"
                  )}
                </PreviewField>
              </dl>

              {detail.relations.materials.length +
                detail.relations.tags.length >
              0 ? (
                <div className="flex flex-wrap gap-2">
                  {[
                    ...detail.relations.materials,
                    ...detail.relations.tags,
                  ].map((rel: LookupOption) => (
                    <MetadataBadge key={rel.id} label={rel.name} />
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!item}
                onClick={() => setEditOpen(true)}
              >
                <PencilIcon className="size-4" /> Edit
              </Button>
              {item ? (
                <Button
                  size="sm"
                  variant="outline"
                  render={<Link href={`/inventory/${item.id}`} />}
                >
                  Open full page
                </Button>
              ) : null}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {item ? (
        <ItemFormDialog
          mode="edit"
          open={editOpen}
          item={item}
          lookups={lookups}
          onOpenChange={(next) => {
            setEditOpen(next);
            if (!next) {
              // Item attributes (incl. category/slot) may have changed.
              void detailQuery.refetch();
            }
          }}
        />
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. If `WardrobeLookups` is not exported from `@/types/wardrobe`, import it from where `ItemFormDialog` imports it (`@/types/wardrobe`) — it is used there already; keep the same source.

- [ ] **Step 3: Commit**

```bash
git add src/features/inventory/components/item-preview-dialog.tsx
git commit -m "feat(inventory): read-only ItemPreviewDialog with swap-to-edit"
```

---

### Task 3: Wire preview into Wear Log detail

Replace the worn-item link (navigates away) with a button that opens `ItemPreviewDialog`.

**Files:**
- Modify: `src/features/wear-logs/components/wear-log-detail-view.tsx`

**Interfaces:**
- Consumes: `ItemPreviewDialog` from Task 2.

- [ ] **Step 1: Add preview state and import**

In `src/features/wear-logs/components/wear-log-detail-view.tsx`, add the import near the other component imports:

```tsx
import { ItemPreviewDialog } from "@/features/inventory/components/item-preview-dialog";
```

Inside `WearLogDetailLoaded`, add state alongside the existing `useState` calls (after `const [promoteTags, setPromoteTags] = useState("");`):

```tsx
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
```

- [ ] **Step 2: Replace the item link with a preview button**

Replace the `<div>` block containing the `<Link href={`/inventory/${item.itemId}`} ...>` (currently lines ~131–142) with:

```tsx
                <div>
                  <button
                    type="button"
                    className="text-left font-medium hover:underline"
                    onClick={() => setPreviewItemId(item.itemId)}
                  >
                    {item.name}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {[item.slot, item.categoryName].filter(Boolean).join(" · ") ||
                      item.code}
                  </p>
                </div>
```

Remove the now-unused `Link` import **only if** no other `Link` usage remains in the file — note lines ~63, ~109, ~176 still use `Link`, so **keep** the `Link` import.

- [ ] **Step 3: Render the dialog**

Immediately before the closing `</div>` of the component's root (right after the promote `<Dialog>...</Dialog>` block, before the final `</div>` at the end of the returned JSX), add:

```tsx
      <ItemPreviewDialog
        itemId={previewItemId}
        open={previewItemId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewItemId(null);
        }}
      />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/wear-logs/components/wear-log-detail-view.tsx
git commit -m "feat(wear-logs): preview worn items in a modal from detail view"
```

---

### Task 4: Quick Log — full-width dropdowns + array-backed slot state

Behavior-preserving refactor: widen the dropdowns and move slot state from single ids to arrays via the Task 1 helper. UI still shows single-select dropdowns for every slot; multi UI arrives in Task 5.

**Files:**
- Modify: `src/features/wear-logs/components/quick-wear-log-view.tsx`

**Interfaces:**
- Consumes: `buildWearLogSlotEntries` from Task 1.

- [ ] **Step 1: Swap state model and imports**

In `src/features/wear-logs/components/quick-wear-log-view.tsx`:

Add import:

```tsx
import { buildWearLogSlotEntries } from "@/domain/wear-logs";
```

Change the `SlotPick` type and state (currently `type SlotPick = Partial<Record<OutfitSlot, string | null>>;` and `useState<SlotPick>({})`) to arrays:

```tsx
type SlotPick = Partial<Record<OutfitSlot, string[]>>;
```

State line stays `const [slotPicks, setSlotPicks] = useState<SlotPick>({});`.

- [ ] **Step 2: Replace `selectedEntries()` with the helper**

Delete the entire inline `selectedEntries()` function (currently lines ~75–84) and replace its call site in `handleSave` (`const selected = selectedEntries();`) with:

```tsx
    const selected = buildWearLogSlotEntries(slotPicks, QUICK_SLOTS, extraIds);
```

- [ ] **Step 3: Update the single-slot Select to read/write arrays**

In the `QUICK_SLOTS.map((slot) => { ... })` block, change `value` derivation and the `onValueChange` handler:

```tsx
            const options = itemsBySlot.get(slot) ?? [];
            const value = slotPicks[slot]?.[0] ?? "";
            return (
              <div key={slot} className="space-y-1.5">
                <Label>{def?.label ?? slot}</Label>
                <Select
                  value={value || "__none__"}
                  onValueChange={(v) =>
                    setSlotPicks((prev) => ({
                      ...prev,
                      [slot]: !v || v === "__none__" ? [] : [v],
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <span className="flex flex-1 text-left">
                      {options.find((i) => i.id === value)?.name ?? "None"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {options.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
```

- [ ] **Step 4: Widen the occasion Select**

In the "When & context" card, change the occasion `<SelectTrigger>` to full width:

```tsx
              <SelectTrigger className="w-full">
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (If TS objects to indexing `slotPicks[slot]` where `slot: OutfitSlot`, it will not — `SlotPick` is keyed by `OutfitSlot`.)

- [ ] **Step 6: Commit**

```bash
git add src/features/wear-logs/components/quick-wear-log-view.tsx
git commit -m "refactor(wear-logs): full-width Quick Log selects, array-backed slots"
```

---

### Task 5: Quick Log — multi-select for Top & Accessory + item preview buttons

Top and Accessory become add-and-chip multi-selects; every selected item gets an eye button opening `ItemPreviewDialog`.

**Files:**
- Modify: `src/features/wear-logs/components/quick-wear-log-view.tsx`

**Interfaces:**
- Consumes: `ItemPreviewDialog` from Task 2; `buildWearLogSlotEntries` from Task 1.

- [ ] **Step 1: Imports, constants, and preview state**

Add imports:

```tsx
import { EyeIcon, XIcon } from "lucide-react";
import { ItemPreviewDialog } from "@/features/inventory/components/item-preview-dialog";
```

Add a multi-slot constant near `QUICK_SLOTS`:

```tsx
const MULTI_SLOTS: OutfitSlot[] = ["top", "accessory"];
```

Add preview state inside `QuickWearLogView` (after `const [error, setError] = useState<string | null>(null);`):

```tsx
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
```

- [ ] **Step 2: Render single vs multi per slot**

Replace the entire `QUICK_SLOTS.map((slot) => { ... })` block (the single-select version from Task 4) with a branch on `MULTI_SLOTS`:

```tsx
          {QUICK_SLOTS.map((slot) => {
            const def = OUTFIT_SLOT_DEFINITIONS.find((d) => d.slot === slot);
            const options = itemsBySlot.get(slot) ?? [];
            const picked = slotPicks[slot] ?? [];
            const isMulti = MULTI_SLOTS.includes(slot);

            if (isMulti) {
              const available = options.filter((i) => !picked.includes(i.id));
              return (
                <div key={slot} className="space-y-1.5">
                  <Label>{def?.label ?? slot}</Label>
                  <Select
                    value="__none__"
                    onValueChange={(v) => {
                      if (!v || v === "__none__") return;
                      setSlotPicks((prev) => ({
                        ...prev,
                        [slot]: [...(prev[slot] ?? []), v],
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <span className="flex flex-1 text-left text-muted-foreground">
                        Add {(def?.label ?? slot).toLowerCase()}…
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Add…</SelectItem>
                      {available.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {picked.length > 0 ? (
                    <ul className="flex flex-wrap gap-2 pt-1">
                      {picked.map((id) => {
                        const item = options.find((i) => i.id === id);
                        return (
                          <li key={id}>
                            <Badge variant="outline" className="gap-1.5">
                              {item?.name ?? id.slice(0, 8)}
                              <button
                                type="button"
                                aria-label="Preview item"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() => setPreviewItemId(id)}
                              >
                                <EyeIcon className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                aria-label="Remove item"
                                className="text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                  setSlotPicks((prev) => ({
                                    ...prev,
                                    [slot]: (prev[slot] ?? []).filter(
                                      (x) => x !== id,
                                    ),
                                  }))
                                }
                              >
                                <XIcon className="size-3.5" />
                              </button>
                            </Badge>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            }

            const value = picked[0] ?? "";
            return (
              <div key={slot} className="space-y-1.5">
                <Label>{def?.label ?? slot}</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={value || "__none__"}
                    onValueChange={(v) =>
                      setSlotPicks((prev) => ({
                        ...prev,
                        [slot]: !v || v === "__none__" ? [] : [v],
                      }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <span className="flex flex-1 text-left">
                        {options.find((i) => i.id === value)?.name ?? "None"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {options.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {value ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Preview item"
                      onClick={() => setPreviewItemId(value)}
                    >
                      <EyeIcon className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
```

- [ ] **Step 3: Render the preview dialog**

Just before the closing `</div>` of the component's root return (after the actions `<div className="flex flex-wrap gap-2">...</div>`), add:

```tsx
      <ItemPreviewDialog
        itemId={previewItemId}
        open={previewItemId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewItemId(null);
            void itemsQuery.refetch();
          }
        }}
      />
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add src/features/wear-logs/components/quick-wear-log-view.tsx
git commit -m "feat(wear-logs): multi Top/Accessory + item preview in Quick Log"
```

---

### Task 6: Verification pass (tests + browser preview)

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all green (existing 73 `.ts` suites + the new `quick-log-selection.test.ts`).

- [ ] **Step 2: Typecheck the whole project**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Ensure the dev server is running with fresh env**

The worktree now has `.env.local`. If the dev server on port 3000 predates it, restart so Supabase env is picked up. Prefer the preview tools (start the worktree dev server; use a free port if 3000 is taken). Confirm the app loads without the `@supabase/ssr` URL/key error.

- [ ] **Step 4: Verify Wear Log detail preview**

Open a wear log detail (`/wear-logs/[id]`). Click an item under "Items worn":
- A modal opens showing photo + attributes (read-only).
- "Edit" hides the preview and opens the item edit form; saving succeeds; closing edit returns to the preview.
- "Open full page" navigates to `/inventory/[id]`.
- "Close" returns to the wear log.

- [ ] **Step 5: Verify Quick Log**

Open `/wear-logs/new` (Quick Log):
- Slot and occasion dropdowns are full width; long item names are not clipped.
- Bottom/Footwear are single dropdowns with an eye preview button when selected.
- Top and Accessory accept multiple items shown as chips; each chip previews and removes; the add list excludes already-picked items.
- Save a wear log with **2 tops and 2 accessories** → lands on the detail page showing all items. Confirm via the network request (or the detail page item count) that every item persisted with the right slot.

- [ ] **Step 6: Report results**

Summarize: `npm test` output, typecheck result, and a screenshot of the Quick Log multi-select and the preview modal.

---

## Self-Review Notes

- **Spec coverage:** preview modal (Tasks 2–3, 5); compact snapshot (Task 2); swap-to-edit (Task 2); dropdown width (Task 4 step 3–4); Top+Accessory multi (Task 5); preview buttons (Task 5); no schema change (all tasks); pure logic tested (Task 1); browser verification (Task 6). All spec sections mapped.
- **No schema/migration steps** — intentional; `wear_event_items` already supports N rows per slot.
- **Type consistency:** `buildWearLogSlotEntries` / `WearLogSlotEntry` names identical across Tasks 1, 4, 5. `ItemPreviewDialog` prop shape identical across Tasks 2, 3, 5. `SlotPick` is `Partial<Record<OutfitSlot, string[]>>` from Task 4 onward.
- **RLS:** no new tables/queries; not applicable.
