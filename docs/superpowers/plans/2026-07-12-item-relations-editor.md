# Item Relations Editor (RFC-026) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner edit item occasions, materials, and seasons from the item form (create + edit), with deterministic occasion suggestions and bulk add/remove — clearing Catalog Review's missing-relation badges.

**Architecture:** Pure domain module (`src/domain/inventory-relations/`) for suggestion concepts, keyword matching, and relation diffing; repository applies diffs to the three junction tables; a shared `ItemRelationsFields` chip component slots into the existing `ItemFormDialog`; bulk actions extend the proven tag/season/style pattern.

**Tech Stack:** Next.js App Router, React, TanStack Query, Supabase (anon client), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-12-rfc-026-item-relations-editor-design.md` · **RFC:** `docs/rfc/RFC-026-Inventory-Item-Occasions-UI.md` (Approved)

## Global Constraints

- Feature-first layering: components → hooks → services → repositories → Supabase. Components never call Supabase or hold business logic (CLAUDE.md rules 1–5).
- `src/domain/**` stays pure TypeScript — no React, Supabase, or I/O (rule 6).
- Services return `{ data, error }`.
- No AI anywhere in this feature. Suggestions are deterministic domain code.
- No schema changes. Tables `occasions`, `materials`, `seasons`, `item_occasions`, `item_materials`, `item_seasons` and their anon RLS policies already exist (import writes them today).
- **Occasion rows may carry `score`/`notes` set via JSON import. Editing must never clobber them: use diff semantics (delete removed, insert added, leave kept rows untouched) — NOT delete-all + reinsert.**
- New occasion links insert with no score/notes (columns stay null).
- Conventional commits; end commit messages with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `npm test` must be green before any release tag (rule 14).
- This is NOT the Next.js you know (AGENTS.md): if you touch Next-specific APIs, check `node_modules/next/dist/docs/` first. This plan touches none.

---

### Task 1: Domain — relation diff helper

**Files:**
- Create: `src/domain/inventory-relations/RelationDiff.ts`
- Create: `src/domain/inventory-relations/index.ts`
- Test: `src/domain/inventory-relations/tests/relation-diff.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `diffIds(current: readonly string[], next: readonly string[]): { toInsert: string[]; toDelete: string[] }` and `type RelationSelections = { occasionIds: string[]; materialIds: string[]; seasonIds: string[] }` — used by Task 2 (repository) and Task 5 (dialog).

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/inventory-relations/tests/relation-diff.test.ts
import { describe, expect, it } from "vitest";

import { diffIds } from "@/domain/inventory-relations";

describe("diffIds", () => {
  it("computes inserts and deletes", () => {
    expect(diffIds(["a", "b"], ["b", "c"])).toEqual({
      toInsert: ["c"],
      toDelete: ["a"],
    });
  });

  it("returns empty diff for identical sets", () => {
    expect(diffIds(["a", "b"], ["b", "a"])).toEqual({
      toInsert: [],
      toDelete: [],
    });
  });

  it("handles empty current (all inserts)", () => {
    expect(diffIds([], ["a"])).toEqual({ toInsert: ["a"], toDelete: [] });
  });

  it("handles empty next (all deletes)", () => {
    expect(diffIds(["a"], [])).toEqual({ toInsert: [], toDelete: ["a"] });
  });

  it("dedupes repeated ids in next", () => {
    expect(diffIds([], ["a", "a"])).toEqual({ toInsert: ["a"], toDelete: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/inventory-relations/tests/relation-diff.test.ts`
Expected: FAIL — cannot resolve `@/domain/inventory-relations`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/inventory-relations/RelationDiff.ts
/**
 * Pure diff of junction-table ids (RFC-026). Diff semantics — not
 * delete-all + reinsert — so kept item_occasions rows retain their
 * import-provided score/notes.
 */

export type RelationSelections = {
  occasionIds: string[];
  materialIds: string[];
  seasonIds: string[];
};

export function diffIds(
  current: readonly string[],
  next: readonly string[],
): { toInsert: string[]; toDelete: string[] } {
  const currentSet = new Set(current);
  const nextSet = new Set(next);
  return {
    toInsert: [...nextSet].filter((id) => !currentSet.has(id)),
    toDelete: [...currentSet].filter((id) => !nextSet.has(id)),
  };
}
```

```ts
// src/domain/inventory-relations/index.ts
export { diffIds, type RelationSelections } from "@/domain/inventory-relations/RelationDiff";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/inventory-relations/tests/relation-diff.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/inventory-relations
git commit -m "feat: add relation diff domain helper (RFC-026)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Domain — occasion suggestion engine

