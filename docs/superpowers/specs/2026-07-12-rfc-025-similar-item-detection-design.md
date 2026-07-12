# RFC-025 Similar Item Detection — Design Spec

**Date:** 2026-07-12  
**Status:** Approved → Implemented  
**Target:** v2.2.1 patch

## Problem

RFC-024 Similar Items used substring inclusion on garment signatures after color
strip, flagging unrelated items that share only a generic suffix (e.g. _Peach
Waffle Blazer_ ↔ _Grey Blazer_).

## Decisions (brainstorming)

| Topic             | Decision                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| Model             | Precision-first — minimal heuristics                                    |
| Name match        | Exact parallel skeleton (same non-color token count + order)            |
| Abbreviated names | Rejected                                                                |
| Category          | When both `categoryId` set, must match; either missing → name gate only |
| Subcategory       | Not a factor                                                            |
| UI                | Human-readable reason labels in same release                            |

## Algorithm

1. **Not duplicate** (`scoreDuplicatePair` unchanged).
2. **`namesAreSimilar`:** normalized names equal, OR `parallelSkeletonMatch`.
3. **Category gate:** if both `categoryId` and they differ → not similar.
4. **Reason:** color metadata diff → `similar_name_diff_color`; brand diff or
   differing full names (same color meta) → `similar_name_diff_meta`.

Removed: substring `includes`, Levenshtein ≥ 0.88 on garment signature.

## Regression matrix

| Pair                                                | Result          |
| --------------------------------------------------- | --------------- |
| Solid White Shirt ↔ Solid Wine Shirt                | Similar (color) |
| Olive Activewear T-Shirt ↔ White Activewear T-Shirt | Similar (color) |
| Peach Waffle Blazer ↔ Grey Blazer                   | Not similar     |
| Navy Chinos ↔ Pleated Wool Chinos                   | Not similar     |
| Blue Oxford ↔ White Oxford Shirt                    | Not similar     |
| Parallel skeleton, different category (both set)    | Not similar     |
| Parallel skeleton, one category null                | Similar         |

## Files

- `src/domain/catalog-review/ReviewIssueTypes.ts` — `parallelSkeletonMatch`
- `src/domain/catalog-review/SimilarItemDetection.ts` — tightened logic
- `src/domain/catalog-review/tests/catalog-review.test.ts`
- `src/features/inventory/lib/similar-reason-labels.ts`
- `src/features/inventory/components/inventory-review-view.tsx`

## Out of scope

Subcategory gate, schema changes, AI similarity, duplicate rule changes.
