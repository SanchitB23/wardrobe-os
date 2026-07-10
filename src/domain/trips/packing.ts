/**
 * Packing checklist projection (RFC-017) — merges the deterministic packing
 * list (from the Lifestyle Engine) with the persisted packed-item set to render
 * a tickable checklist. Pure: the packed state never alters the plan.
 */

import type { PackingChecklist } from "@/domain/trips/types";

/**
 * Build a checklist from the plan's `packingList.bySlot` and the set of packed
 * item ids. Counts total/packed across all slots. `nameOf` resolves display
 * labels (falls back to the id).
 */
export function buildPackingChecklist(
  bySlot: Record<string, string[]>,
  packedItemIds: string[],
  nameOf: (id: string) => string,
): PackingChecklist {
  const packedSet = new Set(packedItemIds);
  const out: PackingChecklist["bySlot"] = {};
  let packed = 0;
  let total = 0;

  for (const [slot, ids] of Object.entries(bySlot)) {
    out[slot] = ids.map((itemId) => {
      const isPacked = packedSet.has(itemId);
      total += 1;
      if (isPacked) packed += 1;
      return { itemId, label: nameOf(itemId), packed: isPacked };
    });
  }

  return { bySlot: out, packed, total };
}
