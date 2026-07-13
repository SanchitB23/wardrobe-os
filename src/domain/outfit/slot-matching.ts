import type { OutfitSlot } from "@/types/wardrobe";

import {
  OUTFIT_SLOT_DEFINITIONS,
  resolveOutfitSlot,
} from "@/domain/outfit/slot-resolution";

export { OUTFIT_SLOT_DEFINITIONS };

/**
 * True iff the category resolves (non-fallback) to exactly this slot. Backed
 * by the canonical resolver (RFC-030), so matching is exclusive: a resolvable
 * category belongs to one slot; unknown categories match none.
 */
export function categoryMatchesOutfitSlot(
  categoryName: string | null | undefined,
  slot: OutfitSlot,
): boolean {
  if (!categoryName) {
    return false;
  }

  const resolution = resolveOutfitSlot(categoryName);
  return resolution.source !== "fallback" && resolution.slot === slot;
}

export function getRequiredOutfitSlots(): OutfitSlot[] {
  return OUTFIT_SLOT_DEFINITIONS.filter((definition) => !definition.optional).map(
    (definition) => definition.slot,
  );
}

export function getOptionalOutfitSlots(): OutfitSlot[] {
  return OUTFIT_SLOT_DEFINITIONS.filter((definition) => definition.optional).map(
    (definition) => definition.slot,
  );
}
