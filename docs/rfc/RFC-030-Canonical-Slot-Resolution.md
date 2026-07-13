# RFC-030: Canonical Outfit Slot Resolution

Status: Implemented
Owner: Sanchit Bhatnagar
Author: Claude
Target Release: v2.4.0
Epic: Wardrobe Intelligence — Data Quality
Priority: High
Effort: M
Dependencies:
- None (pure domain refactor; RFC-002 VisionNormalizer and RFC-020 StyleDNA are consumers)

---

## 1. Problem Statement

Outfit-slot resolution ("is this item a top, bottom, footwear, …?") is the
foundation every slot-grouping engine stands on: `BuyVsSkipEngine` (core-outfit
compatibility), `OutfitGenerationEngine`, `UnifiedOutfitRecommendationEngine`,
Recommendation v2 (`EligibilityEngine`, `ScoringEngine`, `DiversityReranker`),
outfit/wear-log pickers, and outfit completeness scoring.

Today there are **three divergent resolution paths**:

1. `src/domain/outfit/slot-matching.ts` — `OUTFIT_SLOT_DEFINITIONS.categoryKeywords`
   with naive substring matching, scanned top → accessory.
2. `src/domain/style-dna/StyleDNAEngine.ts#resolveSlot` — wraps (1) and
   **silently falls back to `"accessory"`** when nothing matches. Because all
   engines consume `styleDNA.slot`, one missing keyword silently degrades
   Buy-vs-Skip, generation, and recommendations (the item becomes an optional
   accessory and drops out of core-outfit math).
3. `src/domain/vision/VisionNormalizer.ts#SLOT_KEYWORDS` — a **separate, richer,
   differently-ordered** keyword map used for vision detections.

Concrete failures observed:

- Categories `Chinos`, `Joggers`, `Leggings`, `Polos` resolved to `accessory`
  until keywords were hot-patched (July 2026). `Cargos`, `Sweatpants`,
  `Turtlenecks`, `Cardigans`, `Sandals`, `Slides`, `Henleys`, `Kurtas` still
  fall to `accessory` today.
- The two keyword maps **disagree**: `hoodie` → top (slot-matching) vs
  outerwear (vision); `vest` → outerwear (slot-matching) vs top (vision);
  `cardigan` → accessory-fallback (slot-matching) vs outerwear (vision). An
  item captured via vision can change slots once it lands in inventory.
- Substring matching has false positives: any category containing `top` as a
  substring (e.g. a hypothetical `Stopwatch`, `Laptop Bag`) matches the top
  slot before its true slot is considered.
- The fallback is invisible: nothing records *that* resolution failed, so the
  degradation cannot be surfaced or measured.

## 2. Goals

1. **One source of truth**: a single pure-domain module that resolves any
   category/subcategory/name text to an `OutfitSlot`, used by StyleDNA, vision
   normalisation, slot matching helpers, and services.
2. **Explicit dictionary first**: a curated exact-match dictionary of common
   (menswear-first) category terms — plural-folded, phrase-aware — so common
   categories never depend on substring luck or scan order.
3. **Observable fallback**: resolution returns its provenance
   (`exact | keyword | fallback`) and StyleDNA carries it (`slotSource`), so
   unresolved categories become measurable instead of silent.
4. **Convergence**: vision and inventory classify the same garment word the
   same way (canonical answers chosen and documented for the current
   disagreements).
5. **No behavioural regressions** for categories that resolve correctly today
   (existing keyword tier retained as tier 2 with unchanged scan order).

## 3. Non-Goals

- **No schema change.** A `categories.slot` override column is a natural
  follow-up (§13) but out of scope; resolution stays derivable from text.
- **No AI involvement.** Slot resolution stays deterministic (ADR-005); AI
  never picks slots.
- No UI changes (pickers/builders keep their current interaction model; they
  simply group more items correctly).
- No womenswear-taxonomy expansion beyond terms already implied by existing
  keywords (`skirt`, `blouse`, `heels`); the dictionary is extensible.
- No re-ordering of the keyword-tier scan (back-compat).

## 4. User Stories

- As the wardrobe owner, I want my Chinos/Joggers/Cargos/Kurtas classified as
  what they are, so outfit generation and Buy-vs-Skip reason about real
  outfits instead of treating them as accessories.
- As the wardrobe owner, I want an item detected by vision to keep the same
  slot when it becomes an inventory item, so recommendations stay consistent.
- As the maintainer, I want unresolved categories to be visible (via
  `slotSource: "fallback"`), so I can extend the dictionary instead of
  discovering degradation by accident.

## 5. UX Flow

No new screens. Existing flows improve silently:

