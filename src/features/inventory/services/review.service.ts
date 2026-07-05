import {
  bulkRetireWardrobeItems,
  hardDeleteWardrobeItems,
  selectAllItemsForReview,
} from "@/features/inventory/repositories/review.repository";
import type {
  BulkCleanupMode,
  BulkCleanupResult,
  DuplicateGroup,
  DuplicateMatchReason,
  ReviewCleanupResult,
  WardrobeItemRow,
} from "@/features/inventory/types";

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function areNamesSimilar(a: string, b: string): boolean {
  const left = normalizeKey(a);
  const right = normalizeKey(b);

  if (left === right) {
    return true;
  }

  if (left.length < 3 || right.length < 3) {
    return false;
  }

  if (left.includes(right) || right.includes(left)) {
    return true;
  }

  const distance = levenshteinDistance(left, right);
  const maxLength = Math.max(left.length, right.length);
  return 1 - distance / maxLength >= 0.85;
}

function buildGroupsByKey(
  items: WardrobeItemRow[],
  reason: DuplicateMatchReason,
  keyForItem: (item: WardrobeItemRow) => string,
  labelForKey: (key: string) => string,
): DuplicateGroup[] {
  const buckets = new Map<string, WardrobeItemRow[]>();

  for (const item of items) {
    const key = keyForItem(item);
    if (!key) {
      continue;
    }
    const bucket = buckets.get(key) ?? [];
    bucket.push(item);
    buckets.set(key, bucket);
  }

  return Array.from(buckets.entries())
    .filter(([, groupItems]) => groupItems.length > 1)
    .map(([key, groupItems]) => ({
      id: `${reason}:${key}`,
      reason,
      label: labelForKey(key),
      items: groupItems.sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => b.items.length - a.items.length);
}

function buildSimilarNameGroups(items: WardrobeItemRow[]): DuplicateGroup[] {
  const parent = items.map((_, index) => index);

  function find(index: number): number {
    if (parent[index] === index) {
      return index;
    }
    parent[index] = find(parent[index]);
    return parent[index];
  }

  function union(a: number, b: number) {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) {
      parent[rootB] = rootA;
    }
  }

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (areNamesSimilar(items[i].name, items[j].name)) {
        union(i, j);
      }
    }
  }

  const clusters = new Map<number, WardrobeItemRow[]>();

  for (let index = 0; index < items.length; index += 1) {
    const root = find(index);
    const cluster = clusters.get(root) ?? [];
    cluster.push(items[index]);
    clusters.set(root, cluster);
  }

  return Array.from(clusters.values())
    .filter((groupItems) => groupItems.length > 1)
    .map((groupItems) => {
      const sorted = groupItems.sort((a, b) => a.name.localeCompare(b.name));
      const label = sorted[0]?.name ?? "Similar names";
      return {
        id: `similar_name:${normalizeKey(label)}:${sorted.map((item) => item.id).join("-")}`,
        reason: "similar_name" as const,
        label,
        items: sorted,
      };
    })
    .sort((a, b) => b.items.length - a.items.length);
}

export function buildDuplicateReview(items: WardrobeItemRow[]): ReviewCleanupResult {
  const codeGroups = buildGroupsByKey(
    items,
    "same_code",
    (item) => normalizeKey(item.code),
    (key) => key.toUpperCase(),
  );

  const exactNameGroups = buildGroupsByKey(
    items,
    "similar_name",
    (item) => normalizeKey(item.name),
    (key) => key.replace(/\b\w/g, (char) => char.toUpperCase()),
  );

  const similarNameGroups = buildSimilarNameGroups(items).filter(
    (group) =>
      !exactNameGroups.some(
        (exactGroup) =>
          exactGroup.items.length === group.items.length &&
          exactGroup.items.every((item, index) => item.id === group.items[index]?.id),
      ),
  );

  const groups = [...codeGroups, ...exactNameGroups, ...similarNameGroups];
  const duplicateIds = new Set<string>();

  for (const group of groups) {
    for (const item of group.items) {
      duplicateIds.add(item.id);
    }
  }

  return {
    groups,
    totalItems: items.length,
    duplicateItemCount: duplicateIds.size,
  };
}

export async function fetchAllItemsForReview(): Promise<{
  data: WardrobeItemRow[] | null;
  error: Error | null;
}> {
  return selectAllItemsForReview();
}

export async function bulkCleanupWardrobeItems(
  ids: string[],
  mode: BulkCleanupMode,
): Promise<{ data: BulkCleanupResult | null; error: Error | null }> {
  if (mode === "retire") {
    const result = await bulkRetireWardrobeItems(ids);
    if (result.error) {
      return { data: null, error: result.error };
    }
    return {
      data: { processed: result.data?.length ?? 0, mode },
      error: null,
    };
  }

  const result = await hardDeleteWardrobeItems(ids);
  if (result.error) {
    return { data: null, error: result.error };
  }

  return {
    data: { processed: result.data?.deleted ?? 0, mode },
    error: null,
  };
}
