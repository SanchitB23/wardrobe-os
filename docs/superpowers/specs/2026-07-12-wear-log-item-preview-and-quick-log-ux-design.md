# Design: Wear-log item preview & Quick Log UX refinements

Date: 2026-07-12
Author: Sanchit Bhatnagar (with Claude)
Related: RFC-023 (Ad-hoc Wear Logs & Outfit Promotion)
Status: Approved — ready for implementation planning

## Context

Post-implementation feedback on RFC-023. Four related UX gaps in the wear-logging
surfaces:

1. On the **Wear Log detail** page, tapping a worn item navigates away to the full
   `/inventory/[id]` page. The user wants an in-place, read-only preview
   (photo + key attributes) with an Edit affordance instead of losing context.
2. On the **Quick Log Wear** form, the slot/occasion `Select` dropdowns are too
   narrow and clip long item names.
3. On Quick Log, **Accessory** (and, per decision, **Top**) should allow multiple
   items — a person can wear a watch *and* a ring; an undershirt *and* an overshirt.
4. On Quick Log, each selected item should offer a **preview button** to inspect
   the item without leaving the form.

## Goals

- Preview any wardrobe item in a read-only modal from both the Wear Log detail
  and the Quick Log form, with a one-click path to edit it.
- Quick Log dropdowns display full item names.
- Quick Log supports multiple items in the Top and Accessory slots.
- Reuse existing inventory components (edit form, image, badges) rather than
  duplicating them.

## Non-goals

- No schema change. `wear_event_items` already stores N rows per event, each with
  a `slot` string, so multiple items per slot is a UI/mapping concern only.
- No refactor of the module-local rich cards in `item-detail-view.tsx`. The
  preview is a purpose-built compact snapshot.
- Bottom and Footwear stay single-select.
- No changes to other surfaces (outfits, recommendations) in this pass, though the
  preview component is built to be reusable there later.

## Decisions (locked with user)

- Preview scope: **compact snapshot** (photo + core attributes), not a full mirror
  of the inventory detail page.
- Edit flow: **swap** — the preview closes and the existing edit dialog opens in
  its place (no stacked dialogs).
- Multi-select scope: **Top + Accessory** multi; **Bottom + Footwear** single.

## Design

### Component 1 — `ItemPreviewDialog` (shared, inventory feature)

Path: `src/features/inventory/components/item-preview-dialog.tsx`

Props:

```ts
type ItemPreviewDialogProps = {
  itemId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
```

Behaviour:

- Loads `useWardrobeItemDetail(itemId)` (returns item incl. `primary_image_url`,
  images, relations) and `useWardrobeLookups()` (needed to hand off to the edit
  form). Renders a skeleton while pending and an inline error on failure.
- **Read-only compact snapshot:**
  - Photo via the existing read-only `ItemImage` (`src` = `primary_image_url`,
    `alt` from item name) — no upload/delete affordances.
  - Header: name, `code` (mono), brand.
  - Badges: `StatusBadge`, `UsageBadge`, `RatingBadge` from `@/shared/ui`.
  - Attribute grid: category, subcategory, color (`ColorSwatch`), fit,
    formality (`FormalityBadge`).
  - Materials + tags as `MetadataBadge` chips.
- **Footer:** `Edit` (primary) · `Open full page` (link to `/inventory/[id]`) ·
  `Close`.
- **Swap-to-edit:** the component owns internal edit state and renders the
  existing `ItemFormDialog` (`mode="edit"`). Clicking `Edit` sets the preview
  closed and the edit dialog open. `ItemFormDialog` already handles its own save
  + relations persistence; on its close, invalidate/refetch the item detail so a
  re-open shows fresh data.

Reuse / layering notes:

- Lives in the inventory feature and takes only an `itemId`, so wear-logs (and
  later outfits/recommendations) can consume it. The wear-logs → inventory import
  mirrors the existing pattern (inventory already imports `LogWearDialog` from
  wear-logs, `PurchaseFormDialog` from purchases).