1. **Outfit builder / wear-log picker** — items whose categories previously
   matched no slot now appear under their correct slot group.
2. **Buy-vs-Skip advisor** — a prospective "Chinos"-like item participates in
   core-outfit compatibility as a bottom.
3. **Vision capture → inventory** — the slot shown at detection time matches
   the slot StyleDNA later derives.

## 6. Architecture

### Domain Layer

**New: `src/domain/outfit/slot-resolution.ts`** (pure, deterministic):

- `CANONICAL_SLOT_TERMS: Readonly<Record<string, OutfitSlot>>` — exact-match
  dictionary keyed by normalised singular terms. Includes unigrams
  (`chino`, `loafer`, `kurta`, `cardigan`, …) and disambiguating bigrams
  (`chelsea boot`, `tank top`, `oxford shirt`, `pocket square`, `flip flop`,
  `denim jacket`, …).
- `normalizeSlotTerm(value)` — lowercase, trim, collapse whitespace; lookups
  additionally try naive plural folds (`…s`, `…es`).
- `resolveOutfitSlot(...parts): SlotResolution` where
  `SlotResolution = { slot: OutfitSlot; source: "exact" | "keyword" | "fallback" }`.
  Tiers, first hit wins:
  1. **Exact tier** — for each part in argument order (category before
     subcategory before name): whole phrase, then token bigrams
     (left-to-right), then unigrams (left-to-right) against the dictionary.
     Bigrams outrank unigrams so `Oxford Shirt` → top even though `oxford`
     alone → footwear.
  2. **Keyword tier** — existing `categoryKeywords` substring scan over the
     concatenated parts, unchanged slot order (top → … → accessory).
  3. **Fallback** — `{ slot: "accessory", source: "fallback" }`.

**Changed: `src/domain/outfit/slot-matching.ts`**

- `categoryMatchesOutfitSlot(name, slot)` delegates to `resolveOutfitSlot`:
  returns true iff resolution is non-fallback **and** lands on `slot`.
  Matching becomes exclusive (a category belongs to exactly one slot) and
  dictionary-aware (`Overshirt` → outerwear, no longer top via `shirt`).
  Unknown categories still match no slot (picker behaviour preserved).
- `OUTFIT_SLOT_DEFINITIONS` keeps its shape (labels/optional flags/keywords
  are still the keyword tier + UI metadata).

**Changed: `src/domain/style-dna/StyleDNAEngine.ts`**

- `resolveSlot` → `resolveOutfitSlot(category, subcategory, name)`. Name is a
  new last-priority signal (helps `category: null` items with descriptive
  names); category/subcategory always win.
- StyleDNA gains additive field `slotSource: SlotResolutionSource` for
  observability. Existing `slot` semantics unchanged.

**Changed: `src/domain/vision/VisionNormalizer.ts`**

- Deletes its private `SLOT_KEYWORDS`; `slotFor(label, category)` delegates to
  `resolveOutfitSlot(category, label)` and maps `fallback` → `null`
  (vision keeps "unknown" as a signal rather than defaulting to accessory).

**Canonical answers for current disagreements** (dictionary entries):

| Term | Was (slot-matching) | Was (vision) | Canonical |
|---|---|---|---|
| hoodie | top | outerwear | **top** (keeps StyleDNA/engine behaviour stable) |
| vest / waistcoat | outerwear | top | **outerwear** |
| cardigan | accessory (fallback) | outerwear | **outerwear** (layering piece) |
| overshirt / shacket | top (via `shirt`) | outerwear | **outerwear** |
| tuxedo / suit jacket | — (fallback) | outerwear | **outerwear** |

### Service Layer

- `wear-events.service.ts#inferSlot` delegates to `resolveOutfitSlot`
  (explicit slot param still wins; `null` category still yields `null`).
- `outfits.service.ts`, pickers, and quick-wear-log keep calling
  `categoryMatchesOutfitSlot` — improved transparently.

### Repository Layer

None.

### UI Layer

None (existing components benefit transparently).

### AI Layer

None. Slot resolution remains deterministic; AI continues to receive slots as
inputs, never produce them (ADR-005).

## 7. Data Flow

1. Inventory item (category/subcategory/name) → `deriveStyleDNA` →
   `resolveOutfitSlot` → `{ slot, source }` → StyleDNA `{ slot, slotSource }`.
2. Engines (BuyVsSkip, generation, recommendation v1/v2) group by
   `styleDNA.slot` exactly as today — now correct for dictionary terms.
3. Vision detection (label/category) → `VisionNormalizer` →
   `resolveOutfitSlot` → same canonical slot as inventory later derives.
