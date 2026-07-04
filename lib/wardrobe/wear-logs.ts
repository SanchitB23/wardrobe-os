import { createClient } from "@/lib/supabase/client";
import type {
  CreateWearLogInput,
  ItemWearSummary,
  LookupOption,
  WearAnalyticsItem,
  WearLogAnalytics,
  WearLogFilters,
  WearLogListRow,
  WearLogRow,
} from "@/types/wardrobe";
import { UNCATEGORIZED_CATEGORY_ID } from "@/types/wardrobe";

const WEAR_LOG_SELECT =
  "id, item_id, worn_on, outfit_id, occasion_id, comfort_rating, notes, created_at";

type WearLogRecord = WearLogRow;

type ItemSummaryRow = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  status: string | null;
};

function toError(message: string) {
  return new Error(message);
}

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

export async function fetchOccasions(): Promise<{
  data: LookupOption[] | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("occasions")
    .select("id, name")
    .order("name");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: (data ?? []) as LookupOption[], error: null };
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

async function enrichWearLogs(logs: WearLogRecord[]): Promise<{
  data: WearLogListRow[] | null;
  error: Error | null;
}> {
  if (logs.length === 0) {
    return { data: [], error: null };
  }

  const supabase = createClient();
  const itemIds = [...new Set(logs.map((log) => log.item_id))];
  const occasionIds = [
    ...new Set(
      logs
        .map((log) => log.occasion_id)
        .filter((occasionId): occasionId is string => Boolean(occasionId)),
    ),
  ];

  const [itemsResult, occasionsResult, categoriesResult] = await Promise.all([
    supabase
      .from("wardrobe_items")
      .select("id, code, name, category_id")
      .in("id", itemIds),
    occasionIds.length > 0
      ? supabase.from("occasions").select("id, name").in("id", occasionIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("categories").select("id, name"),
  ]);

  const firstError =
    itemsResult.error ?? occasionsResult.error ?? categoriesResult.error;

  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

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
        category: item.category_id
          ? (categoryMap.get(item.category_id) ?? null)
          : null,
      },
    ]),
  );
  const occasionMap = new Map(
    ((occasionsResult.data ?? []) as LookupOption[]).map((occasion) => [
      occasion.id,
      occasion,
    ]),
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

export async function createWearLog(
  input: CreateWearLogInput,
): Promise<{ data: WearLogRow | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wear_logs")
    .insert({
      item_id: input.item_id,
      worn_on: input.worn_on,
      occasion_id: input.occasion_id ?? null,
      comfort_rating: input.comfort_rating ?? null,
      notes: input.notes?.trim() || null,
    })
    .select(WEAR_LOG_SELECT)
    .single();

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return { data: data as WearLogRow, error: null };
}

export async function deleteWearLog(
  id: string,
): Promise<{ error: Error | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("wear_logs").delete().eq("id", id);

  if (error) {
    return { error: toError(error.message) };
  }

  return { error: null };
}

export async function fetchWearLogs(
  filters: WearLogFilters = {},
): Promise<{ data: WearLogListRow[] | null; error: Error | null }> {
  const supabase = createClient();
  let categoryItemIds: string[] | null = null;

  if (filters.categoryId) {
    const categoryItems = await fetchCategoryItemIds(filters.categoryId);
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

  let query = supabase
    .from("wear_logs")
    .select(WEAR_LOG_SELECT)
    .order("worn_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.itemId) {
    query = query.eq("item_id", filters.itemId);
  } else if (categoryItemIds) {
    query = query.in("item_id", categoryItemIds);
  }

  if (filters.occasionId) {
    query = query.eq("occasion_id", filters.occasionId);
  }

  if (filters.wornFrom) {
    query = query.gte("worn_on", filters.wornFrom);
  }

  if (filters.wornTo) {
    query = query.lte("worn_on", filters.wornTo);
  }

  const { data, error } = await query;

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  return enrichWearLogs((data ?? []) as WearLogRecord[]);
}

export async function fetchItemWearSummary(
  itemId: string,
): Promise<{ data: ItemWearSummary | null; error: Error | null }> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("wear_logs")
    .select(WEAR_LOG_SELECT)
    .eq("item_id", itemId)
    .order("worn_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  const logs = (data ?? []) as WearLogRecord[];
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
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wear_logs")
    .select("id, item_id, worn_on");

  if (error) {
    return { data: null, error: toError(error.message) };
  }

  const wearCountByItem = new Map<string, number>();
  const lastWornByItem = new Map<string, string>();

  for (const log of data ?? []) {
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
