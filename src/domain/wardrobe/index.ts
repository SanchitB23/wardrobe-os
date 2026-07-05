export {
  calculateAverageCostPerWear,
  calculateCostPerWear,
  aggregateWearCounts,
  sumWearCounts,
} from "@/domain/wardrobe/cost-per-wear";

export { calculateAverageRating, roundToOneDecimal } from "@/domain/wardrobe/ratings";

export {
  buildDashboardSummary,
  buildInventorySummary,
  type DashboardSummaryResult,
  type InventorySummaryResult,
  type SummaryItemInput,
} from "@/domain/wardrobe/inventory-summary";

export {
  buildCategoryDistribution,
  buildColorDistribution,
  buildDashboardInsights,
  buildEnumDistribution,
  buildSeasonDistribution,
  countByForeignKey,
  toDistributionItems,
  toInsightItem,
} from "@/domain/wardrobe/dashboard-metrics";

export {
  buildMonthlySpendingTimeline,
  buildPurchaseAnalytics,
  filterActivePurchases,
  isReturnedPurchaseStatus,
  sumAmountsByItemKey,
  sumPurchaseAmounts,
} from "@/domain/wardrobe/purchase-analytics";

export {
  buildItemWearSummary,
  buildWearCountMaps,
  buildWearLogAnalytics,
} from "@/domain/wardrobe/wear-analytics";

export {
  interpretStylesHealthCheck,
  type WardrobeHealthStatus,
} from "@/domain/wardrobe/wardrobe-health";