- Component calls hooks only; no Supabase or business logic in the view.

### Component 2 — Wear Log detail

Path: `src/features/wear-logs/components/wear-log-detail-view.tsx`

- Replace the worn-item `<Link href={/inventory/${itemId}}>` (currently ~line 132)
  with a text button that sets `previewItemId` and opens the dialog.
- Render one `<ItemPreviewDialog itemId={previewItemId} open onOpenChange />` at
  the bottom of the loaded view.

### Component 3 — Quick Log dropdown width

Path: `src/features/wear-logs/components/quick-wear-log-view.tsx`

- Root cause: `SelectTrigger` in `components/ui/select.tsx` is `w-fit` (sizes to
  its content, e.g. "None"), and `SelectContent` (popup) is `w-(--anchor-width)`,
  so the popup inherits the narrow trigger width and clips long names.
- Fix: pass `className="w-full"` to the occasion trigger and every slot trigger in
  Quick Log. A full-width trigger yields a full-width popup. Targeted per-usage
  fix; the shared `select.tsx` default (`w-fit`) is unchanged to avoid affecting
  other selects.

### Component 4 — Quick Log multi-slots + preview buttons

Path: `src/features/wear-logs/components/quick-wear-log-view.tsx`

- **State model** unifies to arrays:
  `slotPicks: Partial<Record<OutfitSlot, string[]>>`.
  - Bottom, Footwear: single Select backed by a length-0/1 array.
  - Top, Accessory: an "Add…" Select (options = slot items not already picked) plus
    removable chips for each selected item (mirrors the existing `extraIds` chip UI
    and the `ItemRelationsFields` toggle-chip style).
- `selectedEntries()` flat-maps every slot's array into
  `{ itemId, slot }` entries, de-duped by `itemId`. Multiple `slot:'top'` or
  `slot:'accessory'` rows are valid; `wear_event_items` stores them as N rows, and
  the combination key is an order-insensitive unique set — no schema impact.
- **Preview button:** a small eye-icon button next to each single-slot value and on
  each multi-slot chip, opening the shared `ItemPreviewDialog` for that item.
- Because editing an item from the preview can change its slot/category, closing
  the preview refetches the item list (or invalidates the relevant query) so Quick
  Log's slot buckets (`itemsBySlot`) stay correct.

## Data / schema impact

None. Confirmed: `wear_event_items` = N rows per event, each with `item_id`,
nullable `slot`, `sort_order`. Multiple items sharing a slot is already
representable and analytics count per-item facts regardless of slot.

## Architecture compliance

- Components → hooks → services → repositories preserved; no Supabase in
  components; no business logic in views.
- No domain/engine/schema change ⇒ no new Vitest domain tests required
  (per CLAUDE.md rule 10, which scopes required tests to domain/engine changes).

## Testing / verification

- Browser preview (dev server) verification:
  - Wear Log detail: item row opens preview; Edit swaps to the edit form; saving
    reflects back; "Open full page" navigates.
  - Quick Log: dropdowns show full names; Top and Accessory accept multiple items
    with working chip removal; preview button opens the dialog.
  - Multi-item write path: log a wear with 2 accessories + 2 tops → verify the
    saved event has all rows (correct `slot`s) and lands on the detail page showing
    every item.
- Existing Vitest suite stays green (`npm test`).

## Risks

| Risk | Mitigation |
| --- | --- |
| Nested dialog focus/scroll issues | Swap (not stack) — only one dialog open at a time |
| Stale slot buckets after in-preview edit | Refetch item list on preview close |
| `w-full` clips on very narrow viewports | Item text truncates with ellipsis; acceptable for mobile |
| Multi-slot state regressions in `selectedEntries` | Manual multi-item log verification before completion |

## Out of scope / future

- Adopt `ItemPreviewDialog` on outfit detail and recommendation surfaces.
- Optional: allow Bottom/Footwear multi if layering demand emerges.
