# Item Relations Editor — Design (RFC-026)

Date: 2026-07-12
RFC: [RFC-026](../../rfc/RFC-026-Inventory-Item-Occasions-UI.md)
Status: Approved by owner (brainstorming session, 2026-07-12)
Target: v2.3.0 · Effort: L

## Context

Catalog Review (RFC-024) flags `missing_occasion`, `missing_material`, and
`missing_season`, but the product has no UI write path for any of the three
junction tables — only JSON import writes them. Live data (2026-07-12):

- `occasions` lookup: **20 rows**, highly personal (Office Daily, Office
  Leadership, Director 1:1, Client Meeting, WFH, Gym, Travel, Airport, Brunch,
  Brewery, Date Night, Wedding, Festival, …). No seed migration needed.
- `item_occasions`: 6 links across **2 of 126** active items → ~124 items
  flagged. Backfill at scale is the primary job, not one-off edits.
- `item_materials` / `item_seasons`: plain id-only junctions (no extra
  columns); `item_occasions` additionally has `score` and `notes`.

## Decisions (owner-confirmed)

1. **Approach D — Hybrid**: explicit multi-select editing plus a deterministic
   "Suggest occasions" pre-fill. Suggestions never persist without save
   (ADR-005: AI/inference never decides; here even the inference is pure
   deterministic code).
2. **Suggest mapping — keyword match**: the domain engine emits canonical
   concepts; concepts carry synonym tokens matched against lookup names, so
   `office` → Office Daily + Office Leadership, `travel` → Travel, Airport,
   Vacation. Adapts as the lookup evolves; over-selection is acceptable
   because the user confirms before save.
3. **Scores — hidden, default null**: the editor writes links with
   `score: null`, matching import's optional-score semantics. No score UI in
   v1.
4. **Scope — all three relations**: occasions + materials + seasons edited in
   one shared form section; bulk add/remove for occasions and materials
   (seasons already have bulk actions).
5. **Create + edit**: the relations section appears on both flows; on create,
   relations save immediately after the item insert.

## Architecture

### Domain — `src/domain/inventory-relations/` (new, pure)

```ts
export type OccasionConcept = {
  concept: string;            // "office" | "home" | "gym" | "travel" | ...
  reason: string;             // e.g. "formality:business_casual", "tag:gym"
};

export function suggestOccasionConcepts(input: {
  formality: string | null;
  tags: readonly string[];
  styles: readonly string[];
  categoryName: string | null;
}): OccasionConcept[];

export function matchOccasionsToConcepts(
  concepts: readonly OccasionConcept[],
  occasions: readonly { id: string; name: string }[],
): { id: string; name: string; reason: string }[];
```

- Concept map (initial, tunable in tests): `business_casual`/`smart_casual` →
  office; `formal` → office, wedding; `casual` → home; tag/style `gym`,
  `athleisure`, `activewear` → gym; tag/style `travel` → travel; category
  keywords may add concepts (e.g. sleepwear → home).
- Synonym tokens per concept, e.g. `office: [office, work, client, interview,
  meeting]`, `home: [home, wfh, lounge]`, `travel: [travel, airport,
  vacation, trip]`, `party: [party, festival, reception, night]`. Matching is
  normalized token/substring against lookup names — deterministic, no I/O,
  fully unit-tested.

### Repository — `relations.repository.ts`

```ts
export async function replaceItemRelations(
  itemId: string,
  input: { occasionIds: string[]; materialIds: string[]; seasonIds: string[] },
): Promise<{ data: true | null; error: string | null }>;
```

Delete-all + batch-insert per table, mirroring `json-sync.repository.ts`
(the proven import write path). Occasion inserts use `score: null`.
`bulk-actions.repository.ts`: extend `RelationTable` from
`item_tags | item_seasons | item_styles` to add `item_occasions` and
`item_materials`.

### Service — `relations.service.ts`

- `fetchItemRelationSelections(itemId)` → current occasion/material/season ids
  (reuses the existing detail read).
- `saveItemRelations(itemId, selections)` → wraps `replaceItemRelations`,
  returns `{ data, error }`.
- Bulk service actions: `add_occasion` / `remove_occasion` /
  `add_material` / `remove_material` (mirror existing season actions).

### UI

| Component                   | Change                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `item-relations-fields.tsx` | New: three chip multi-selects + "Suggest occasions" button (pre-fill only) |
| `item-form-dialog.tsx`      | Fetch selections on open (edit); save relations after item upsert (create + edit) |
| `item-detail-view.tsx`      | Edit entry points on Occasions and Materials cards → edit dialog       |
| `bulk-edit-dialog.tsx`      | Add/remove occasion + material actions alongside seasons               |
| `inventory-review-view.tsx` | No rule changes; edit action now fixes all missing-relation badges     |

### Data flow

```
Item form (create/edit)
  → lookups (occasions/materials/seasons) via existing selectLookups
  → fetchItemRelationSelections (edit only)
  → [Suggest] suggestOccasionConcepts + matchOccasionsToConcepts → pre-select chips
  → Save → item upsert → saveItemRelations (replace semantics)
  → invalidate inventory + review queries → badges clear
```

Import path unchanged. Schema unchanged. RLS unchanged (import already
exercises anon writes on all three tables).

## Out of scope

- Score/notes editing UI (JSON import remains the way to set scores).
- Occasion lookup admin (add/rename occasions from settings).
- StyleDNA integration — engines keep deriving occasion suitability; explicit
  links serve Catalog Review, filters, and display.
- AI involvement of any kind.

## Testing

- **Domain**: concept map cases (formality-only, tag gym, combined, empty);
  keyword matcher (office → both Office rows, WFH ↔ home, no-match concepts,
  case/whitespace); determinism.
- **Service/repository**: replace semantics (delete + insert), error
  propagation, empty selections (clears all).
- **Manual**: single edit clears `missing_occasion`; Suggest pre-fills without
  saving; bulk add Travel to N items drops badge count; create flow saves
  relations; import regression (JSON import unchanged).
- Release gate: `npm test`, lint, `tsc`, build green (repo rule 14).
