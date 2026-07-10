/**
 * ROIEngine (RFC-018) — pure. Realized cost-per-wear across owned purchases,
 * projected cost-per-wear for the queue, and an aggregate "are you buying well?"
 * signal (utilization of what you've bought). Reuses the shared cost-per-wear
 * helpers (`@/domain/wardrobe`) — no duplicated money logic.
 */

import { calculateAverageCostPerWear, calculateCostPerWear } from "@/domain/wardrobe";
import type {
  PurchaseRecord,
  ShoppingRecommendation,
  ShoppingROI,
} from "@/domain/shopping/types";

export function computeShoppingROI(
  purchases: PurchaseRecord[],
  queue: ShoppingRecommendation[],
): ShoppingROI {
  const realized = purchases.map((p) => ({
    itemId: p.itemId,
    name: p.name,
    price: p.price,
    wears: p.wears,
    costPerWear: calculateCostPerWear(p.price, p.wears),
  }));

  const projected = queue.map((r) => ({
    id: r.id,
    name: r.item.name,
    estimatedCostPerWear: r.analysis.estimatedCostPerWear,
  }));

  const totalSpend = purchases.reduce((sum, p) => sum + (p.price ?? 0), 0);
  const totalWears = purchases.reduce((sum, p) => sum + p.wears, 0);
  const averageCostPerWear = calculateAverageCostPerWear(totalSpend, totalWears);

  // Utilization: share of purchases actually worn. Currency-agnostic, deterministic.
  const worn = purchases.filter((p) => p.wears > 0).length;
  const wardrobeRoiScore =
    purchases.length === 0 ? 0 : Math.round((worn / purchases.length) * 100);

  return { realized, projected, totalSpend, averageCostPerWear, wardrobeRoiScore };
}
