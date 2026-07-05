import { fetchPurchaseAnalytics } from "@/features/purchases/services/purchases.service";
import { fetchWearLogAnalytics } from "@/features/wear-logs/services/wear-logs.service";
import {
  fetchDashboardAnalyticsRawData,
  type AnalyticsItemRow,
} from "@/features/dashboard/repositories/analytics.repository";
import type {
  AnalyticsColorDistributionItem,
  AnalyticsDistributionItem,
  AnalyticsEnumDistributionItem,
  AnalyticsInsightItem,
  DashboardSummary,
  FormalityEnum,
  LookupOption,
  UsageFrequency,
  WardrobeDashboardAnalytics,
} from "@/types/wardrobe";
import {
  FORMALITY_LEVELS,
  USAGE_FREQUENCIES,
  formatEnumLabel,
} from "@/types/wardrobe";

function countByForeignKey(
  items: readonly AnalyticsItemRow[],
  field: "category_id" | "subcategory_id" | "brand_id" | "primary_color_id",
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const item of items) {
    const id = item[field];
    if (!id) {
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return counts;
}

function toDistributionItems(
  counts: Map<string, number>,
  nameById: Map<string, string>,
  options: { limit?: number } = {},
): AnalyticsDistributionItem[] {
  const items = [...counts.entries()]
    .map(([id, count]) => ({
      id,
      name: nameById.get(id) ?? "Unknown",
      count,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.name.localeCompare(right.name);
    });

  if (options.limit !== undefined) {
    return items.slice(0, options.limit);
  }

  return items;
}

function buildCategoryDistribution(
  items: AnalyticsItemRow[],
  categories: LookupOption[],
): AnalyticsDistributionItem[] {
  const counts = countByForeignKey(items, "category_id");
  const uncategorizedCount = items.filter((item) => !item.category_id).length;

  const distribution: AnalyticsDistributionItem[] = categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      count: counts.get(category.id) ?? 0,
    }))
    .filter((entry) => entry.count > 0);

  if (uncategorizedCount > 0) {
    distribution.push({
      id: null,
      name: "Uncategorized",
      count: uncategorizedCount,
    });
  }

  return distribution.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.name.localeCompare(right.name);
  });
}

function buildEnumDistribution(
  items: AnalyticsItemRow[],
  field: "usage" | "formality",
  enumValues: readonly UsageFrequency[] | readonly FormalityEnum[],
): AnalyticsEnumDistributionItem[] {
  const counts = new Map<string, number>();
  for (const value of enumValues) {
    counts.set(value, 0);
  }

  let unsetCount = 0;
  for (const item of items) {
    const value = item[field];
    if (!value) {
      unsetCount += 1;
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  const distribution: AnalyticsEnumDistributionItem[] = enumValues.map(
    (value) => ({
      value,
      label: formatEnumLabel(value),
      count: counts.get(value) ?? 0,
    }),
  );

  if (unsetCount > 0) {
    distribution.push({
      value: "__unset__",
      label: "Unset",
      count: unsetCount,
    });
  }

  return distribution.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.label.localeCompare(right.label);
  });
}

function buildSeasonDistribution(
  seasonLinks: { item_id: string; season_id: string }[],
  seasons: LookupOption[],
): AnalyticsDistributionItem[] {
  const counts = new Map<string, number>();

  for (const link of seasonLinks) {
    counts.set(link.season_id, (counts.get(link.season_id) ?? 0) + 1);
  }

  return seasons
    .map((season) => ({
      id: season.id,
      name: season.name,
      count: counts.get(season.id) ?? 0,
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.name.localeCompare(right.name);
    });
}

function buildSummary(items: AnalyticsItemRow[]): DashboardSummary {
  const ratedItems = items.filter((item) => item.rating !== null);
  const ratingSum = ratedItems.reduce(
    (sum, item) => sum + Number(item.rating),
    0,
  );

  return {
    totalItems: items.length,
    activeItems: items.filter((item) => item.status === "active").length,
    heroPieces: items.filter((item) => item.usage === "hero").length,
    averageRating:
      ratedItems.length > 0
        ? Math.round((ratingSum / ratedItems.length) * 10) / 10
        : null,
    favorites: items.filter((item) => item.favorite === true).length,
  };
}

function toInsightItem(
  item: AnalyticsItemRow,
  categoryNameById: Map<string, string>,
): AnalyticsInsightItem {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    rating: item.rating,
    usage: item.usage,
    category: item.category_id
      ? (categoryNameById.get(item.category_id) ?? null)
      : null,
  };
}

