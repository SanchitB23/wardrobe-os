import { calculateAverageRating } from "@/domain/wardrobe/ratings";

export type SummaryItemInput = {
  status: string | null;
  rating: number | null;
  usage: string | null;
  favorite?: boolean | null;
};

export type InventorySummaryResult = {
  totalItems: number;
  activeItems: number;
  heroPieces: number;
  averageRating: number | null;
};

export type DashboardSummaryResult = InventorySummaryResult & {
  favorites: number;
};

export function buildInventorySummary(
  items: readonly SummaryItemInput[],
): InventorySummaryResult {
  return {
    totalItems: items.length,
    activeItems: items.filter((item) => item.status === "active").length,
    heroPieces: items.filter((item) => item.usage === "hero").length,
    averageRating: calculateAverageRating(items.map((item) => item.rating)),
  };
}

export function buildDashboardSummary(
  items: readonly SummaryItemInput[],
): DashboardSummaryResult {
  return {
    ...buildInventorySummary(items),
    favorites: items.filter((item) => item.favorite === true).length,
  };
}
