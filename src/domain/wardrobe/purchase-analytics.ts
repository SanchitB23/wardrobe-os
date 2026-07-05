import {
  calculateAverageCostPerWear,
  calculateCostPerWear,
} from "@/domain/wardrobe/cost-per-wear";
import type {
  MonthlySpendingItem,
  PurchaseAnalytics,
  PurchaseAnalyticsItem,
  SpendingAmountItem,
} from "@/types/wardrobe";

type PurchaseInput = {
  item_id: string;
  purchase_date: string;
  price: number;
  status: string | null;
};

type ItemLookupInput = {
  id: string;
  code: string;
  name: string;
  brand_id: string | null;
  category_id: string | null;
};

export type BuildPurchaseAnalyticsInput = {
  purchases: readonly PurchaseInput[];
  items: readonly ItemLookupInput[];
  wearCounts: ReadonlyMap<string, number>;
  brandNames: ReadonlyMap<string, string>;
  categoryNames: ReadonlyMap<string, string>;
  formatMonthLabel: (monthKey: string) => string;
};

export function isReturnedPurchaseStatus(
  status: string | null | undefined,
): boolean {
  return status === "returned";
}

export function filterActivePurchases(
  purchases: readonly PurchaseInput[],
): PurchaseInput[] {
  return purchases.filter((purchase) => !isReturnedPurchaseStatus(purchase.status));
}

export function sumPurchaseAmounts(purchases: readonly PurchaseInput[]): number {
  return roundCurrency(
    purchases.reduce((sum, purchase) => sum + Number(purchase.price), 0),
  );
}

export function sumAmountsByItemKey(
  purchases: readonly PurchaseInput[],
  itemById: ReadonlyMap<string, ItemLookupInput>,
  key: "brand_id" | "category_id",
  nameById: ReadonlyMap<string, string>,
  nullLabel: string,
): SpendingAmountItem[] {
  const totals = new Map<string, number>();

  for (const purchase of purchases) {
    if (isReturnedPurchaseStatus(purchase.status)) {
      continue;
    }

    const item = itemById.get(purchase.item_id);
    const rawKey = item?.[key] ?? null;
    const mapKey = rawKey ?? "__none__";
    totals.set(mapKey, (totals.get(mapKey) ?? 0) + Number(purchase.price));
  }

  return [...totals.entries()]
    .map(([id, amount]) => ({
      id: id === "__none__" ? null : id,
      name: id === "__none__" ? nullLabel : (nameById.get(id) ?? "Unknown"),
      amount: roundCurrency(amount),
    }))
    .sort((left, right) => {
      if (right.amount !== left.amount) {
        return right.amount - left.amount;
      }
      return left.name.localeCompare(right.name);
    });
}

export function buildMonthlySpendingTimeline(
  purchases: readonly PurchaseInput[],
  formatMonthLabel: (monthKey: string) => string,
): MonthlySpendingItem[] {
  const monthlyTotals = new Map<string, number>();

  for (const purchase of purchases) {
    const monthKey = purchase.purchase_date.slice(0, 7);
    monthlyTotals.set(
      monthKey,
      (monthlyTotals.get(monthKey) ?? 0) + Number(purchase.price),
    );
  }

  return [...monthlyTotals.entries()]
    .map(([month, amount]) => ({
      month,
      label: formatMonthLabel(month),
      amount: roundCurrency(amount),
    }))
    .sort((left, right) => left.month.localeCompare(right.month));
}

export function buildPurchaseAnalytics(
  input: BuildPurchaseAnalyticsInput,
): PurchaseAnalytics {
  const activePurchases = filterActivePurchases(input.purchases);
  const itemById = new Map(input.items.map((item) => [item.id, item]));
  const totalWardrobeValue = sumPurchaseAmounts(activePurchases);

  let totalWears = 0;
  for (const count of input.wearCounts.values()) {
    totalWears += count;
  }

  const analyticsItems: PurchaseAnalyticsItem[] = activePurchases
    .map((purchase) => {
      const item = itemById.get(purchase.item_id);
      if (!item) {
        return null;
      }

      const wearCount = input.wearCounts.get(item.id) ?? 0;
      return {
        id: item.id,
        code: item.code,
        name: item.name,
        price: Number(purchase.price),
        brand: item.brand_id ? (input.brandNames.get(item.brand_id) ?? null) : null,
        category: item.category_id
          ? (input.categoryNames.get(item.category_id) ?? null)
          : null,
        wearCount,
        costPerWear: calculateCostPerWear(Number(purchase.price), wearCount),
      };
    })
    .filter((item): item is PurchaseAnalyticsItem => item !== null);

  const sortedByPrice = [...analyticsItems].sort((left, right) => {
    if (right.price !== left.price) {
      return right.price - left.price;
    }
    return left.name.localeCompare(right.name);
  });

  const spendingByBrand = sumAmountsByItemKey(
    activePurchases,
    itemById,
    "brand_id",
    input.brandNames,
    "Unknown brand",
  );
  const spendingByCategory = sumAmountsByItemKey(
    activePurchases,
    itemById,
    "category_id",
    input.categoryNames,
    "Uncategorized",
  );

  return {
    totalWardrobeValue,
    averageCostPerWear: calculateAverageCostPerWear(totalWardrobeValue, totalWears),
    mostExpensiveItem: sortedByPrice[0] ?? null,
    cheapestItem: sortedByPrice[sortedByPrice.length - 1] ?? null,
    topBrandsByValue: spendingByBrand.slice(0, 10),
    spendingByBrand,
    spendingByCategory,
    monthlyTimeline: buildMonthlySpendingTimeline(
      activePurchases,
      input.formatMonthLabel,
    ),
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