**Files:**
- Create: `src/domain/inventory-relations/OccasionSuggestions.ts`
- Modify: `src/domain/inventory-relations/index.ts`
- Test: `src/domain/inventory-relations/tests/occasion-suggestions.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (used by Task 4's UI component):

```ts
export type OccasionConcept = { concept: string; reason: string };
export type SuggestOccasionsInput = {
  formality: string | null;
  tags: readonly string[];
  styles: readonly string[];
  categoryName: string | null;
};
export function suggestOccasionConcepts(input: SuggestOccasionsInput): OccasionConcept[];
export function matchOccasionsToConcepts(
  concepts: readonly OccasionConcept[],
  occasions: readonly { id: string; name: string }[],
): { id: string; name: string; reason: string }[];
```

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/inventory-relations/tests/occasion-suggestions.test.ts
import { describe, expect, it } from "vitest";

import {
  matchOccasionsToConcepts,
  suggestOccasionConcepts,
} from "@/domain/inventory-relations";

// Mirrors the live lookup (personal taxonomy — RFC-026 design decision 2).
const LOOKUP = [
  { id: "o1", name: "Office Daily" },
  { id: "o2", name: "Office Leadership" },
  { id: "o3", name: "WFH" },
  { id: "o4", name: "Home" },
  { id: "o5", name: "Gym" },
  { id: "o6", name: "Travel" },
  { id: "o7", name: "Airport" },
  { id: "o8", name: "Vacation" },
  { id: "o9", name: "Wedding" },
  { id: "o10", name: "Reception" },
  { id: "o11", name: "Brewery" },
  { id: "o12", name: "Client Meeting" },
];

describe("suggestOccasionConcepts", () => {
  it("maps business_casual formality to office", () => {
    const concepts = suggestOccasionConcepts({
      formality: "business_casual",
      tags: [],
      styles: [],
      categoryName: null,
    });
    expect(concepts.map((c) => c.concept)).toContain("office");
    expect(concepts.find((c) => c.concept === "office")?.reason).toBe(
      "formality:business_casual",
    );
  });

  it("maps formal formality to office and wedding", () => {
    const concepts = suggestOccasionConcepts({
      formality: "formal",
      tags: [],
      styles: [],
      categoryName: null,
    }).map((c) => c.concept);
    expect(concepts).toContain("office");
    expect(concepts).toContain("wedding");
  });

  it("maps casual formality to home", () => {
    const concepts = suggestOccasionConcepts({
      formality: "casual",
      tags: [],
      styles: [],
      categoryName: null,
    }).map((c) => c.concept);
    expect(concepts).toContain("home");
  });

  it("maps gym/athleisure tags and styles to gym", () => {
    const fromTag = suggestOccasionConcepts({
      formality: null,
      tags: ["gym wear"],
      styles: [],
      categoryName: null,
    });
    const fromStyle = suggestOccasionConcepts({
      formality: null,
      tags: [],
      styles: ["Athleisure"],
      categoryName: null,
    });
    expect(fromTag.map((c) => c.concept)).toContain("gym");
    expect(fromTag.find((c) => c.concept === "gym")?.reason).toBe("tag:gym wear");
    expect(fromStyle.map((c) => c.concept)).toContain("gym");
  });

  it("maps travel tag to travel", () => {
    const concepts = suggestOccasionConcepts({
      formality: null,
      tags: ["Travel"],
      styles: [],
      categoryName: null,
    }).map((c) => c.concept);
    expect(concepts).toContain("travel");
  });

  it("maps sleepwear category to home", () => {
    const concepts = suggestOccasionConcepts({
      formality: null,
      tags: [],
      styles: [],
      categoryName: "Sleepwear",
    }).map((c) => c.concept);
    expect(concepts).toContain("home");
  });

  it("dedupes concepts from multiple signals", () => {
    const concepts = suggestOccasionConcepts({
      formality: "business_casual",
      tags: ["office"],
      styles: [],
      categoryName: null,
    });
    expect(concepts.filter((c) => c.concept === "office")).toHaveLength(1);
  });

  it("returns empty for no signals", () => {
    expect(
      suggestOccasionConcepts({
        formality: null,
        tags: [],
        styles: [],
        categoryName: null,
      }),
    ).toEqual([]);
  });
});

describe("matchOccasionsToConcepts", () => {
  it("office matches both Office rows and Client Meeting", () => {
    const matches = matchOccasionsToConcepts(
      [{ concept: "office", reason: "formality:business_casual" }],
      LOOKUP,
    );
    expect(matches.map((m) => m.name).sort()).toEqual([
      "Client Meeting",
      "Office Daily",
      "Office Leadership",
    ]);
  });

  it("home matches Home and WFH", () => {
    const matches = matchOccasionsToConcepts(
      [{ concept: "home", reason: "formality:casual" }],
      LOOKUP,
    ).map((m) => m.name);
    expect(matches.sort()).toEqual(["Home", "WFH"]);
  });

  it("travel matches Travel, Airport, Vacation", () => {
    const matches = matchOccasionsToConcepts(
      [{ concept: "travel", reason: "tag:travel" }],
      LOOKUP,
    ).map((m) => m.name);
    expect(matches.sort()).toEqual(["Airport", "Travel", "Vacation"]);
  });

  it("never matches unrelated occasions (Brewery)", () => {
    const all = matchOccasionsToConcepts(
      [
        { concept: "office", reason: "r" },
        { concept: "home", reason: "r" },
        { concept: "gym", reason: "r" },
        { concept: "travel", reason: "r" },
        { concept: "wedding", reason: "r" },
      ],
      LOOKUP,
    ).map((m) => m.name);
    expect(all).not.toContain("Brewery");
  });

  it("dedupes an occasion matched by multiple concepts, keeping first reason", () => {
    const matches = matchOccasionsToConcepts(
      [
        { concept: "office", reason: "first" },
        { concept: "office", reason: "second" },
      ],
      LOOKUP,
    );
    expect(matches.filter((m) => m.id === "o1")).toHaveLength(1);
    expect(matches.find((m) => m.id === "o1")?.reason).toBe("first");
  });

  it("matching is case- and whitespace-insensitive", () => {
    const matches = matchOccasionsToConcepts(
      [{ concept: "gym", reason: "r" }],
      [{ id: "x", name: "  GYM  " }],
    );
    expect(matches).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/inventory-relations/tests/occasion-suggestions.test.ts`
