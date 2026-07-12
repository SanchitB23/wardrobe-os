/**
 * Metadata-aware duplicate detection (RFC-024).
 * Fuzzy name alone is NEVER a duplicate.
 */

import {
  isRetiredStatus,
  normalizeKey,
  orderedPairKey,
} from "@/domain/catalog-review/ReviewIssueTypes";
import type {
  CatalogDismissal,
  CatalogDuplicateGroup,
  CatalogItemView,
  DuplicateReason,
} from "@/domain/catalog-review/types";

export type DuplicatePairScore =
  | { kind: "duplicate"; reason: DuplicateReason }
  | { kind: "none" };

export function scoreDuplicatePair(
  a: CatalogItemView,
  b: CatalogItemView,
): DuplicatePairScore {
  const codeA = normalizeKey(a.code);
  const codeB = normalizeKey(b.code);
  if (codeA && codeB && codeA === codeB) {
    return { kind: "duplicate", reason: "same_code" };
  }

  const nameA = normalizeKey(a.name);
  const nameB = normalizeKey(b.name);
  if (
    nameA &&
    nameB &&
    nameA === nameB &&
    a.categoryId &&
    b.categoryId &&
    a.categoryId === b.categoryId &&
    a.colorId &&
    b.colorId &&
    a.colorId === b.colorId
  ) {
    return { kind: "duplicate", reason: "same_identity" };
  }

  return { kind: "none" };
}

function dismissalKeys(
  dismissals: CatalogDismissal[] | undefined,
): Set<string> {
  const set = new Set<string>();
  for (const d of dismissals ?? []) {
    if (d.kind !== "duplicate") continue;
    set.add(`${orderedPairKey(d.itemIdA, d.itemIdB)}:duplicate`);
  }
  return set;
}

function isDismissed(a: string, b: string, dismissed: Set<string>): boolean {
  return dismissed.has(`${orderedPairKey(a, b)}:duplicate`);
}

function undismissedClique(
  members: CatalogItemView[],
  dismissed: Set<string>,
): CatalogItemView[] {
  return members.filter((item) =>
    members.some(
      (other) =>
        other.id !== item.id && !isDismissed(item.id, other.id, dismissed),
    ),
  );
}

/**
 * Build duplicate groups. Fuzzy name similarity does not create duplicates.
 */
export function findDuplicateGroups(
  items: CatalogItemView[],
  options: {
    includeRetired?: boolean;
    dismissals?: CatalogDismissal[];
  } = {},
): CatalogDuplicateGroup[] {
  const includeRetired = options.includeRetired ?? false;
  const pool = items.filter(
    (item) => includeRetired || !isRetiredStatus(item.status),
  );
  const dismissed = dismissalKeys(options.dismissals);

  const byCode = new Map<string, CatalogItemView[]>();
  const byIdentity = new Map<string, CatalogItemView[]>();

  for (const item of pool) {
    const code = normalizeKey(item.code);
    if (code) {
      const bucket = byCode.get(code) ?? [];
      bucket.push(item);
      byCode.set(code, bucket);
    }

    const name = normalizeKey(item.name);
    if (name && item.categoryId && item.colorId) {
      const key = `${name}|${item.categoryId}|${item.colorId}`;
      const bucket = byIdentity.get(key) ?? [];
      bucket.push(item);
      byIdentity.set(key, bucket);
    }
  }

  const groups: CatalogDuplicateGroup[] = [];
  const seen = new Set<string>();

  function addGroup(
    reason: DuplicateReason,
    label: string,
    members: CatalogItemView[],
  ) {
    const undismissed = undismissedClique(members, dismissed);
    if (undismissed.length < 2) return;
    const ids = undismissed.map((m) => m.id).sort();
    const sig = `${reason}:${ids.join(",")}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    groups.push({ id: sig, reason, label, itemIds: ids });
  }

  for (const [code, members] of byCode) {
    if (members.length < 2) continue;
    addGroup("same_code", code.toUpperCase(), members);
  }

  for (const [, members] of byIdentity) {
    if (members.length < 2) continue;
    addGroup("same_identity", members[0]?.name ?? "Same identity", members);
  }

  return groups.sort((a, b) => b.itemIds.length - a.itemIds.length);
}

export function areDuplicates(a: CatalogItemView, b: CatalogItemView): boolean {
  return scoreDuplicatePair(a, b).kind === "duplicate";
}
