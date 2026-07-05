/**
 * Usage Analytics Engine — pure, deterministic analysis of how a wardrobe is
 * actually worn.
 *
 * No React, no Supabase, no AI. Given the active items, their wear logs, and
 * (optionally) purchase prices, it derives never-worn / stale / most- and
 * least-worn pieces, per-category and per-occasion usage, cost-per-wear
 * highlights, and human-readable insights & recommendations.
 *
 * Time-based rules (stale, recently worn) are computed against an injected
 * `asOf` reference date so results stay deterministic and testable.
 */

import { calculateCostPerWear } from "@/domain/wardrobe/cost-per-wear";
import type { FormalityEnum, ItemStatus, UsageFrequency } from "@/types/wardrobe";

// ---------------------------------------------------------------------------
// Inputs (structural subsets of the app rows)
// ---------------------------------------------------------------------------

export type UsageItem = {
  id: string;
  name: string;
  category: string | null;
  formality: FormalityEnum | null;
  usage: UsageFrequency | null;
  status: ItemStatus | null;
};

export type UsageWearLog = {
  itemId: string;
  /** ISO date the item was worn (YYYY-MM-DD or full ISO). */
  wornOn: string;
  /** Resolved occasion label, if the wear log carried one. */
  occasion?: string | null;
};

export type UsagePurchase = {
  itemId: string;
  price: number | null;
};

export type UsageAnalyticsInput = {
  wardrobeItems: readonly UsageItem[];
  wearLogs: readonly UsageWearLog[];
  purchases?: readonly UsagePurchase[];
};

export type UsageAnalyticsOptions = {
  /** Reference "today" for time-based rules. Defaults to the current date. */
  asOf?: Date;
  /** How many items to include in each top-N list. */
  limit?: number;
};

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

export type ItemSummary = {
  id: string;
  name: string;
  category: string | null;
};

export type ItemUsageSummary = ItemSummary & {
  wearCount: number;
  lastWornOn: string | null;
  daysSinceLastWorn: number | null;
};

export type CategoryUsageSummary = {
  category: string;
  itemCount: number;
  wearCount: number;
  wearsPerItem: number;
  neverWornCount: number;
};

export type OccasionUsageSummary = {
  occasion: string;
  wearCount: number;
  itemCount: number;
};

export type ItemCostSummary = ItemSummary & {
  price: number;
  wearCount: number;
  costPerWear: number;
};

export type UsageAnalytics = {
  totalWears: number;
  wornItemCount: number;
  neverWornItems: ItemSummary[];
  mostWornItems: ItemUsageSummary[];
  leastWornActiveItems: ItemUsageSummary[];
  recentlyWornItems: ItemUsageSummary[];
  staleItems: ItemUsageSummary[];
  categoryUsage: CategoryUsageSummary[];
  usageByOccasion: OccasionUsageSummary[];
  costPerWearHighlights?: {
    bestValue: ItemCostSummary[];
    worstValue: ItemCostSummary[];
  };
  insights: string[];
  recommendations: string[];
};

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Not worn in this many days → stale. */
const STALE_DAYS = 90;
/** Worn within this many days → recently worn. */
const RECENT_DAYS = 30;
/** Default size of each top-N list. */
const DEFAULT_LIMIT = 5;
/** A category is "over-owned" when its pieces average fewer wears than this. */
const LOW_WEARS_PER_ITEM = 1;

const UNCATEGORIZED = "Uncategorized";
const UNSPECIFIED_OCCASION = "Unspecified";

const FORMAL_LEVELS = new Set<FormalityEnum>(["formal", "business_formal"]);
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isActive(item: UsageItem): boolean {
  return item.status === "active" || item.status === null;
}

/** Rare or formal/wedding pieces are expected to sit unworn — excluded from
 *  "stale" and "least worn" so they don't read as neglect. */
function isSpecialOccasionItem(item: UsageItem): boolean {
  return item.usage === "rare" || (item.formality !== null && FORMAL_LEVELS.has(item.formality));
}