function buildInsights(
  items: AnalyticsItemRow[],
  categories: AnalyticsDistributionItem[],
  categoryNameById: Map<string, string>,
): WardrobeDashboardAnalytics["insights"] {
  const ratedItems = items.filter((item) => item.rating !== null);

  const highestRated = [...ratedItems]
    .sort((left, right) => {
      if ((right.rating ?? 0) !== (left.rating ?? 0)) {
        return (right.rating ?? 0) - (left.rating ?? 0);
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 5)
    .map((item) => toInsightItem(item, categoryNameById));

  const lowestRatedActive = items
    .filter((item) => item.status === "active" && item.rating !== null)
    .sort((left, right) => {
      if ((left.rating ?? 0) !== (right.rating ?? 0)) {
        return (left.rating ?? 0) - (right.rating ?? 0);
      }
      return left.name.localeCompare(right.name);
    })
    .slice(0, 5)
    .map((item) => toInsightItem(item, categoryNameById));

  const rareUsage = items
    .filter((item) => item.usage === "rare")
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, 8)
    .map((item) => toInsightItem(item, categoryNameById));

  const highCountCategories = categories.slice(0, 5);

  return {
    highestRated,
    lowestRatedActive,
    rareUsage,
    highCountCategories,
  };
}

export async function fetchWardrobeDashboardAnalytics(): Promise<{
  data: WardrobeDashboardAnalytics | null;
  error: Error | null;
}> {
  const rawResult = await fetchDashboardAnalyticsRawData();
  if (rawResult.error) {
    return { data: null, error: rawResult.error };
  }

  const raw = rawResult.data;
  if (!raw) {
    return { data: null, error: new Error("No data returned") };
  }

  const {
    items,
    categories,
    subcategories,
    brands,
    colors,
    seasons,
    seasonLinks,
  } = raw;

  const categoryNameById = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const subcategoryNameById = new Map(
    subcategories.map((subcategory) => [subcategory.id, subcategory.name]),
  );
  const brandNameById = new Map(brands.map((brand) => [brand.id, brand.name]));
  const colorById = new Map(colors.map((color) => [color.id, color]));

  const categoryDistribution = buildCategoryDistribution(items, categories);
  const subcategoryDistribution = toDistributionItems(
    countByForeignKey(items, "subcategory_id"),
    subcategoryNameById,
    { limit: 10 },
  );
  const brandDistribution = toDistributionItems(
    countByForeignKey(items, "brand_id"),
    brandNameById,
    { limit: 10 },
  );

  const colorCounts = countByForeignKey(items, "primary_color_id");
  const colorDistribution: AnalyticsColorDistributionItem[] = [
    ...colorCounts.entries(),
  ]
    .map(([id, count]) => {
      const color = colorById.get(id);
      return {
        id,
        name: color?.name ?? "Unknown",
        hex: color?.hex ?? null,
        count,
      };
    })
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.name.localeCompare(right.name);
    });

  const [wearAnalyticsResult, purchaseAnalyticsResult] = await Promise.all([
    fetchWearLogAnalytics(
      items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        category_id: item.category_id,
        status: item.status,
      })),
      categoryNameById,
    ),
    fetchPurchaseAnalytics(),
  ]);

  if (wearAnalyticsResult.error) {
    return { data: null, error: wearAnalyticsResult.error };
  }

  if (purchaseAnalyticsResult.error) {
    return { data: null, error: purchaseAnalyticsResult.error };
  }

  return {
    data: {
      summary: buildSummary(items),
      categories: categoryDistribution,
      subcategories: subcategoryDistribution,
      brands: brandDistribution,
      colors: colorDistribution,
      usage: buildEnumDistribution(items, "usage", USAGE_FREQUENCIES),
      formality: buildEnumDistribution(items, "formality", FORMALITY_LEVELS),
      seasons: buildSeasonDistribution(seasonLinks, seasons),
      insights: buildInsights(items, categoryDistribution, categoryNameById),
      wearInsights: wearAnalyticsResult.data ?? {
        mostWorn: [],
        leastWornActive: [],
        notWornYet: [],
        recentlyWorn: [],
      },
      purchaseInsights: purchaseAnalyticsResult.data ?? {
        totalWardrobeValue: 0,
        averageCostPerWear: null,
        mostExpensiveItem: null,
        cheapestItem: null,
        topBrandsByValue: [],
        spendingByBrand: [],
        spendingByCategory: [],
        monthlyTimeline: [],
      },
    },
    error: null,
  };
}
