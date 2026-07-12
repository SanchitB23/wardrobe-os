# RFC-025: Similar Item Detection Tightening

Status: Implemented  
Owner: Sanchit Bhatnagar  
Author: Cursor  
Target Release: v2.2.1  
Epic: Inventory / Data Quality  
Priority: High  
Effort: S  
Dependencies:

- [RFC-024](RFC-024-Catalog-Review-v2.md) Catalog Review v2 — `SimilarItemDetection.ts`,
  `ReviewIssueTypes.ts`, `/inventory/review` Similar Items section (Implemented)
- ADR-005 — AI does not decide catalog correctness; similarity remains deterministic
- ADR-008 — release/versioning

Design spec: [2026-07-12-rfc-025-similar-item-detection-design.md](../superpowers/specs/2026-07-12-rfc-025-similar-item-detection-design.md)

---

## 1. Problem Statement

RFC-024 shipped metadata-aware **Similar Items** in Catalog Review to catch
near-duplicates that differ by color/brand/category (e.g. _Solid White Shirt_ vs
_Solid Wine Shirt_). The initial `namesAreSimilar()` implementation also flagged
pairs that share only a **generic garment-type suffix**, producing false positives
that erode trust in Catalog Review.

**Reported example (2026-07-12):**

| Item A              | Item B      | UI reason               | User verdict                         |
| ------------------- | ----------- | ----------------------- | ------------------------------------ |
| Peach Waffle Blazer | Grey Blazer | Similar name diff color | **Not similar** — different products |

**Root cause (RFC-024 implementation):**

```ts
// Removed in RFC-025 — substring inclusion after color strip
if (sigA.includes(sigB) || sigB.includes(sigA)) return true;
```

`garmentSignature()` stripped known color tokens, then substring inclusion treated
any longer name containing `"blazer"` as similar to `"blazer"`.

## 2. Goals

1. **Tighten similar-item rules** — exact parallel name skeleton (precision-first).
2. **Category gate** when both items have `categoryId` (not subcategory).
3. **Preserve RFC-024 regression positives** (White/Wine shirt, Olive/White activewear).
4. **Reject** Peach Waffle Blazer ↔ Grey Blazer and suffix-only pairs.
5. **Human-readable** similar reason labels in UI.
6. Domain-only; no schema changes; duplicate detection unchanged.

## 3. Non-Goals

- Changing duplicate detection rules.
- AI-based similarity or embeddings.
- Subcategory as a similarity factor.
- Vision / shopping duplicate engines.

## 4. User Stories

- As a wardrobe owner, I want Similar Items to list **only naming variants I might
  have imported twice**, so I am not asked to review unrelated blazers/shirts.
- As a wardrobe owner, I want color-swap variants of the **same product name
  skeleton** to still appear (White/Wine shirt).
- As a developer, I want deterministic tests documenting valid vs invalid similar pairs.

## 5. UX Flow

Behaviour change in **Similar Items** at `/inventory/review`:

1. Peach Waffle ↔ Grey Blazer **no longer appears**.
2. Valid color-swap pairs **still appear** with dismiss / cleanup actions.
3. Reason copy: "Same name pattern, different color" / "… different brand".

## 6. Architecture

### Domain Layer (implemented)

| Module                         | Change                                                        |
| ------------------------------ | ------------------------------------------------------------- |
| `ReviewIssueTypes.ts`          | `parallelSkeletonMatch()`                                     |
| `SimilarItemDetection.ts`      | Exact skeleton + category gate; removed Levenshtein/substring |
| `DuplicateDetection.ts`        | No change                                                     |
| `tests/catalog-review.test.ts` | RFC-025 negatives + category gate                             |

**Similar-item definition (final):**

A pair `(A, B)` is **similar** iff:

1. Not a duplicate.
2. `namesAreSimilar`: normalized names equal OR `parallelSkeletonMatch` (identical
   non-color token sequences — same length, same order).
3. **Category gate:** if both `categoryId` set, they must match.
4. Metadata assigns reason: color diff → `similar_name_diff_color`; brand diff or
   differing full names (same color metadata) → `similar_name_diff_meta`.

### Service / Repository / AI

No changes.

### UI Layer

`formatSimilarReason()` in `similar-reason-labels.ts`; used in
`inventory-review-view.tsx`.

## 7. Data Flow

Unchanged from RFC-024; `findSimilarPairs` returns fewer false positives.

## 8. Data Model / Schema Impact

**No schema changes.**

## 9. API / Domain Contracts

```ts
export function parallelSkeletonMatch(a: string, b: string): boolean;
export function namesAreSimilar(a: string, b: string): boolean;
export function scoreSimilarPair(a: CatalogItemView, b: CatalogItemView): ...;
```

Removed export: `SIMILAR_GARMENT_THRESHOLD`.

## 10. Acceptance Criteria

- [x] Peach Waffle Blazer ↔ Grey Blazer → not similar.
- [x] Solid White ↔ Solid Wine Shirt → similar (color).
- [x] Olive ↔ White Activewear T-Shirt → similar (color).
- [x] Navy Chinos ↔ Pleated Wool Chinos → not similar.
- [x] Blue Oxford ↔ White Oxford Shirt → not similar.
- [x] Different category (both set) + parallel skeleton → not similar.
- [x] One category null + parallel skeleton → still similar.
- [x] Duplicate rules unchanged.
- [x] Dismissed pairs still hidden.
- [x] Human-readable reason labels in UI.

## 11. QA / Testing Plan

662 unit tests green including new RFC-025 describe blocks.

## 12. Risks & Trade-offs

**Precision over recall** — abbreviated names and sloppy renames may not appear;
owner dismisses or renames. Category gate prevents cross-category false positives
when both categories are set.

## 13. Future Extensions

- Subcategory-aware similarity (parked).
- Bulk dismiss for noisy clusters.

## 14. Open Questions

Resolved:

1. Jaccard / generic-noun heuristics — **rejected** in favor of exact skeleton.
2. Category — **included when both set**; not subcategory.
3. UI labels — **included** in this release.

---

## Appendix: Peach / Grey

| Step             | Grey Blazer                       | Peach Waffle Blazer         |
| ---------------- | --------------------------------- | --------------------------- |
| Non-color tokens | `blazer`                          | `peach`, `waffle`, `blazer` |
| RFC-024          | substring match → similar         |                             |
| RFC-025          | length mismatch → **not similar** |                             |
