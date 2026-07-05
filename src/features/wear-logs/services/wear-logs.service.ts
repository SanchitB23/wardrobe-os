import * as wearLogsRepository from "@/features/wear-logs/repositories/wear-logs.repository";
import { toError } from "@/shared/utils/data-result";
import type {
  CreateWearLogInput,
  ItemWearSummary,
  LookupOption,
  WearAnalyticsItem,
  WearLogAnalytics,
  WearLogFilters,
  WearLogListRow,
  WearLogRow,
  WearOutfitInput,
} from "@/types/wardrobe";

type ItemSummaryRow = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  status: string | null;
};

export function formatWearLogDateInput(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatWearLogDisplayDate(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString(
    undefined,
    { year: "numeric", month: "short", day: "numeric" },
  );
}

async function enrichWearLogs(logs: WearLogRow[]): Promise<{
  data: WearLogListRow[] | null;
  error: Error | null;
}> {
  if (logs.length === 0) {
    return { data: [], error: null };
  }

  const itemIds = [...new Set(logs.map((log) => log.item_id))];
  const occasionIds = [
    ...new Set(
      logs
        .map((log) => log.occasion_id)
        .filter((occasionId): occasionId is string => Boolean(occasionId)),
    ),
  ];

  const [itemsResult, occasionsResult, categoriesResult] = await Promise.all([
    wearLogsRepository.fetchWardrobeItemsByIds(itemIds),
    wearLogsRepository.fetchOccasionsByIds(occasionIds),
    wearLogsRepository.fetchAllCategories(),
  ]);

  const firstError =
    itemsResult.error ?? occasionsResult.error ?? categoriesResult.error;

  if (firstError) {
    return { data: null, error: firstError };
  }

  const categoryMap = new Map(
    (categoriesResult.data ?? []).map((category) => [category.id, category]),
  );
  const itemMap = new Map(
    (itemsResult.data ?? []).map((item) => [
      item.id,
      {
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category_id
          ? (categoryMap.get(item.category_id) ?? null)
          : null,
      },
    ]),
  );
  const occasionMap = new Map(
    (occasionsResult.data ?? []).map((occasion) => [occasion.id, occasion]),
  );

  return {
    data: logs.map((log) => ({
      ...log,
      item: itemMap.get(log.item_id) ?? null,
      occasion: log.occasion_id
        ? (occasionMap.get(log.occasion_id) ?? null)
        : null,
    })),
    error: null,
  };
}

export async function fetchOccasions(): Promise<{
  data: LookupOption[] | null;
  error: Error | null;
}> {
  return wearLogsRepository.fetchOccasions();
}

export async function createWearLog(
  input: CreateWearLogInput,
): Promise<{ data: WearLogRow | null; error: Error | null }> {
  return wearLogsRepository.insertWearLog({
    item_id: input.item_id,
    worn_on: input.worn_on,
    outfit_id: input.outfit_id ?? null,
    occasion_id: input.occasion_id ?? null,
    comfort_rating: input.comfort_rating ?? null,
    notes: input.notes?.trim() || null,
  });
}

export async function createOutfitWearLogs(
  input: WearOutfitInput,
): Promise<{ data: WearLogRow[] | null; error: Error | null }> {
  if (input.item_ids.length === 0) {
    return { data: [], error: toError("This outfit has no items to log.") };
  }

  return wearLogsRepository.insertWearLogs(
    input.item_ids.map((itemId) => ({
      item_id: itemId,
      outfit_id: input.outfit_id,
      worn_on: input.worn_on,
      occasion_id: input.occasion_id ?? null,
      comfort_rating: input.comfort_rating ?? null,
      notes: input.notes?.trim() || null,
    })),
  );
}

export async function deleteWearLog(
  id: string,
): Promise<{ error: Error | null }> {
  return wearLogsRepository.deleteWearLog(id);
}

export async function fetchWearLogs(
  filters: WearLogFilters = {},
): Promise<{ data: WearLogListRow[] | null; error: Error | null }> {
  let categoryItemIds: string[] | null = null;

  if (filters.categoryId) {
    const categoryItems = await wearLogsRepository.fetchCategoryItemIds(
      filters.categoryId,
    );
    if (categoryItems.error) {
      return { data: null, error: categoryItems.error };
    }
    categoryItemIds = categoryItems.data ?? [];
    if (categoryItemIds.length === 0) {
      return { data: [], error: null };
    }
    if (filters.itemId && !categoryItemIds.includes(filters.itemId)) {
      return { data: [], error: null };
    }
  }

  const queryFilters: wearLogsRepository.WearLogQueryFilters = {
    occasionId: filters.occasionId,
    wornFrom: filters.wornFrom,
    wornTo: filters.wornTo,
  };

  if (filters.itemId) {
    queryFilters.itemId = filters.itemId;
  } else if (categoryItemIds) {
    queryFilters.itemIds = categoryItemIds;
  }

  const logsResult = await wearLogsRepository.queryWearLogs(queryFilters);
  if (logsResult.error) {
    return { data: null, error: logsResult.error };
  }

  return enrichWearLogs(logsResult.data ?? []);
}

export async function fetchItemWearSummary(
  itemId: string,
): Promise<{ data: ItemWearSummary | null; error: Error | null }> {
  const logsResult = await wearLogsRepository.queryWearLogsByItemId(itemId);
  if (logsResult.error) {
    return { data: null, error: logsResult.error };
  }

  const logs = logsResult.data ?? [];
  const enriched = await enrichWearLogs(logs.slice(0, 10));

  if (enriched.error) {
    return { data: null, error: enriched.error };
  }

  const comfortRated = logs.filter((log) => log.comfort_rating !== null);
  const comfortSum = comfortRated.reduce(
    (sum, log) => sum + Number(log.comfort_rating),
    0,
  );

  return {
    data: {
      totalWears: logs.length,
      lastWornOn: logs[0]?.worn_on ?? null,
      averageComfortRating:
        comfortRated.length > 0
          ? Math.round((comfortSum / comfortRated.length) * 10) / 10
          : null,
      recentLogs: enriched.data ?? [],
    },
    error: null,
  };
}

function toWearAnalyticsItem(
  item: ItemSummaryRow,
  categoryNameById: Map<string, string>,
  wearCountByItem: Map<string, number>,
  lastWornByItem: Map<string, string>,
): WearAnalyticsItem {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    category: item.category_id
      ? (categoryNameById.get(item.category_id) ?? null)
      : null,
    wearCount: wearCountByItem.get(item.id) ?? 0,
    lastWornOn: lastWornByItem.get(item.id) ?? null,
  };
}