Expected: FAIL — `suggestOccasionConcepts` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/domain/inventory-relations/OccasionSuggestions.ts
/**
 * Deterministic occasion suggestions (RFC-026, Option D + keyword match).
 * Emits canonical concepts from formality/tags/styles/category, then matches
 * concepts to the user's personal occasion lookup via synonym tokens.
 * Pure — no I/O, no AI. Suggestions only pre-fill UI; the user confirms.
 */

export type OccasionConcept = {
  concept: string;
  reason: string;
};

export type SuggestOccasionsInput = {
  formality: string | null;
  tags: readonly string[];
  styles: readonly string[];
  categoryName: string | null;
};

const FORMALITY_CONCEPTS: Record<string, string[]> = {
  casual: ["home"],
  smart_casual: ["office"],
  business_casual: ["office"],
  business: ["office"],
  formal: ["office", "wedding"],
};

/** Signal keyword → concept (matched against tag/style/category tokens). */
const SIGNAL_CONCEPTS: Record<string, string> = {
  gym: "gym",
  athleisure: "gym",
  activewear: "gym",
  workout: "gym",
  sport: "gym",
  travel: "travel",
  vacation: "travel",
  lounge: "home",
  sleep: "home",
  sleepwear: "home",
  pajama: "home",
  home: "home",
  office: "office",
  work: "office",
  wedding: "wedding",
  festive: "wedding",
};

