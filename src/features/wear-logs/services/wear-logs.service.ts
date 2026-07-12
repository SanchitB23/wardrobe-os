import * as wearLogsRepository from "@/features/wear-logs/repositories/wear-logs.repository";
import {
  createAdHocWearLog,
  createWearLogEvent,
  createWearLogFromOutfit,
} from "@/features/wear-logs/services/wear-events.service";
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
  const result = input.outfit_id
    ? await createWearLogEvent({
        wornOn: input.worn_on,
        items: [{ itemId: input.item_id }],
        occasionId: input.occasion_id ?? null,
        notes: input.notes?.trim() || null,
        source: "outfit",
        outfitId: input.outfit_id,
      })
    : await createAdHocWearLog({
        wornOn: input.worn_on,
        items: [{ itemId: input.item_id }],
        occasionId: input.occasion_id ?? null,
        notes: input.notes?.trim() || null,
      });

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  return {
    data: {
      id: result.data.wearLog.id,
      item_id: input.item_id,
      worn_on: result.data.wearLog.wornOn,
      outfit_id: result.data.wearLog.outfitId,
      occasion_id: result.data.wearLog.occasionId,
      comfort_rating: input.comfort_rating ?? null,
      notes: result.data.wearLog.notes,
      created_at: result.data.wearLog.createdAt,
    },
    error: null,
  };
}

export async function createOutfitWearLogs(
  input: WearOutfitInput,
): Promise<{ data: WearLogRow[] | null; error: Error | null }> {
  if (input.item_ids.length === 0) {
    return { data: [], error: toError("This outfit has no items to log.") };
  }

  const result = await createWearLogFromOutfit({
    outfitId: input.outfit_id,
    items: input.item_ids.map((itemId) => ({ itemId })),
    wornOn: input.worn_on,
    occasionId: input.occasion_id ?? null,
    notes: input.notes?.trim() || null,
  });

  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  return {
    data: result.data.wearLog.items.map((item) => ({
      id: result.data!.wearLog.id,
      item_id: item.itemId,
      worn_on: result.data!.wearLog.wornOn,
      outfit_id: result.data!.wearLog.outfitId,
      occasion_id: result.data!.wearLog.occasionId,
      comfort_rating: input.comfort_rating ?? null,
      notes: result.data!.wearLog.notes,
      created_at: result.data!.wearLog.createdAt,
    })),
    error: null,
  };
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
