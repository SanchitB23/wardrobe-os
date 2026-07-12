/**
 * Quick Log slot selection → wear-event item entries (RFC-023 follow-up).
 *
 * Pure: flattens per-slot item-id arrays (in slot order) plus slot-less extras
 * into ordered, de-duplicated { itemId, slot } entries for createAdHocWearLog.
 * De-dupes by itemId — first occurrence wins, so a slotted pick beats an extra.
 */

export interface WearLogSlotEntry {
  itemId: string;
  slot: string | null;
}

export function buildWearLogSlotEntries(
  slotPicks: Readonly<Partial<Record<string, readonly string[]>>>,
  slotOrder: readonly string[],
  extraIds: readonly string[] = [],
): WearLogSlotEntry[] {
  const seen = new Set<string>();
  const entries: WearLogSlotEntry[] = [];

  for (const slot of slotOrder) {
    for (const itemId of slotPicks[slot] ?? []) {
      if (!itemId || seen.has(itemId)) continue;
      seen.add(itemId);
      entries.push({ itemId, slot });
    }
  }

  for (const itemId of extraIds) {
    if (!itemId || seen.has(itemId)) continue;
    seen.add(itemId);
    entries.push({ itemId, slot: null });
  }

  return entries;
}