/** Concept → synonym tokens matched against occasion lookup names. */
const CONCEPT_SYNONYMS: Record<string, string[]> = {
  office: ["office", "work", "client", "interview", "meeting"],
  home: ["home", "wfh", "lounge"],
  gym: ["gym", "workout", "training"],
  travel: ["travel", "airport", "vacation", "trip"],
  wedding: ["wedding", "reception"],
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function suggestOccasionConcepts(
  input: SuggestOccasionsInput,
): OccasionConcept[] {
  const seen = new Set<string>();
  const concepts: OccasionConcept[] = [];

  function add(concept: string, reason: string) {
    if (seen.has(concept)) return;
    seen.add(concept);
    concepts.push({ concept, reason });
  }

  if (input.formality) {
    for (const concept of FORMALITY_CONCEPTS[normalize(input.formality)] ?? []) {
      add(concept, `formality:${input.formality}`);
    }
  }

  const signals: Array<{ value: string; source: string }> = [
    ...input.tags.map((tag) => ({ value: tag, source: `tag:${tag}` })),
    ...input.styles.map((style) => ({ value: style, source: `style:${style}` })),
    ...(input.categoryName
      ? [{ value: input.categoryName, source: `category:${input.categoryName}` }]
      : []),
  ];

  for (const signal of signals) {
    const haystack = normalize(signal.value);
    for (const [keyword, concept] of Object.entries(SIGNAL_CONCEPTS)) {
      if (haystack.includes(keyword)) {
        add(concept, signal.source);
      }
    }
  }

  return concepts;
}

export function matchOccasionsToConcepts(
  concepts: readonly OccasionConcept[],
  occasions: readonly { id: string; name: string }[],
): { id: string; name: string; reason: string }[] {
  const matches = new Map<string, { id: string; name: string; reason: string }>();

  for (const concept of concepts) {
    const synonyms = CONCEPT_SYNONYMS[concept.concept] ?? [concept.concept];
    for (const occasion of occasions) {
      if (matches.has(occasion.id)) continue;
      const name = normalize(occasion.name);
      if (synonyms.some((synonym) => name.includes(synonym))) {
        matches.set(occasion.id, {
          id: occasion.id,
          name: occasion.name,
          reason: concept.reason,
        });
      }
    }
  }

  return [...matches.values()];
}
```

Update the barrel:

```ts
// src/domain/inventory-relations/index.ts
export {
  diffIds,
  type RelationSelections,
} from "@/domain/inventory-relations/RelationDiff";
export {
  matchOccasionsToConcepts,
  suggestOccasionConcepts,
  type OccasionConcept,
  type SuggestOccasionsInput,
} from "@/domain/inventory-relations/OccasionSuggestions";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/inventory-relations/`
Expected: PASS (all tests, both files).

- [ ] **Step 5: Commit**

```bash
git add src/domain/inventory-relations
git commit -m "feat: deterministic occasion suggestion engine (RFC-026)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Lookups — occasions + materials in WardrobeLookups and BulkEditLookups

**Files:**
- Modify: `types/wardrobe.ts:19-25` (`WardrobeLookups`) and `types/wardrobe.ts:616-620` (`BulkEditLookups`)
- Modify: `src/features/inventory/repositories/inventory.repository.ts:360-401` (`selectLookups`)
- Modify: `src/features/inventory/repositories/bulk-actions.repository.ts:159-184` (`selectBulkEditLookups`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `WardrobeLookups` gains `occasions: LookupOption[]` and `materials: LookupOption[]`; `BulkEditLookups` gains the same two fields. Tasks 4–6 rely on `lookups.occasions` / `lookups.materials` existing on both types.

- [ ] **Step 1: Extend the types**

In `types/wardrobe.ts`:

```ts
export type WardrobeLookups = {
  categories: LookupOption[];
  subcategories: SubcategoryOption[];
  brands: LookupOption[];
  colors: LookupOption[];
  seasons: LookupOption[];
  occasions: LookupOption[];
  materials: LookupOption[];
};
```

```ts
export type BulkEditLookups = {
  tags: LookupOption[];
  seasons: LookupOption[];
  styles: LookupOption[];
  occasions: LookupOption[];
  materials: LookupOption[];
};
```

Note: `WardrobeImportLookups` (`types/wardrobe.ts:27`) already declares `materials`/`occasions`, so the extension stays compatible.

- [ ] **Step 2: Extend `selectLookups` in `inventory.repository.ts`**

Add two queries to the existing `Promise.all` (pattern-match the seasons line):

```ts
const [
  categoriesResult,
  subcategoriesResult,
  brandsResult,
  colorsResult,
  seasonsResult,
  occasionsResult,
  materialsResult,
] = await Promise.all([
  supabase.from("categories").select("id, name").order("name"),
  supabase.from("subcategories").select("id, name, category_id").order("name"),
  supabase.from("brands").select("id, name").order("name"),
  supabase.from("colors").select("id, name").order("name"),
  supabase.from("seasons").select("id, name").order("name"),
  supabase.from("occasions").select("id, name").order("name"),
  supabase.from("materials").select("id, name").order("name"),
]);
```

Extend `firstError` with `?? occasionsResult.error ?? materialsResult.error` and the return object with:

```ts
occasions: (occasionsResult.data ?? []) as LookupOption[],
materials: (materialsResult.data ?? []) as LookupOption[],
```

- [ ] **Step 3: Extend `selectBulkEditLookups` in `bulk-actions.repository.ts`** (same pattern)

```ts
const [tagsResult, seasonsResult, stylesResult, occasionsResult, materialsResult] =
  await Promise.all([
    supabase.from("tags").select("id, name").order("name"),
    supabase.from("seasons").select("id, name").order("name"),
    supabase.from("styles").select("id, name").order("name"),
    supabase.from("occasions").select("id, name").order("name"),
    supabase.from("materials").select("id, name").order("name"),
  ]);
```

Extend `firstError` and return `occasions: occasionsResult.data ?? []`, `materials: materialsResult.data ?? []`.

- [ ] **Step 4: Typecheck — find every other constructor of these types**

Run: `npx tsc --noEmit`
Expected: errors ONLY where object literals build `WardrobeLookups`/`BulkEditLookups` without the new fields (e.g. `bulk-edit-dialog.tsx:277` fallback `{ tags: [], seasons: [], styles: [] }` → add `occasions: [], materials: []`). Fix each reported site the same way. Re-run until clean.

- [ ] **Step 5: Run tests and commit**

Run: `npm test` — Expected: PASS (no behavior change).

```bash
git add types/wardrobe.ts src/features/inventory
git commit -m "feat: add occasions and materials to wardrobe lookups (RFC-026)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Repository + service — save item relations with diff semantics

**Files:**
- Modify: `src/features/inventory/repositories/relations.repository.ts` (append)
- Modify: `src/features/inventory/services/relations.service.ts` (append)
- Modify: `src/features/inventory/hooks/index.ts` (append mutation hook)

**Interfaces:**
- Consumes: `diffIds`, `RelationSelections` from `@/domain/inventory-relations` (Task 1); existing `selectItemRelationIds` (`relations.repository.ts:35`); existing `invalidateWardrobeQueries`, `wardrobeKeys`, `unwrapData`, `toast` patterns in `hooks/index.ts` (see `useBulkEditMutation` at `hooks/index.ts:349`).
- Produces:
  - Repository: `applyItemRelationDiffs(itemId: string, diffs: { table: "item_occasions" | "item_materials" | "item_seasons"; idColumn: "occasion_id" | "material_id" | "season_id"; toInsert: string[]; toDelete: string[] }[]): Promise<{ data: true | null; error: Error | null }>`
  - Service: `saveItemRelations(itemId: string, selections: RelationSelections): Promise<{ data: true | null; error: Error | null }>`
  - Hook: `useSaveItemRelationsMutation()` — `mutateAsync({ itemId, selections })`. Task 5's dialog calls this.

- [ ] **Step 1: Repository — append to `relations.repository.ts`**

```ts
type RelationDiffSpec = {
  table: "item_occasions" | "item_materials" | "item_seasons";
  idColumn: "occasion_id" | "material_id" | "season_id";
  toInsert: string[];
  toDelete: string[];
};

/**
 * Applies id diffs to the item's junction tables. Diff semantics keep
 * untouched rows intact, so item_occasions score/notes from import survive
 * an edit that doesn't deselect them (RFC-026).
 */
export async function applyItemRelationDiffs(
  itemId: string,
  diffs: RelationDiffSpec[],
): Promise<{ data: true | null; error: Error | null }> {
  const supabase = createClient();

  for (const diff of diffs) {
    if (diff.toDelete.length > 0) {
      const { error } = await supabase
        .from(diff.table)
        .delete()
        .eq("item_id", itemId)
        .in(diff.idColumn, diff.toDelete);
      if (error) {
        return { data: null, error: toError(error.message) };
      }
    }

    if (diff.toInsert.length > 0) {
      const { error } = await supabase.from(diff.table).insert(
        diff.toInsert.map((relationId) => ({
          item_id: itemId,
          [diff.idColumn]: relationId,
        })),
      );
      if (error) {
        return { data: null, error: toError(error.message) };
      }
    }
  }

  return { data: true, error: null };
}
```

- [ ] **Step 2: Service — append to `relations.service.ts`**

```ts
import { diffIds, type RelationSelections } from "@/domain/inventory-relations";
import {
  applyItemRelationDiffs,
  // ...existing imports
} from "@/features/inventory/repositories/relations.repository";

export async function saveItemRelations(
  itemId: string,
  selections: RelationSelections,
): Promise<{ data: true | null; error: Error | null }> {
  const currentResult = await selectItemRelationIds(itemId);
  if (currentResult.error || !currentResult.data) {
    return {
      data: null,
      error: currentResult.error ?? new Error("Item relations not found."),
    };
  }

  const currentOccasionIds = currentResult.data.occasions
    .map((row) => row.occasion_id)
    .filter((id): id is string => Boolean(id));

  const occasionDiff = diffIds(currentOccasionIds, selections.occasionIds);
  const materialDiff = diffIds(
    currentResult.data.materialIds,
    selections.materialIds,
  );
  const seasonDiff = diffIds(currentResult.data.seasonIds, selections.seasonIds);

  return applyItemRelationDiffs(itemId, [
    { table: "item_occasions", idColumn: "occasion_id", ...occasionDiff },
    { table: "item_materials", idColumn: "material_id", ...materialDiff },
    { table: "item_seasons", idColumn: "season_id", ...seasonDiff },
  ]);
}
```

- [ ] **Step 3: Hook — append to `src/features/inventory/hooks/index.ts`** (pattern-match `useBulkEditMutation` at line 349 for imports/toast style)

```ts
export function useSaveItemRelationsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      itemId: string;
      selections: RelationSelections;
    }) => unwrapData(await saveItemRelations(input.itemId, input.selections)),
    onSuccess: async (_result, input) => {
      await invalidateWardrobeQueries(queryClient);
      await queryClient.invalidateQueries({
        queryKey: wardrobeKeys.itemRelations(input.itemId),
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save item relations.");
    },
  });
}
```

Add imports: `saveItemRelations` from `@/features/inventory/services/relations.service`, `type RelationSelections` from `@/domain/inventory-relations`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm test` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory src/domain/inventory-relations
git commit -m "feat: save item relations with score-preserving diff semantics (RFC-026)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: UI — ItemRelationsFields component + form dialog wiring

