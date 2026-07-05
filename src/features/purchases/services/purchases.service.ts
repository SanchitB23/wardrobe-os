import {
  insertPurchase,
  selectAllBrands,
  selectAllCategories,
  selectAllItemsLookup,
  selectAllPurchases,
  selectItemIdsByBrandId,
  selectItemIdsByCategoryId,
  selectItemsByIds,
  selectPurchaseByItemId,
  selectPurchases,
  selectWearLogItemIds,
  updatePurchaseById,
} from "@/features/purchases/repositories/purchases.repository";
import type {
  CreatePurchaseInput,
  ItemPurchaseDetail,
  LookupOption,
  MonthlySpendingItem,
  PurchaseAnalytics,
  PurchaseFilters,
  PurchaseListRow,
  PurchaseRow,
  SpendingAmountItem,
  UpdatePurchaseInput,
} from "@/features/purchases/types";
import {
  aggregateWearCounts,
  calculateCostPerWear,
} from "@/domain/wardrobe/cost-per-wear";
import {
  buildMonthlySpendingTimeline,
  buildPurchaseAnalytics,
  isReturnedPurchaseStatus,
} from "@/domain/wardrobe/purchase-analytics";

export function formatPurchaseDateInput(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatPurchaseDisplayDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short", day: "numeric" },
  );
}

async function fetchWearCountsByItem(): Promise<{
  data: Map<string, number> | null;
  error: Error | null;
}> {
  const result = await selectWearLogItemIds();

  if (result.error) {
    return { data: null, error: result.error };
  }

  return {
    data: aggregateWearCounts(result.data ?? []),
    error: null,
  };
}

async function resolveFilteredItemIds(
  filters: PurchaseFilters,
): Promise<{ data: string[] | null; error: Error | null }> {
  let itemIds: Set<string> | null = null;

  if (filters.brandId) {
    const brandItems = await selectItemIdsByBrandId(filters.brandId);
    if (brandItems.error) {
      return { data: null, error: brandItems.error };
    }
    itemIds = new Set(brandItems.data ?? []);
    if (itemIds.size === 0) {
      return { data: [], error: null };
    }
  }

  if (filters.categoryId) {
    const categoryItems = await selectItemIdsByCategoryId(filters.categoryId);
    if (categoryItems.error) {
      return { data: null, error: categoryItems.error };
    }
    const categorySet = new Set(categoryItems.data ?? []);
    if (categorySet.size === 0) {
      return { data: [], error: null };
    }
    itemIds = itemIds
      ? new Set([...itemIds].filter((id) => categorySet.has(id)))
      : categorySet;
    if (itemIds.size === 0) {
      return { data: [], error: null };
    }
  }

  return { data: itemIds ? [...itemIds] : null, error: null };
}

async function enrichPurchases(
  purchases: PurchaseRow[],
): Promise<{ data: PurchaseListRow[] | null; error: Error | null }> {
  if (purchases.length === 0) {
    return { data: [], error: null };
  }

  const itemIds = [...new Set(purchases.map((purchase) => purchase.item_id))];

  const [itemsResult, brandsResult, categoriesResult] = await Promise.all([
    selectItemsByIds(itemIds),
    selectAllBrands(),
    selectAllCategories(),
  ]);

  const firstError =
    itemsResult.error ?? brandsResult.error ?? categoriesResult.error;

  if (firstError) {
    return { data: null, error: firstError };
  }

  const brandMap = new Map(
    ((brandsResult.data ?? []) as LookupOption[]).map((brand) => [brand.id, brand]),
  );
  const categoryMap = new Map(
    ((categoriesResult.data ?? []) as LookupOption[]).map((category) => [
      category.id,
      category,
    ]),
  );
  const itemMap = new Map(
    (itemsResult.data ?? []).map((item) => [
      item.id,
      {
        id: item.id,
        code: item.code,
        name: item.name,
        brand: item.brand_id ? (brandMap.get(item.brand_id) ?? null) : null,
        category: item.category_id
          ? (categoryMap.get(item.category_id) ?? null)
          : null,
      },
    ]),
  );

  return {
    data: purchases.map((purchase) => ({
      ...purchase,
      item: itemMap.get(purchase.item_id) ?? null,
    })),
    error: null,
  };
}

export async function fetchItemPurchase(
  itemId: string,
): Promise<{ data: PurchaseRow | null; error: Error | null }> {
  return selectPurchaseByItemId(itemId);
}

export async function fetchItemPurchaseDetail(
  itemId: string,
): Promise<{ data: ItemPurchaseDetail | null; error: Error | null }> {
  const [purchaseResult, wearCountsResult] = await Promise.all([
    fetchItemPurchase(itemId),
    fetchWearCountsByItem(),
  ]);

  if (purchaseResult.error) {
    return { data: null, error: purchaseResult.error };
  }

  if (wearCountsResult.error) {
    return { data: null, error: wearCountsResult.error };
  }

  const wearCount = wearCountsResult.data?.get(itemId) ?? 0;
  const price = purchaseResult.data?.price ?? null;

  return {
    data: {
      purchase: purchaseResult.data,
      wearCount,
      costPerWear: calculateCostPerWear(price, wearCount),
    },
    error: null,
  };
}