/** Parses a date-only or full ISO string as a UTC instant (null if invalid). */
function parseDate(value: string): Date | null {
  const raw = value.length === 10 ? `${value}T00:00:00Z` : value;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function wholeDaysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

function toItemSummary(item: UsageItem): ItemSummary {
  return { id: item.id, name: item.name, category: item.category };
}

type WearAggregate = {
  count: number;
  /** Latest wear as an ISO date string (chronological max). */
  lastWornOn: string | null;
  lastWornDate: Date | null;
};

/**
 * Produces a deterministic {@link UsageAnalytics} report. Pure: all time math is
 * relative to `options.asOf` (defaults to now at the call boundary only).
 */
export function analyzeUsage(
  input: UsageAnalyticsInput,
  options: UsageAnalyticsOptions = {},
): UsageAnalytics {
  const asOf = options.asOf ?? new Date();
  const limit = options.limit ?? DEFAULT_LIMIT;

  const items = input.wardrobeItems;
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const activeItems = items.filter(isActive);

  // ---- Aggregate wears per item ----------------------------------------
  const wearsByItem = new Map<string, WearAggregate>();
  for (const log of input.wearLogs) {
    const existing = wearsByItem.get(log.itemId) ?? {
      count: 0,
      lastWornOn: null,
      lastWornDate: null,
    };
    existing.count += 1;
    const date = parseDate(log.wornOn);
    if (date && (!existing.lastWornDate || date > existing.lastWornDate)) {
      existing.lastWornDate = date;
      existing.lastWornOn = log.wornOn;
    }
    wearsByItem.set(log.itemId, existing);
  }

  const totalWears = input.wearLogs.length;
  const wornItemCount = Array.from(wearsByItem.keys()).filter((id) =>
    itemsById.has(id),
  ).length;

  const wearCountOf = (id: string): number => wearsByItem.get(id)?.count ?? 0;
  const daysSince = (agg: WearAggregate | undefined): number | null =>
    agg?.lastWornDate ? wholeDaysBetween(agg.lastWornDate, asOf) : null;

  const usageSummaryOf = (item: UsageItem): ItemUsageSummary => {
    const agg = wearsByItem.get(item.id);
    return {
      ...toItemSummary(item),
      wearCount: agg?.count ?? 0,
      lastWornOn: agg?.lastWornOn ?? null,
      daysSinceLastWorn: daysSince(agg),
    };
  };

  // ---- Never worn (rule 1) ---------------------------------------------
  const neverWornItems = activeItems
    .filter((item) => wearCountOf(item.id) === 0)
    .map(toItemSummary)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  // ---- Most worn (rule 3) ----------------------------------------------
  const mostWornItems = items
    .filter((item) => wearCountOf(item.id) > 0)
    .map(usageSummaryOf)
    .sort(
      (a, b) => b.wearCount - a.wearCount || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    )
    .slice(0, limit);

  // ---- Least worn active, excluding rare/formal (rule 4) ---------------
  const leastWornActiveItems = activeItems
    .filter((item) => wearCountOf(item.id) > 0 && !isSpecialOccasionItem(item))
    .map(usageSummaryOf)
    .sort(
      (a, b) => a.wearCount - b.wearCount || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    )
    .slice(0, limit);

  // ---- Recently worn ----------------------------------------------------
  const recentlyWornItems = items
    .map(usageSummaryOf)
    .filter(
      (summary) =>
        summary.daysSinceLastWorn !== null && summary.daysSinceLastWorn <= RECENT_DAYS,
    )
    .sort(
      (a, b) =>
        (a.daysSinceLastWorn ?? Infinity) - (b.daysSinceLastWorn ?? Infinity) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, limit);

  // ---- Stale: worn before, but not in 90+ days, excl rare/formal (rule 2)
  const staleItems = activeItems
    .filter((item) => !isSpecialOccasionItem(item))
    .map(usageSummaryOf)
    .filter(
      (summary) =>
        summary.daysSinceLastWorn !== null && summary.daysSinceLastWorn >= STALE_DAYS,
    )
    .sort(
      (a, b) =>
        (b.daysSinceLastWorn ?? 0) - (a.daysSinceLastWorn ?? 0) ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    );

  // ---- Category usage: ownership vs wear (rule 5) ----------------------
  const categoryMap = new Map<
    string,
    { itemCount: number; wearCount: number; neverWornCount: number }
  >();
  for (const item of activeItems) {
    const category = item.category?.trim() || UNCATEGORIZED;
    const entry =
      categoryMap.get(category) ?? { itemCount: 0, wearCount: 0, neverWornCount: 0 };
    const count = wearCountOf(item.id);
    entry.itemCount += 1;
    entry.wearCount += count;
    if (count === 0) entry.neverWornCount += 1;
    categoryMap.set(category, entry);
  }
  const categoryUsage: CategoryUsageSummary[] = Array.from(
    categoryMap,
    ([category, entry]) => ({
      category,
      itemCount: entry.itemCount,
      wearCount: entry.wearCount,
      wearsPerItem:
        entry.itemCount > 0
          ? Math.round((entry.wearCount / entry.itemCount) * 10) / 10
          : 0,
      neverWornCount: entry.neverWornCount,
    }),
  ).sort(
    (a, b) => b.wearCount - a.wearCount || a.category.localeCompare(b.category),
  );

  // ---- Usage by occasion ------------------------------------------------
  const occasionMap = new Map<string, { wearCount: number; items: Set<string> }>();
  for (const log of input.wearLogs) {
    const occasion = log.occasion?.trim() || UNSPECIFIED_OCCASION;
    const entry = occasionMap.get(occasion) ?? { wearCount: 0, items: new Set<string>() };
    entry.wearCount += 1;
    entry.items.add(log.itemId);
    occasionMap.set(occasion, entry);
  }
  const usageByOccasion: OccasionUsageSummary[] = Array.from(
    occasionMap,
    ([occasion, entry]) => ({
      occasion,
      wearCount: entry.wearCount,
      itemCount: entry.items.size,
    }),
  ).sort(
    (a, b) => b.wearCount - a.wearCount || a.occasion.localeCompare(b.occasion),
  );

  // ---- Cost per wear (rule 6) ------------------------------------------
  const priceByItem = new Map<string, number>();
  for (const purchase of input.purchases ?? []) {
    if (purchase.price !== null && purchase.price !== undefined) {
      // Keep the highest recorded price when an item has multiple purchases.
      const existing = priceByItem.get(purchase.itemId);
      if (existing === undefined || purchase.price > existing) {
        priceByItem.set(purchase.itemId, purchase.price);
      }
    }
  }

  let costPerWearHighlights: UsageAnalytics["costPerWearHighlights"];
  if (priceByItem.size > 0) {
    const costSummaries: ItemCostSummary[] = [];
    for (const [id, price] of priceByItem) {
      const item = itemsById.get(id);
      if (!item) continue;
      const wearCount = wearCountOf(id);
      const costPerWear = calculateCostPerWear(price, wearCount);
      if (costPerWear === null) continue; // never worn → no finite cost-per-wear
      costSummaries.push({ ...toItemSummary(item), price, wearCount, costPerWear });
    }
    const byCostAsc = [...costSummaries].sort(
      (a, b) => a.costPerWear - b.costPerWear || a.id.localeCompare(b.id),
    );
    costPerWearHighlights = {
      bestValue: byCostAsc.slice(0, limit),
      worstValue: [...byCostAsc].reverse().slice(0, limit),
    };
  }

  // ---- Insights & recommendations (deterministic) ----------------------
  const insights = buildInsights({
    totalWears,
    wornItemCount,
    activeCount: activeItems.length,
    neverWornItems,
    staleItems,
    mostWornItems,
    categoryUsage,
    usageByOccasion,
    costPerWearHighlights,
  });
  const recommendations = buildRecommendations({
    neverWornItems,
    staleItems,
    leastWornActiveItems,
    categoryUsage,
    costPerWearHighlights,
  });

  return {
    totalWears,
    wornItemCount,
    neverWornItems,
    mostWornItems,
    leastWornActiveItems,
    recentlyWornItems,
    staleItems,
    categoryUsage,
    usageByOccasion,
    costPerWearHighlights,
    insights,
    recommendations,
  };
}

function namesOf(items: readonly ItemSummary[], take = 3): string {
  return items
    .slice(0, take)
    .map((item) => item.name)
    .join(", ");
}

function pluralWears(count: number): string {
  return `${count} ${count === 1 ? "wear" : "wears"}`;
}

function buildInsights(ctx: {
  totalWears: number;
  wornItemCount: number;
  activeCount: number;
  neverWornItems: ItemSummary[];
  staleItems: ItemUsageSummary[];
  mostWornItems: ItemUsageSummary[];
  categoryUsage: CategoryUsageSummary[];
  usageByOccasion: OccasionUsageSummary[];
  costPerWearHighlights?: UsageAnalytics["costPerWearHighlights"];
}): string[] {
  const insights: string[] = [];

  insights.push(
    `${ctx.totalWears} total wears logged across ${ctx.wornItemCount} items.`,
  );

  if (ctx.activeCount > 0) {
    const utilization = Math.round(
      ((ctx.activeCount - ctx.neverWornItems.length) / ctx.activeCount) * 100,
    );
    insights.push(
      `${utilization}% of active items have been worn at least once.`,
    );
  }

  if (ctx.neverWornItems.length > 0) {
    insights.push(
      `${ctx.neverWornItems.length} active items have never been worn.`,
    );
  }
  if (ctx.staleItems.length > 0) {
    insights.push(
      `${ctx.staleItems.length} items haven't been worn in over ${STALE_DAYS} days.`,
    );
  }

  const topWorn = ctx.mostWornItems[0];
  if (topWorn) {
    insights.push(`Most worn: ${topWorn.name} (${pluralWears(topWorn.wearCount)}).`);
  }

  const topCategory = ctx.categoryUsage[0];
  if (topCategory && topCategory.wearCount > 0) {
    insights.push(
      `${topCategory.category} is the most-worn category (${pluralWears(topCategory.wearCount)} across ${topCategory.itemCount} items).`,
    );
  }

  const topOccasion = ctx.usageByOccasion[0];
  if (topOccasion && topOccasion.occasion !== UNSPECIFIED_OCCASION) {
    insights.push(
      `Most wears happen for ${topOccasion.occasion} (${topOccasion.wearCount}).`,
    );
  }

  const best = ctx.costPerWearHighlights?.bestValue[0];
  if (best) {
    insights.push(
      `Best value: ${best.name} at ${best.costPerWear} per wear.`,
    );
  }

  return insights;
}

function buildRecommendations(ctx: {
  neverWornItems: ItemSummary[];
  staleItems: ItemUsageSummary[];
  leastWornActiveItems: ItemUsageSummary[];
  categoryUsage: CategoryUsageSummary[];
  costPerWearHighlights?: UsageAnalytics["costPerWearHighlights"];
}): string[] {
  const recommendations: string[] = [];

  if (ctx.neverWornItems.length > 0) {
    recommendations.push(
      `Style or rehome never-worn pieces like ${namesOf(ctx.neverWornItems)}.`,
    );
  }
  if (ctx.staleItems.length > 0) {
    recommendations.push(
      `Reintroduce stale favorites into the rotation: ${namesOf(ctx.staleItems)}.`,
    );
  }
  if (ctx.leastWornActiveItems.length > 0) {
    recommendations.push(
      `Give underused pieces more wear: ${namesOf(ctx.leastWornActiveItems)}.`,
    );
  }

  const overOwned = ctx.categoryUsage
    .filter((entry) => entry.itemCount >= 3 && entry.wearsPerItem < LOW_WEARS_PER_ITEM)
    .sort((a, b) => a.wearsPerItem - b.wearsPerItem);
  if (overOwned[0]) {
    recommendations.push(
      `${overOwned[0].category} is over-owned relative to use (${overOwned[0].wearsPerItem} wears/item) — pause buying.`,
    );
  }

  const worst = ctx.costPerWearHighlights?.worstValue[0];
  if (worst) {
    recommendations.push(
      `${worst.name} costs ${worst.costPerWear} per wear — wear it more or reconsider keeping it.`,
    );
  }

  return recommendations;
}