**Files:**
- Create: `src/features/inventory/components/item-relations-fields.tsx`
- Modify: `src/features/inventory/components/item-form-dialog.tsx`

**Interfaces:**
- Consumes: `suggestOccasionConcepts`, `matchOccasionsToConcepts`, `type RelationSelections` (Task 2/1); `useSaveItemRelationsMutation` (Task 4); existing `useWardrobeItemRelations(itemId)` (`hooks/index.ts:304`); `lookups.occasions` / `lookups.materials` / `lookups.seasons` (Task 3); UI primitives `Badge`, `Button`, `Label` from `components/ui/`.
- Produces: `<ItemRelationsFields selections lookups suggestInput onChange disabled />` — self-contained; nothing downstream consumes it besides the dialog.

- [ ] **Step 1: Create `item-relations-fields.tsx`**

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  matchOccasionsToConcepts,
  suggestOccasionConcepts,
  type RelationSelections,
  type SuggestOccasionsInput,
} from "@/domain/inventory-relations";
import type { LookupOption } from "@/types/wardrobe";

type RelationLookups = {
  occasions: LookupOption[];
  materials: LookupOption[];
  seasons: LookupOption[];
};

type ItemRelationsFieldsProps = {
  selections: RelationSelections;
  lookups: RelationLookups;
  suggestInput: SuggestOccasionsInput;
  onChange: (next: RelationSelections) => void;
  disabled?: boolean;
};