export async function fetchWearLogAnalytics(
  items: ItemSummaryRow[],
  categoryNameById: Map<string, string>,
): Promise<{ data: WearLogAnalytics | null; error: Error | null }> {
  const logsResult = await wearLogsRepository.fetchAllWearLogSummaries();
  if (logsResult.error) {
    return { data: null, error: logsResult.error };
  }

  const wearCountByItem = new Map<string, number>();
  const lastWornByItem = new Map<string, string>();

  for (const log of logsResult.data ?? []) {
    wearCountByItem.set(
      log.item_id,
      (wearCountByItem.get(log.item_id) ?? 0) + 1,
    );

    const existingLastWorn = lastWornByItem.get(log.item_id);
    if (!existingLastWorn || log.worn_on > existingLastWorn) {
      lastWornByItem.set(log.item_id, log.worn_on);
    }
  }

  const activeItems = items.filter((item) => item.status === "active");
  const toAnalytics = (item: ItemSummaryRow) =>
    toWearAnalyticsItem(
      item,
      categoryNameById,
      wearCountByItem,
      lastWornByItem,
    );

  const mostWorn = [...items]
    .map(toAnalytics)
    .filter((item) => item.wearCount > 0)
    .sort((left, right) => {
      if (right.wearCount !== left.wearCount) {
        return right.wearCount - left.wearCount;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 5);

  const leastWornActive = activeItems
    .map(toAnalytics)
    .filter((item) => item.wearCount > 0)
    .sort((left, right) => {
      if (left.wearCount !== right.wearCount) {
        return left.wearCount - right.wearCount;
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 5);

  const notWornYet = activeItems
    .filter((item) => (wearCountByItem.get(item.id) ?? 0) === 0)
    .map(toAnalytics)
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, 8);

  const recentlyWorn = [...items]
    .map(toAnalytics)
    .filter((item) => item.lastWornOn)
    .sort((left, right) => {
      const leftDate = left.lastWornOn ?? "";
      const rightDate = right.lastWornOn ?? "";
      if (rightDate !== leftDate) {
        return rightDate.localeCompare(leftDate);
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 5);

  return {
    data: {
      mostWorn,
      leastWornActive,
      notWornYet,
      recentlyWorn,
    },
    error: null,
  };
}
