import { createClient } from "@/lib/supabase/client";
import type {
  CreatePurchaseInput,
  ItemPurchaseDetail,
  LookupOption,
  MonthlySpendingItem,
  PurchaseAnalytics,
  PurchaseAnalyticsItem,
  PurchaseFilters,
  PurchaseListRow,
  PurchaseRow,
  SpendingAmountItem,
  UpdatePurchaseInput,
} from "@/types/wardrobe";
import {
  calculateCostPerWear,
  UNCATEGORIZED_CATEGORY_ID,
} from "@/types/wardrobe";

const PURCHASE_SELECT =
  "id, item_id, purchase_date, price, source, status, return_reason, created_at";

type ItemLookupRow = {
  id: string;
  code: string;
  name: string;
  brand_id: string | null;
  category_id: string | null;
};

function toError(message: string) {
  return new Error(message);
}

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

function isReturnedStatus(status: string | null | undefined): boolean {
  return status === "returned";
}

async function fetchWearCountsByItem(): Promise<{
  data: Map<string, number> | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.from("wear_logs").select("item_id");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.item_id, (counts.get(row.item_id) ?? 0) + 1);
  }

  return { data: counts, error: null };
}

async function fetchBrandItemIds(
  brandId: string,
): Promise<{ data: string[] | null; error: Error | null }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("id")
    .eq("brand_id", brandId);

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []).map((row) => row.id), error: null };
}

async function fetchCategoryItemIds(
  categoryId: string,
): Promise<{ data: string[] | null; error: Error | null }> {
  const supabase = createClient();
  let query = supabase.from("wardrobe_items").select("id");

  if (categoryId === UNCATEGORIZED_CATEGORY_ID) {
    query = query.is("category_id", null);
  } else {
    query = query.eq("category_id", categoryId);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []).map((row) => row.id), error: null };
}

async function resolveFilteredItemIds(
  filters: PurchaseFilters,
): Promise<{ data: string[] | null; error: Error | null }> {
  let itemIds: Set<string> | null = null;

  if (filters.brandId) {
    const brandItems = await fetchBrandItemIds(filters.brandId);
    if (brandItems.error) {
      return { data: null, error: brandItems.error };
    }
    itemIds = new Set(brandItems.data ?? []);
    if (itemIds.size === 0) {
      return { data: [], error: null };
    }
  }

  if (filters.categoryId) {
    const categoryItems = await fetchCategoryItemIds(filters.categoryId);
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

  const supabase = createClient();
  const itemIds = [...new Set(purchases.map((purchase) => purchase.item_id))];

  const [itemsResult, brandsResult, categoriesResult] = await Promise.all([
    supabase
      .from("wardrobe_items")
      .select("id, code, name, brand_id, category_id")
      .in("id", itemIds),
    supabase.from("brands").select("id, name"),
    supabase.from("categories").select("id, name"),
  ]);

  const firstError =
    itemsResult.error ?? brandsResult.error ?? categoriesResult.error;

  if (firstError) {
    return { data: null, error: toError(firstError.message) };
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
  const supabase = createClient();
  const { data, error } = await supabase
    .from("purchases")
    .select(PURCHASE_SELECT)
    .eq("item_id", itemId)
    .maybeSingle();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data as PurchaseRow | null) ?? null, error: null };
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
  const supabase = createClient();

  const { data, error } = await supabase
    .from("purchases")
    .insert({
      item_id: input.item_id,
      purchase_date: input.purchase_date,
      price: input.price,
      source: input.source?.trim() || null,
      status: input.status ?? "active",
      return_reason:
        input.status === "returned" ? input.return_reason?.trim() || null : null,
    })
    .select(PURCHASE_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as PurchaseRow, error: null };
}

export async function updatePurchase(
  input: UpdatePurchaseInput,
): Promise<{ data: PurchaseRow | null; error: Error | null }> {
  const supabase = createClient();
  const { id, purchase_date, price, source, status, return_reason } = input;

  const { data, error } = await supabase
    .from("purchases")
    .update({
      purchase_date,
      price,
      source: source?.trim() || null,
      status: status ?? "active",
      return_reason:
        status === "returned" ? return_reason?.trim() || null : null,
    })
    .eq("id", id)
    .select(PURCHASE_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as PurchaseRow, error: null };
}