function ChipGroup({
  label,
  options,
  selectedIds,
  onToggle,
  disabled,
  emptyHint,
  action,
}: {
  label: string;
  options: LookupOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
  emptyHint: string;
  action?: React.ReactNode;
}) {
  const selected = new Set(selectedIds);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {action}
      </div>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyHint}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => {
            const isSelected = selected.has(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                onClick={() => onToggle(option.id)}
                aria-pressed={isSelected}
              >
                <Badge variant={isSelected ? "default" : "outline"}>
                  {option.name}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

export function ItemRelationsFields({
  selections,
  lookups,
  suggestInput,
  onChange,
  disabled = false,
}: ItemRelationsFieldsProps) {
  function handleSuggest() {
    const concepts = suggestOccasionConcepts(suggestInput);
    const matches = matchOccasionsToConcepts(concepts, lookups.occasions);
    const merged = new Set([
      ...selections.occasionIds,
      ...matches.map((match) => match.id),
    ]);
    onChange({ ...selections, occasionIds: [...merged] });
  }

  return (
    <div className="space-y-4">
      <ChipGroup
        label="Occasions"
        options={lookups.occasions}
        selectedIds={selections.occasionIds}
        onToggle={(id) =>
          onChange({ ...selections, occasionIds: toggleId(selections.occasionIds, id) })
        }
        disabled={disabled}
        emptyHint="No occasions in lookup — add rows via import."
        action={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || lookups.occasions.length === 0}
            onClick={handleSuggest}
          >
            Suggest
          </Button>
        }
      />
      <ChipGroup
        label="Materials"
        options={lookups.materials}
        selectedIds={selections.materialIds}
        onToggle={(id) =>
          onChange({ ...selections, materialIds: toggleId(selections.materialIds, id) })
        }
        disabled={disabled}
        emptyHint="No materials in lookup — add rows via import."
      />
      <ChipGroup
        label="Seasons"
        options={lookups.seasons}
        selectedIds={selections.seasonIds}
        onToggle={(id) =>
          onChange({ ...selections, seasonIds: toggleId(selections.seasonIds, id) })
        }
        disabled={disabled}
        emptyHint="No seasons in lookup — add rows via import."
      />
    </div>
  );
}
```

- [ ] **Step 2: Wire into `item-form-dialog.tsx`**

Inside `ItemFormDialogBody` (after the existing `useState` calls at `item-form-dialog.tsx:44-48`):

```tsx
const EMPTY_SELECTIONS: RelationSelections = {
  occasionIds: [],
  materialIds: [],
  seasonIds: [],
};

const [selections, setSelections] = useState<RelationSelections>(EMPTY_SELECTIONS);
const [selectionsPrefilled, setSelectionsPrefilled] = useState(!isEdit);

const relationsQuery = useWardrobeItemRelations(isEdit && item ? item.id : "");
const saveRelationsMutation = useSaveItemRelationsMutation();

useEffect(() => {
  if (selectionsPrefilled || !relationsQuery.data) return;
  const relations = relationsQuery.data;
  setSelections({
    occasionIds: relations.occasions
      .map((occasion) => occasion.occasion?.id)
      .filter((id): id is string => Boolean(id)),
    materialIds: relations.materials.map((material) => material.id),
    seasonIds: relations.seasons.map((season) => season.id),
  });
  setSelectionsPrefilled(true);
}, [relationsQuery.data, selectionsPrefilled]);
```

Build the suggest input (below `filteredSubcategories`):

```tsx
const suggestInput = useMemo(
  () => ({
    formality: formForDisplay.formality ?? null,
    tags: relationsQuery.data?.tags.map((tag) => tag.name) ?? [],
    styles: relationsQuery.data?.styles.map((style) => style.name) ?? [],
    categoryName:
      lookups.categories.find(
        (category) => category.id === formForDisplay.category_id,
      )?.name ?? null,
  }),
  [formForDisplay.formality, formForDisplay.category_id, relationsQuery.data, lookups.categories],
);
```

In `handleSubmit`, after `savedItem` resolves and BEFORE the image upload block (`item-form-dialog.tsx:116`):

```tsx
const hasSelections =
  selections.occasionIds.length > 0 ||
  selections.materialIds.length > 0 ||
  selections.seasonIds.length > 0;

if (isEdit ? selectionsPrefilled : hasSelections) {
  await saveRelationsMutation.mutateAsync({
    itemId: savedItem.id,
    selections,
  });
}
```

(Edit mode saves only after prefill completed — never clobbers relations with an empty state that hadn't loaded. Create mode skips the call when nothing was selected.)

Render the section after `<ItemFormFields …/>` (`item-form-dialog.tsx:176`):

```tsx
<ItemRelationsFields
  selections={selections}
  lookups={{
    occasions: lookups.occasions,
    materials: lookups.materials,
    seasons: lookups.seasons,
  }}
  suggestInput={suggestInput}
  onChange={setSelections}
  disabled={submitting || (isEdit && !selectionsPrefilled)}
/>
```

Extend `submitting` with `|| saveRelationsMutation.isPending` and `mutationError` with `?? saveRelationsMutation.error`. Add imports: `useEffect` from react, `ItemRelationsFields`, `useSaveItemRelationsMutation`, `useWardrobeItemRelations`, `type RelationSelections`.

- [ ] **Step 3: Verify types and tests**

Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm test` — Expected: PASS.

- [ ] **Step 4: Browser-verify (dev server via preview tools, `/inventory`)**

1. Edit an item that has import-set occasions with scores → chips pre-selected → save WITHOUT changing them → reopen → scores still visible on item detail (diff semantics proof).
2. Edit a flagged item (e.g. a Pocket Square) → select occasions → save → `/inventory/review` Missing Metadata count drops.
3. Set formality to `business_casual` → Suggest → Office Daily/Office Leadership/Client Meeting pre-select, nothing saves until Save.
4. Create a new item with occasions + seasons → item detail shows them.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/components
git commit -m "feat: item relations editor in item form with occasion suggest (RFC-026)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Bulk actions — add/remove occasion and material

**Files:**
- Modify: `types/wardrobe.ts:622-662` (`BulkEditAction`, `BULK_EDIT_ACTION_OPTIONS`)
- Modify: `src/features/inventory/repositories/bulk-actions.repository.ts:8-157`
- Modify: `src/features/inventory/services/bulk-actions.service.ts`
- Modify: `src/features/inventory/components/bulk-edit-dialog.tsx:221-258`

**Interfaces:**
- Consumes: `BulkEditLookups.occasions`/`.materials` (Task 3).
- Produces: `BulkEditAction` union gains `{ type: "add_occasion" | "remove_occasion"; occasionId: string }` and `{ type: "add_material" | "remove_material"; materialId: string }`. Exhaustive switches (`_exhaustive: never`) in service and dialog enforce coverage.

- [ ] **Step 1: Extend types in `types/wardrobe.ts`**

Append to `BulkEditAction`:

```ts
  | { type: "add_occasion"; occasionId: string }
  | { type: "remove_occasion"; occasionId: string }
  | { type: "add_material"; materialId: string }
  | { type: "remove_material"; materialId: string };
```

Append to `BULK_EDIT_ACTION_OPTIONS`:

```ts
  { type: "add_occasion", label: "Add occasion", category: "relation" },
  { type: "remove_occasion", label: "Remove occasion", category: "relation" },
  { type: "add_material", label: "Add material", category: "relation" },
  { type: "remove_material", label: "Remove material", category: "relation" },
```

- [ ] **Step 2: Extend `bulk-actions.repository.ts`**

Change `type RelationTable = "item_tags" | "item_seasons" | "item_styles"` to include `"item_occasions" | "item_materials"`, and add branches to BOTH `deleteItemRelations` and `insertItemRelations`, pattern-matching the `item_seasons` branch exactly (`bulk-actions.repository.ts:30-41` and `96-126`) with `occasion_id` / `material_id` as the id column. Example insert branch:

```ts
if (table === "item_occasions") {
  const { data: existingRows, error: existingError } = await supabase
    .from("item_occasions")
    .select("item_id")
    .in("item_id", itemIds)
    .eq("occasion_id", relationId);

  if (existingError) {
    return { affected: 0, error: toError(existingError.message) };
  }

  const existingItemIds = new Set((existingRows ?? []).map((row) => row.item_id));
  const rowsToInsert = itemIds
    .filter((itemId) => !existingItemIds.has(itemId))
    .map((itemId) => ({ item_id: itemId, occasion_id: relationId }));

  if (rowsToInsert.length === 0) {
    return { affected: 0, error: null };
  }

  const { data, error } = await supabase
    .from("item_occasions")
    .insert(rowsToInsert)
    .select("item_id");

  if (error) {
    return { affected: 0, error: toError(error.message) };
  }

  return { affected: data?.length ?? 0, error: null };
}
```

(Repeat for `item_materials` with `material_id`; delete branches mirror `item_seasons` delete.)

- [ ] **Step 3: Extend `bulk-actions.service.ts`** — update its local `RelationTable` alias the same way, then add cases to all four switches, pattern-matching seasons:

- `applyRelationBulkEdit`: `add_occasion`/`remove_occasion` → `"item_occasions"` + `action.occasionId` (guard: "Occasion is required."); `add_material`/`remove_material` → `"item_materials"` + `action.materialId` (guard: "Material is required.").
- `applyFieldBulkEdit`: route the four new types to `applyRelationBulkEdit`.
- `describeBulkEditAction`: `` `Add occasion “${lookupName(lookups.occasions, action.occasionId)}”` `` etc.
- `isBulkEditActionReady`: `Boolean(action.occasionId)` / `Boolean(action.materialId)`.
- `createDefaultBulkEditAction`: `{ type, occasionId: "" }` / `{ type, materialId: "" }`.

- [ ] **Step 4: Extend `ActionValueFields` in `bulk-edit-dialog.tsx`** (pattern-match the season case at line 232):

```tsx
case "add_occasion":
case "remove_occasion":
  return (
    <LookupSelect
      label="Occasion"
      value={action.occasionId}
      options={lookups.occasions}
      placeholder="Select an occasion"
      onChange={(occasionId) => onChange({ type: action.type, occasionId })}
    />
  );
case "add_material":
case "remove_material":
  return (
    <LookupSelect
      label="Material"
      value={action.materialId}
      options={lookups.materials}
      placeholder="Select a material"
      onChange={(materialId) => onChange({ type: action.type, materialId })}
    />
  );
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — Expected: clean (the `never` exhaustive checks force every switch you missed).
Run: `npm test` — Expected: PASS.
Browser: `/inventory` → select 3 items → Bulk edit → Add occasion "Travel" → apply → `/inventory/review` missing-occasion count drops by 3 (for items that lacked it).

- [ ] **Step 6: Commit**

```bash
git add types/wardrobe.ts src/features/inventory
git commit -m "feat: bulk add/remove occasion and material actions (RFC-026)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Item detail — edit entry points on Occasions and Materials cards

**Files:**
- Modify: `src/features/inventory/components/item-detail-view.tsx` (`OccasionsCard` at line 306; materials `BadgeGroup` card near line 251-270; wiring near line 742)

**Interfaces:**
- Consumes: existing `setFormOpen(true)` state that opens the already-wired `ItemFormDialog` (`item-detail-view.tsx:742`).
- Produces: nothing downstream.

- [ ] **Step 1: Pass an `onEdit` callback into `OccasionsCard`** and render an Edit button in its header:

```tsx
function OccasionsCard({
  occasions,
  onEdit,
}: {
  occasions: ItemOccasionRelation[];
  onEdit: () => void;
}) {
```

Add to the card header (pattern-match the card's existing title area):

```tsx
<Button type="button" variant="ghost" size="sm" onClick={onEdit}>
  Edit
</Button>
```

At the call site pass `onEdit={() => setFormOpen(true)}`. Do the same for the card containing `<BadgeGroup label="Materials" …/>` — if that card is shared (details card), a single Edit button on it suffices.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` — clean. Browser: item detail → Occasions card → Edit → dialog opens with relations pre-selected; save reflects on the card after refetch (dialog close triggers `detailQuery.refetch()` at `item-detail-view.tsx:748`).

- [ ] **Step 3: Commit**

```bash
git add src/features/inventory/components/item-detail-view.tsx
git commit -m "feat: edit entry points on item detail relation cards (RFC-026)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Final verification + docs

**Files:**
- Modify: `docs/rfc/RFC-026-Inventory-Item-Occasions-UI.md` (Status → Implemented)
- Modify: `docs/product/BACKLOG.md` (RFC-026 row → `Done ✅ (Implemented)`)
- Modify: `docs/rfc/README.md` (RFC-026 index row → Implemented)
- Modify: `CHANGELOG.md` (entry under an Unreleased/next-version heading, matching the file's existing format)

**Interfaces:** none — verification and bookkeeping.

- [ ] **Step 1: Full gates**

Run: `npm test` — Expected: ALL PASS.
Run: `npx tsc --noEmit` — Expected: clean.
Run: `npm run lint` — Expected: clean.
Run: `npm run build` — Expected: success.

- [ ] **Step 2: End-to-end browser pass** (dev server via preview tools)

1. `/inventory/review` — note Missing Metadata / open-issues counts.
2. Fix one item via edit (occasions+materials+seasons), one via Suggest, three via bulk add — counts drop accordingly.
3. Regression: JSON import round-trip unchanged; an import-scored occasion survives an unrelated edit.

- [ ] **Step 3: Update the four docs files** — RFC-026 header `Status: Implemented`, tick its §10 acceptance criteria, flip backlog/index rows, add CHANGELOG entry describing: relations editor on item form (create+edit), deterministic occasion suggest, bulk occasion/material actions, detail-card edit entry points.

- [ ] **Step 4: Commit**

```bash
git add docs CHANGELOG.md
git commit -m "docs: mark RFC-026 implemented (item relations editor)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Release (version bump, tag, push) is a separate owner-initiated step per CLAUDE.md rule 13 — do not tag in this plan.