export async function createPurchase(
  input: CreatePurchaseInput,
): Promise<{ data: PurchaseRow | null; error: Error | null }> {
  return insertPurchase({
    item_id: input.item_id,
    purchase_date: input.purchase_date,
    price: input.price,
    source: input.source?.trim() || null,
    status: input.status ?? "active",
    return_reason:
      input.status === "returned" ? input.return_reason?.trim() || null : null,
  });
}

export async function updatePurchase(
  input: UpdatePurchaseInput,
): Promise<{ data: PurchaseRow | null; error: Error | null }> {
  const { id, purchase_date, price, source, status, return_reason } = input;

  return updatePurchaseById(id, {
    purchase_date,
    price,
    source: source?.trim() || null,
    status: status ?? "active",
    return_reason:
      status === "returned" ? return_reason?.trim() || null : null,
  });
}

export async function fetchPurchases(
  filters: PurchaseFilters = {},
): Promise<{ data: PurchaseListRow[] | null; error: Error | null }> {
  const filteredItemIds = await resolveFilteredItemIds(filters);

  if (filteredItemIds.error) {
    return { data: null, error: filteredItemIds.error };
  }

  if (filteredItemIds.data && filteredItemIds.data.length === 0) {
    return { data: [], error: null };
  }

  const purchasesResult = await selectPurchases({
    itemIds: filteredItemIds.data,
    status: filters.status,
    year: filters.year,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
  });

  if (purchasesResult.error) {
    return { data: null, error: purchasesResult.error };
  }

  return enrichPurchases(purchasesResult.data ?? []);
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  if (!year || !month) {
    return monthKey;
  }
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    undefined,
    { month: "short", year: "numeric" },
  );
}

export async function fetchPurchaseAnalytics(): Promise<{
  data: PurchaseAnalytics | null;
  error: Error | null;
}> {
  const [purchasesResult, itemsResult, brandsResult, categoriesResult, wearCountsResult] =
    await Promise.all([
      selectAllPurchases(),
      selectAllItemsLookup(),
      selectAllBrands(),
      selectAllCategories(),
      fetchWearCountsByItem(),
    ]);

  const firstError =
    purchasesResult.error ??
    itemsResult.error ??
    brandsResult.error ??
    categoriesResult.error ??
    wearCountsResult.error;

  if (firstError) {
    return { data: null, error: firstError };
  }

  const brandMap = new Map(
    ((brandsResult.data ?? []) as LookupOption[]).map((brand) => [brand.id, brand.name]),
  );
  const categoryMap = new Map(
    ((categoriesResult.data ?? []) as LookupOption[]).map((category) => [
      category.id,
      category.name,
    ]),
  );

  return {
    data: buildPurchaseAnalytics({
      purchases: purchasesResult.data ?? [],
      items: itemsResult.data ?? [],
      wearCounts: wearCountsResult.data ?? new Map(),
      brandNames: brandMap,
      categoryNames: categoryMap,
      formatMonthLabel,
    }),
    error: null,
  };
}

export async function fetchPurchaseChartData(
  filters: PurchaseFilters = {},
): Promise<{
  data: {
    monthly: MonthlySpendingItem[];
    byBrand: SpendingAmountItem[];
    byCategory: SpendingAmountItem[];
  } | null;
  error: Error | null;
}> {
  const purchasesResult = await fetchPurchases(filters);

  if (purchasesResult.error) {
    return { data: null, error: purchasesResult.error };
  }

  const activePurchases = (purchasesResult.data ?? []).filter(
    (purchase) => !isReturnedPurchaseStatus(purchase.status),
  );
  const monthlyTotals = new Map<string, number>();
  const brandTotals = new Map<string, SpendingAmountItem>();
  const categoryTotals = new Map<string, SpendingAmountItem>();

  for (const purchase of activePurchases) {
    const monthKey = purchase.purchase_date.slice(0, 7);
    monthlyTotals.set(
      monthKey,
      (monthlyTotals.get(monthKey) ?? 0) + Number(purchase.price),
    );

    const brand = purchase.item?.brand;
    const brandKey = brand?.id ?? "__none__";
    const existingBrand = brandTotals.get(brandKey);
    brandTotals.set(brandKey, {
      id: brand?.id ?? null,
      name: brand?.name ?? "Unknown brand",
      amount:
        Math.round(((existingBrand?.amount ?? 0) + Number(purchase.price)) * 100) /
        100,
    });

    const category = purchase.item?.category;
    const categoryKey = category?.id ?? "__none__";
    const existingCategory = categoryTotals.get(categoryKey);
    categoryTotals.set(categoryKey, {
      id: category?.id ?? null,
      name: category?.name ?? "Uncategorized",
      amount:
        Math.round(
          ((existingCategory?.amount ?? 0) + Number(purchase.price)) * 100,
        ) / 100,
    });
  }

  return {
    data: {
      monthly: buildMonthlySpendingTimeline(activePurchases, formatMonthLabel),
      byBrand: [...brandTotals.values()].sort((left, right) => {
        if (right.amount !== left.amount) {
          return right.amount - left.amount;
        }
        return left.name.localeCompare(right.name);
      }),
      byCategory: [...categoryTotals.values()].sort((left, right) => {
        if (right.amount !== left.amount) {
          return right.amount - left.amount;
        }
        return left.name.localeCompare(right.name);
      }),
    },
    error: null,
  };
}

export { isReturnedPurchaseStatus };
