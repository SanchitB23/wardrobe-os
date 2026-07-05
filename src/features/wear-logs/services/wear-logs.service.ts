import * as wearLogsRepository from "@/features/wear-logs/repositories/wear-logs.repository";
import {
  buildItemWearSummary,
  buildWearLogAnalytics,
} from "@/domain/wardrobe/wear-analytics";
import { toError } from "@/shared/utils/data-result";
import type {
  CreateWearLogInput,
  ItemWearSummary,
  LookupOption,
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

  const summary = buildItemWearSummary(logs);

  return {
    data: {
      ...summary,
      recentLogs: enriched.data ?? [],
    },
    error: null,
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

  return {
    data: buildWearLogAnalytics(items, categoryNameById, logsResult.data ?? []),
    error: null,
  };
}
