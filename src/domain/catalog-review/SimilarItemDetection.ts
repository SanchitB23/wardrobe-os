/**
 * Similar-item detection (RFC-024).
 * Similar name + different color/brand/category → similar, NOT duplicate.
 */

import { scoreDuplicatePair } from "@/domain/catalog-review/DuplicateDetection";
import {
  garmentSignature,
  isRetiredStatus,
  normalizeKey,
  orderedPairKey,
  stringSimilarity,
} from "@/domain/catalog-review/ReviewIssueTypes";
import type {
  CatalogDismissal,
  CatalogItemView,
  CatalogSimilarPair,
  SimilarReason,
} from "@/domain/catalog-review/types";

/** Similarity on garment signature (color tokens stripped). */
export const SIMILAR_GARMENT_THRESHOLD = 0.88;

export function namesAreSimilar(a: string, b: string): boolean {
  const left = normalizeKey(a);
  const right = normalizeKey(b);
  if (!left || !right) return false;
  if (left === right) return true;

  const sigA = garmentSignature(a);
  const sigB = garmentSignature(b);
  if (!sigA || !sigB) return false;
  if (sigA === sigB) return true;
  if (sigA.length >= 3 && sigB.length >= 3) {
    if (sigA.includes(sigB) || sigB.includes(sigA)) return true;
  }
  return stringSimilarity(sigA, sigB) >= SIMILAR_GARMENT_THRESHOLD;
}

export function scoreSimilarPair(
  a: CatalogItemView,
  b: CatalogItemView,
): { kind: "similar"; reason: SimilarReason } | { kind: "none" } {
  if (scoreDuplicatePair(a, b).kind === "duplicate") {
    return { kind: "none" };
  }
  if (!namesAreSimilar(a.name, b.name)) {
    return { kind: "none" };
  }

  const colorDiff =
    Boolean(a.colorId && b.colorId && a.colorId !== b.colorId) ||
    Boolean(
      a.colorName &&
        b.colorName &&
        normalizeKey(a.colorName) !== normalizeKey(b.colorName),
    );

  if (colorDiff) {
    return { kind: "similar", reason: "similar_name_diff_color" };
  }

  const brandDiff =
    (a.brandId || b.brandId) && a.brandId !== b.brandId;
  const categoryDiff =
    (a.categoryId || b.categoryId) && a.categoryId !== b.categoryId;

  if (brandDiff || categoryDiff) {
    return { kind: "similar", reason: "similar_name_diff_meta" };
  }

  // Same color (or both null) and same brand/category but names only similar
  // via garment signature with different full names — still similar, not dup.
  if (normalizeKey(a.name) !== normalizeKey(b.name)) {
    return { kind: "similar", reason: "similar_name_diff_meta" };
  }

  return { kind: "none" };
}

function dismissalKeys(
  dismissals: CatalogDismissal[] | undefined,
): Set<string> {
  const set = new Set<string>();
  for (const d of dismissals ?? []) {
    if (d.kind !== "similar") continue;
    set.add(`${orderedPairKey(d.itemIdA, d.itemIdB)}:similar`);
  }
  return set;
}

export function findSimilarPairs(
  items: CatalogItemView[],
  options: {
    includeRetired?: boolean;
    dismissals?: CatalogDismissal[];
  } = {},
): CatalogSimilarPair[] {
  const includeRetired = options.includeRetired ?? false;
  const pool = items.filter(
    (item) => includeRetired || !isRetiredStatus(item.status),
  );
  const dismissed = dismissalKeys(options.dismissals);
  const pairs: CatalogSimilarPair[] = [];

  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      const a = pool[i];
      const b = pool[j];
      const key = `${orderedPairKey(a.id, b.id)}:similar`;
      if (dismissed.has(key)) continue;
      const score = scoreSimilarPair(a, b);
      if (score.kind !== "similar") continue;
      const [idA, idB] = a.id < b.id ? [a.id, b.id] : [b.id, a.id];
      pairs.push({
        id: `similar:${idA}:${idB}`,
        reason: score.reason,
        label: `${a.name} ↔ ${b.name}`,
        itemIdA: idA,
        itemIdB: idB,
      });
    }
  }

  return pairs;
}
