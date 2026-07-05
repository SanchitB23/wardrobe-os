export function calculateCostPerWear(
  price: number | null | undefined,
  wearCount: number,
): number | null {
  if (price === null || price === undefined || wearCount === 0) {
    return null;
  }

  return roundCurrency(price / wearCount);
}

export function calculateAverageCostPerWear(
  totalWardrobeValue: number,
  totalWears: number,
): number | null {
  if (totalWears === 0) {
    return null;
  }

  return roundCurrency(totalWardrobeValue / totalWears);
}

export function aggregateWearCounts(
  wearLogItemIds: readonly { item_id: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const row of wearLogItemIds) {
    counts.set(row.item_id, (counts.get(row.item_id) ?? 0) + 1);
  }

  return counts;
}

export function sumWearCounts(counts: ReadonlyMap<string, number>): number {
  let total = 0;

  for (const count of counts.values()) {
    total += count;
  }

  return total;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
