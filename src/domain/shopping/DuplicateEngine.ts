/**
 * DuplicateEngine (RFC-018) — pure. Clusters duplicates across the wishlist and
 * against the wardrobe. Wishlist-vs-wardrobe **reuses the acquisition engine's
 * `similarExistingItems`** (already computed per item — no duplicated similarity
 * logic); wishlist-vs-wishlist uses a small deterministic field overlap.
 */

import type { BuyVsSkipAnalysis, ProspectiveItem } from "@/domain/acquisition";
import { DUPLICATE_OVERLAP_THRESHOLD } from "@/domain/shopping/constants";
import type { DuplicateAnalysis, DuplicateCluster } from "@/domain/shopping/types";

export interface DuplicateInput {
  id: string;
  item: ProspectiveItem;
  analysis: BuyVsSkipAnalysis;
}

const norm = (v: string | null | undefined) => (v ? v.trim().toLowerCase() : "");

/** 0–1 overlap between two prospective items (category .5 + color .25 + formality .25). */
export function itemOverlap(a: ProspectiveItem, b: ProspectiveItem): number {
  let score = 0;
  if (norm(a.category) && norm(a.category) === norm(b.category)) score += 0.5;
  if (norm(a.color) && norm(a.color) === norm(b.color)) score += 0.25;
  if (norm(a.formality) && norm(a.formality) === norm(b.formality)) score += 0.25;
  return score;
}

export function analyzeDuplicates(
  entries: DuplicateInput[],
  threshold: number = DUPLICATE_OVERLAP_THRESHOLD,
): DuplicateAnalysis {
  const clusters: DuplicateCluster[] = [];
  const involved = new Set<string>();

  // Wishlist ↔ wardrobe — reuse the acquisition verdict's similar owned items.
  for (const entry of entries) {
    const similar = entry.analysis.similarExistingItems.filter((s) => s.overlap >= threshold);
    if (similar.length === 0) continue;
    involved.add(entry.id);
    clusters.push({
      reason: `"${entry.item.name}" is similar to pieces you already own`,
      overlap: Math.max(...similar.map((s) => s.overlap)),
      members: [
        { kind: "wishlist", id: entry.id, name: entry.item.name },
        ...similar.map((s) => ({ kind: "wardrobe" as const, id: s.itemId, name: s.name })),
      ],
    });
  }

  // Wishlist ↔ wishlist — near-duplicate candidates.
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const overlap = itemOverlap(entries[i].item, entries[j].item);
      if (overlap < threshold) continue;
      involved.add(entries[i].id);
      involved.add(entries[j].id);
      clusters.push({
        reason: `"${entries[i].item.name}" and "${entries[j].item.name}" are near-duplicates`,
        overlap,
        members: [
          { kind: "wishlist", id: entries[i].id, name: entries[i].item.name },
          { kind: "wishlist", id: entries[j].id, name: entries[j].item.name },
        ],
      });
    }
  }

  return { clusters, wishlistDuplicateCount: involved.size };
}
