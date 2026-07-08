/**
 * PackingPlanner (RFC-006) — turns the capsule into a packing list, respecting
 * the luggage constraint and the planning strategy (generosity). When over the
 * luggage cap it trims deterministically, keeping the items that cover the most
 * days. `packingConfidence` reports coverage after any trim. Pure.
 */

import { coverageByItem, type Capsule } from "@/domain/lifestyle/CapsulePlanner";
import type { StrategyProfile } from "@/domain/lifestyle/PlanningStrategy";
import type {
  DailyOutfit,
  LuggageConstraint,
  PackingList,
} from "@/domain/lifestyle/types";
import type { StyleDNAItem } from "@/domain/style-dna";

function coarseSlot(category: string | null | undefined): string {
  const c = (category ?? "").toLowerCase();
  if (/shoe|sneaker|boot|loafer|sandal|footwear|trainer/.test(c)) return "footwear";
  if (/jacket|coat|blazer|outerwear|hoodie|sweater|cardigan/.test(c)) return "outerwear";
  if (/trouser|jean|chino|short|pant|skirt|bottom/.test(c)) return "bottom";
  if (/belt|watch|bag|scarf|hat|cap|accessor|fragrance/.test(c)) return "accessory";
  if (/shirt|tee|t-shirt|polo|top|kurta/.test(c)) return "top";
  return "other";
}

export interface PackingResult {
  packingList: PackingList;
  packingConfidence: number;
}

export function planPacking(
  dailyOutfits: DailyOutfit[],
  capsule: Capsule,
  wardrobe: StyleDNAItem[],
  luggage: LuggageConstraint,
  strategy: StrategyProfile,
): PackingResult {
  const byId = new Map(wardrobe.map((i) => [i.id, i]));
  const coverage = coverageByItem(dailyOutfits);
  const daysCovered = (id: string) => coverage.get(id)?.length ?? 0;

  // Start from the capsule, then add `packingSlack` versatile spares (highest
  // rating, deterministic), never duplicating capsule items.
  const capsuleSet = new Set(capsule.itemIds);
  const spares = wardrobe
    .filter((i) => !capsuleSet.has(i.id))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, strategy.packingSlack))
    .map((i) => i.id);

  let packed = [...capsule.itemIds, ...spares];

  const max = luggage.kind === "unbounded" ? null : (luggage.maxItems ?? null);
  if (max != null && packed.length > max) {
    // Keep the most-covering items; drop least-covering first (tie-break by id).
    packed = [...packed]
      .sort((a, b) => daysCovered(b) - daysCovered(a) || a.localeCompare(b))
      .slice(0, max);
  }

  const packedSet = new Set(packed);
  const bySlot: Record<string, string[]> = {};
  for (const id of [...packed].sort()) {
    const slot = coarseSlot(byId.get(id)?.category ?? null);
    (bySlot[slot] ??= []).push(id);
  }

  // Confidence = fraction of days whose full outfit is still packable.
  const total = dailyOutfits.filter((o) => !o.uncovered).length;
  const fullyPackable = dailyOutfits.filter(
    (o) => !o.uncovered && o.itemIds.every((id) => packedSet.has(id)),
  ).length;
  const packingConfidence = total === 0 ? 0 : Number((fullyPackable / total).toFixed(4));

  return {
    packingList: {
      itemIds: [...packed].sort(),
      bySlot,
      count: packed.length,
      withinLuggage: max == null || packed.length <= max,
    },
    packingConfidence,
  };
}