export async function fetchPurchases(
  filters: PurchaseFilters = {},
): Promise<{ data: PurchaseListRow[] | null; error: Error | null }> {
  const supabase = createClient();
  const filteredItemIds = await resolveFilteredItemIds(filters);

  if (filteredItemIds.error) {
    return { data: null, error: filteredItemIds.error };
  }

  if (filteredItemIds.data && filteredItemIds.data.length === 0) {
    return { data: [], error: null };
  }

  let query = supabase
    .from("purchases")
    .select(PURCHASE_SELECT)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filteredItemIds.data) {
    query = query.in("item_id", filteredItemIds.data);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.year) {
    query = query
      .gte("purchase_date", `${filters.year}-01-01`)
      .lte("purchase_date", `${filters.year}-12-31`);
  }

  if (filters.priceMin !== undefined) {
    query = query.gte("price", filters.priceMin);
  }

  if (filters.priceMax !== undefined) {
    query = query.lte("price", filters.priceMax);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return enrichPurchases((data ?? []) as PurchaseRow[]);
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

function sumAmountsByKey(
  purchases: PurchaseRow[],
  itemById: Map<string, ItemLookupRow>,
  key: "brand_id" | "category_id",
  nameById: Map<string, string>,
  nullLabel: string,
): SpendingAmountItem[] {
  const totals = new Map<string, number>();

  for (const purchase of purchases) {
    if (isReturnedStatus(purchase.status)) {
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
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((left, right) => {
      if (right.amount !== left.amount) {
        return right.amount - left.amount;
      }
      return left.name.localeCompare(right.name);
    });
}

export async function fetchPurchaseAnalytics(): Promise<{
  data: PurchaseAnalytics | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const [purchasesResult, itemsResult, brandsResult, categoriesResult, wearCountsResult] =
    await Promise.all([
      supabase.from("purchases").select(PURCHASE_SELECT),
      supabase
        .from("wardrobe_items")
        .select("id, code, name, brand_id, category_id"),
      supabase.from("brands").select("id, name"),
      supabase.from("categories").select("id, name"),
      fetchWearCountsByItem(),
    ]);

  const firstError =
    purchasesResult.error ??
    itemsResult.error ??
    brandsResult.error ??
    categoriesResult.error ??
    wearCountsResult.error;

  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

  const wearCounts = wearCountsResult.data ?? new Map<string, number>();

  const purchases = (purchasesResult.data ?? []) as PurchaseRow[];
  const items = (itemsResult.data ?? []) as ItemLookupRow[];
  const brandMap = new Map(
    ((brandsResult.data ?? []) as LookupOption[]).map((brand) => [brand.id, brand.name]),
  );
  const categoryMap = new Map(
    ((categoriesResult.data ?? []) as LookupOption[]).map((category) => [
      category.id,
      category.name,
    ]),
  );
  const itemById = new Map(items.map((item) => [item.id, item]));

  const activePurchases = purchases.filter(
    (purchase) => !isReturnedStatus(purchase.status),
  );

  const totalWardrobeValue = activePurchases.reduce(
    (sum, purchase) => sum + Number(purchase.price),
    0,
  );

  const totalWears = [...wearCounts.values()].reduce((sum, count) => sum + count, 0);
  const averageCostPerWear =
    totalWears > 0
      ? Math.round((totalWardrobeValue / totalWears) * 100) / 100
      : null;

  const analyticsItems: PurchaseAnalyticsItem[] = activePurchases
    .map((purchase) => {
      const item = itemById.get(purchase.item_id);
      if (!item) {
        return null;
      }

      const wearCount = wearCounts.get(item.id) ?? 0;
      return {
        id: item.id,
        code: item.code,
        name: item.name,
        price: Number(purchase.price),
        brand: item.brand_id ? (brandMap.get(item.brand_id) ?? null) : null,
        category: item.category_id
          ? (categoryMap.get(item.category_id) ?? null)
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

  const monthlyTotals = new Map<string, number>();
  for (const purchase of activePurchases) {
    const monthKey = purchase.purchase_date.slice(0, 7);
    monthlyTotals.set(
      monthKey,
      (monthlyTotals.get(monthKey) ?? 0) + Number(purchase.price),
    );
  }

  const monthlyTimeline: MonthlySpendingItem[] = [...monthlyTotals.entries()]
    .map(([month, amount]) => ({
      month,
      label: formatMonthLabel(month),
      amount: Math.round(amount * 100) / 100,
    }))
    .sort((left, right) => left.month.localeCompare(right.month));

  const spendingByBrand = sumAmountsByKey(
    activePurchases,
    itemById,
    "brand_id",
    brandMap,
    "Unknown brand",
  );
  const spendingByCategory = sumAmountsByKey(
    activePurchases,
    itemById,
    "category_id",
    categoryMap,
    "Uncategorized",
  );

  return {
    data: {
      totalWardrobeValue: Math.round(totalWardrobeValue * 100) / 100,
      averageCostPerWear,
      mostExpensiveItem: sortedByPrice[0] ?? null,
      cheapestItem: sortedByPrice[sortedByPrice.length - 1] ?? null,
      topBrandsByValue: spendingByBrand.slice(0, 10),
      spendingByBrand,
      spendingByCategory,
      monthlyTimeline,
    },
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

  const purchases = purchasesResult.data ?? [];
  const activePurchases = purchases.filter(
    (purchase) => !isReturnedStatus(purchase.status),
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
      monthly: [...monthlyTotals.entries()]
        .map(([month, amount]) => ({
          month,
          label: formatMonthLabel(month),
          amount: Math.round(amount * 100) / 100,
        }))
        .sort((left, right) => left.month.localeCompare(right.month)),
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
