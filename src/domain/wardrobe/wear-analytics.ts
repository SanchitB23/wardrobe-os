import { calculateAverageRating } from "@/domain/wardrobe/ratings";
import type { ItemWearSummary, WearAnalyticsItem, WearLogAnalytics } from "@/types/wardrobe";

export type WearLogSummaryInput = {
  item_id: string;
  worn_on: string;
  comfort_rating?: number | null;
};

export type WearAnalyticsItemInput = {
  id: string;
  code: string;
  name: string;
  category_id: string | null;
  status: string | null;
};

export type OutfitWearLogInput = {
  worn_on: string;
  comfort_rating: number | null;
};

export type OutfitWearEvent = {
  worn_on: string;
  comfort_rating: number | null;
};

export type OutfitWearStats = {
  timesWorn: number;
  lastWornOn: string | null;
  averageComfort: number | null;
  /** Distinct wear events, newest first. */
  events: OutfitWearEvent[];
};

/**
 * Aggregates raw outfit wear-log rows (one row per item per wear) into
 * per-event stats. Rows sharing a worn_on date count as one wear event.
 */
export function buildOutfitWearStats(
  logs: readonly OutfitWearLogInput[],
): OutfitWearStats {
  const byDate = new Map<string, number | null>();

  for (const log of logs) {
    const existing = byDate.get(log.worn_on);
    if (existing === undefined || existing === null) {
      byDate.set(log.worn_on, log.comfort_rating);
    }
  }

  const events = [...byDate.entries()]
    .map(([worn_on, comfort_rating]) => ({ worn_on, comfort_rating }))
    .sort((left, right) => right.worn_on.localeCompare(left.worn_on));

  const ratings = events
    .map((event) => event.comfort_rating)
    .filter((rating): rating is number => rating !== null);

  return {
    timesWorn: events.length,
    lastWornOn: events[0]?.worn_on ?? null,
    averageComfort:
      ratings.length === 0
        ? null
        : Math.round(
            (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10,
          ) / 10,
    events,
  };
}

export function buildWearCountMaps(logs: readonly WearLogSummaryInput[]): {
  wearCountByItem: Map<string, number>;
  lastWornByItem: Map<string, string>;
} {
  const wearCountByItem = new Map<string, number>();
  const lastWornByItem = new Map<string, string>();

  for (const log of logs) {
    wearCountByItem.set(
      log.item_id,
      (wearCountByItem.get(log.item_id) ?? 0) + 1,
    );

    const existingLastWorn = lastWornByItem.get(log.item_id);
    if (!existingLastWorn || log.worn_on > existingLastWorn) {
      lastWornByItem.set(log.item_id, log.worn_on);
    }
  }

  return { wearCountByItem, lastWornByItem };
}

export function buildItemWearSummary(
  logs: readonly Pick<WearLogSummaryInput, "worn_on" | "comfort_rating">[],
): Pick<ItemWearSummary, "totalWears" | "lastWornOn" | "averageComfortRating"> {
  const comfortRatings = logs.map((log) => log.comfort_rating ?? null);

  return {
    totalWears: logs.length,
    lastWornOn: logs[0]?.worn_on ?? null,
    averageComfortRating: calculateAverageRating(comfortRatings),
  };
}

function toWearAnalyticsItem(
  item: WearAnalyticsItemInput,
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

export function buildWearLogAnalytics(
  items: readonly WearAnalyticsItemInput[],
  categoryNameById: Map<string, string>,
  logs: readonly WearLogSummaryInput[],
): WearLogAnalytics {
  const { wearCountByItem, lastWornByItem } = buildWearCountMaps(logs);
  const activeItems = items.filter((item) => item.status === "active");
  const toAnalytics = (item: WearAnalyticsItemInput) =>
    toWearAnalyticsItem(item, categoryNameById, wearCountByItem, lastWornByItem);

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
    mostWorn,
    leastWornActive,
    notWornYet,
    recentlyWorn,
  };
}
