import { fetchPurchaseAnalytics } from "@/features/purchases/services/purchases.service";
import { fetchWearLogAnalytics } from "@/features/wear-logs/services/wear-logs.service";
import {
  fetchDashboardAnalyticsRawData,
  type AnalyticsItemRow,
} from "@/features/dashboard/repositories/analytics.repository";
import {
  buildCategoryDistribution,
  buildColorDistribution,
  buildDashboardInsights,
  buildEnumDistribution,
  buildSeasonDistribution,
  countByForeignKey,
  toDistributionItems,
} from "@/domain/wardrobe/dashboard-metrics";
import { buildDashboardSummary } from "@/domain/wardrobe/inventory-summary";
import type { WardrobeDashboardAnalytics } from "@/types/wardrobe";
import { FORMALITY_LEVELS, USAGE_FREQUENCIES } from "@/types/wardrobe";

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
  const colorDistribution = buildColorDistribution(items, colors);

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
      summary: buildDashboardSummary(items as AnalyticsItemRow[]),
      categories: categoryDistribution,
      subcategories: subcategoryDistribution,
      brands: brandDistribution,
      colors: colorDistribution,
      usage: buildEnumDistribution(items, "usage", USAGE_FREQUENCIES),
      formality: buildEnumDistribution(items, "formality", FORMALITY_LEVELS),
      seasons: buildSeasonDistribution(seasonLinks, seasons),
      insights: buildDashboardInsights(
        items as AnalyticsItemRow[],
        categoryDistribution,
        categoryNameById,
      ),
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