4. Feature layer (pickers, outfit scoring, wear events) →
   `categoryMatchesOutfitSlot` → same resolver.

## 8. Data Model / Schema Impact

**No schema changes.** `styleDNA.slotSource` is a derived, in-memory domain
field; StyleDNA is not persisted.

## 9. API / Domain Contracts

```ts
// src/domain/outfit/slot-resolution.ts
export type SlotResolutionSource = "exact" | "keyword" | "fallback";
export type SlotResolution = { slot: OutfitSlot; source: SlotResolutionSource };

export const CANONICAL_SLOT_TERMS: Readonly<Record<string, OutfitSlot>>;
export function resolveOutfitSlot(
  ...parts: Array<string | null | undefined>
): SlotResolution;

// src/domain/outfit/slot-matching.ts (signature unchanged, semantics: exclusive)
export function categoryMatchesOutfitSlot(
  categoryName: string | null | undefined,
  slot: OutfitSlot,
): boolean;

// src/domain/style-dna/StyleDNA.ts (additive)
type ItemStyleDNA = { /* … */ slot: OutfitSlot; slotSource: SlotResolutionSource };
```

## 10. Acceptance Criteria

- [x] `resolveOutfitSlot` resolves every dictionary term — singular and plural
      — to its canonical slot with `source: "exact"`.
- [x] Common categories resolve correctly end-to-end via `deriveStyleDNA`:
      Chinos/Joggers/Leggings/Cargos/Sweatpants → bottom; Polos/Henleys/
      Turtlenecks/Kurtas/Hoodies → top; Chelsea Boots/Loafers/Sandals/Slides →
      footwear; Cardigans/Overshirts/Blazers → outerwear.
- [x] Bigram disambiguation: `Oxford Shirt` → top; `Oxfords` → footwear;
      `Tank Top` → top; `Denim Jacket` → outerwear.
- [x] Category/subcategory outrank name; name resolves items with
      `category: null` and a descriptive name.
- [x] Unresolved text yields `{ slot: "accessory", source: "fallback" }` and
      StyleDNA exposes `slotSource: "fallback"`.
- [x] `categoryMatchesOutfitSlot` is exclusive (true for exactly one slot for
      any resolvable category; false for all slots otherwise).
- [x] `VisionNormalizer` produces the same slot as `deriveStyleDNA` for the
      same garment term; its private keyword map is deleted.
- [x] Full Vitest suite green; no existing slot expectation changes except the
      documented canonical convergences (§6 table).

## 11. QA / Testing Plan

- **Unit (new)** `src/domain/tests/slot-resolution.test.ts`: table-driven
  dictionary coverage (every term + plural), tier precedence (exact beats
  keyword: Overshirt), bigram-over-unigram (Oxford Shirt), part priority
  (category beats name), fallback provenance, exclusivity of
  `categoryMatchesOutfitSlot`.
- **Unit (updated)** `style-dna-engine.test.ts`: `slotSource` assertions;
  name-based resolution for `category: null`.
- **Unit (existing)** `VisionEngine.test.ts` and all engine tests must stay
  green (behavioural back-compat).
- **Manual/preview**: outfit builder picker groups a "Chinos" item under
  Bottom; quick wear-log shows it in the Bottom slot.

## 12. Risks & Trade-offs

- **Behaviour changes are deliberate but real**: `Overshirt` moves top →
  outerwear; vision's `hoodie` moves outerwear → top; `cardigan` gains a slot.
  Mitigation: §6 table is the change list; engine tests pin everything else.
- **Dictionary is still curation** — new categories can miss it. Mitigated by
  keyword tier 2 (unchanged safety net) and `slotSource` making misses
  observable rather than silent; extending is a one-line, unit-tested change
  in one file.
- **Exclusive matching** could hide an item from a picker slot it previously
  (incorrectly) also matched. No known real case; deterministic single-slot
  membership is the intended model (`OutfitItemRow.slot` is single-valued).
- **Name as a signal** can misfire on decorative names ("Watch-print Tee");
  mitigated by lowest priority (category/subcategory win) and exact-tier
  bigrams.

## 13. Future Extensions

- `categories.slot` column (additive migration + RLS) as an explicit per-user
  override; resolver becomes the default for un-overridden rows.
- Wardrobe-health / catalog-review insight: "N items have unresolved
  categories" driven by `slotSource === "fallback"`.
- Category-management UI surfacing the resolved slot next to each category.
- Womenswear/accessory taxonomy expansion of the dictionary.

## 14. Open Questions

- None blocking. Canonical answers for the disagreeing terms are proposed in
  §6 and can be revisited without structural change (single dictionary line
  each).
