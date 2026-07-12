/**
 * Wear combination fingerprinting (RFC-023).
 * Deterministic, order-insensitive, duplicate-collapsing.
 */

import { createHash } from "node:crypto";

import {
  DEFAULT_PROMOTE_THRESHOLD,
  MIN_ITEMS_FOR_PROMOTE_SUGGESTION,
  type CombinationSuggestion,
  type OutfitPromoteDraft,
  type WearLogEventModel,
  type WearLogItemRef,
} from "@/domain/wear-logs/types";

/** Normalize item ids → sorted unique list. */
export function normalizeItemIds(itemIds: readonly string[]): string[] {
  const unique = new Set<string>();
  for (const id of itemIds) {
    const trimmed = id?.trim();
    if (trimmed) unique.add(trimmed);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

/**
 * Stable combination key: sha256(sorted unique ids joined by "|"), truncated.
 * Empty set throws — callers must validate ≥1 item before fingerprinting.
 */
export function buildCombinationKey(itemIds: readonly string[]): string {
  const normalized = normalizeItemIds(itemIds);
  if (normalized.length === 0) {
    throw new Error("Cannot build combination key from an empty item set.");
  }
  return createHash("sha256").update(normalized.join("|")).digest("hex").slice(0, 32);
}

export function shouldSuggestOutfitPromotion(
  count: number,
  options?: {
    threshold?: number;
    itemCount?: number;
    /** When true (outfit-sourced wears), never suggest. */
    alreadyCurated?: boolean;
  },
): boolean {
  if (options?.alreadyCurated) return false;
  const threshold = options?.threshold ?? DEFAULT_PROMOTE_THRESHOLD;
  const itemCount = options?.itemCount ?? MIN_ITEMS_FOR_PROMOTE_SUGGESTION;
  if (itemCount < MIN_ITEMS_FOR_PROMOTE_SUGGESTION) return false;
  return count >= threshold;
}

export function buildCombinationSuggestion(input: {
  combinationKey: string;
  count: number;
  itemCount: number;
  threshold?: number;
  sourceIsOutfit?: boolean;
}): CombinationSuggestion {
  const threshold = input.threshold ?? DEFAULT_PROMOTE_THRESHOLD;
  return {
    combinationKey: input.combinationKey,
    count: input.count,
    threshold,
    itemCount: input.itemCount,
    shouldSuggestPromote: shouldSuggestOutfitPromotion(input.count, {
      threshold,
      itemCount: input.itemCount,
      alreadyCurated: input.sourceIsOutfit === true,
    }),
  };
}

/** Prefill outfit-create DTO from a wear event (user still names + confirms). */
export function mapWearLogToOutfitDraft(
  wearLog: Pick<WearLogEventModel, "items" | "occasionId" | "notes" | "wornOn">,
): OutfitPromoteDraft {
  if (wearLog.items.length === 0) {
    throw new Error("Cannot promote a wear log with no items.");
  }
  const ordered = [...wearLog.items].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    nameHint: null,
    itemIds: ordered.map((i) => i.itemId),
    slots: ordered.map((i) => ({
      itemId: i.itemId,
      slot: i.slot,
      sortOrder: i.sortOrder,
    })),
    occasionId: wearLog.occasionId,
    notes: wearLog.notes,
  };
}

/** Assign sort_order 0..n-1 preserving input order after de-dupe by first occurrence. */
export function buildOrderedWearItems(
  items: readonly { itemId: string; slot?: string | null }[],
): WearLogItemRef[] {
  const seen = new Set<string>();
  const out: WearLogItemRef[] = [];
  for (const item of items) {
    const id = item.itemId?.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      itemId: id,
      slot: item.slot ?? null,
      sortOrder: out.length,
    });
  }
  if (out.length === 0) {
    throw new Error("Wear log requires at least one item.");
  }
  return out;
}

/**
 * Legacy backfill grouping key for outfit-linked rows.
 * Ad-hoc legacy rows should stay one-event-per-row (caller decides).
 */
export function legacyOutfitGroupKey(row: {
  wornOn: string;
  outfitId: string;
  notes: string | null;
  occasionId: string | null;
}): string {
  return [
    row.wornOn,
    row.outfitId,
    row.notes ?? "",
    row.occasionId ?? "",
  ].join("\u0001");
}
