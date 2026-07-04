import { createClient } from "@/lib/supabase/client";
import { fetchWearLogAnalytics } from "@/lib/wardrobe/wear-logs";
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

const ANALYTICS_ITEM_SELECT =
  "id, code, name, status, usage, rating, formality, category_id, subcategory_id, brand_id, primary_color_id";

type AnalyticsItemRow = {
  id: string;
  code: string;
  name: string;
  status: string | null;
  usage: UsageFrequency | null;
  rating: number | null;
  formality: FormalityEnum | null;
  category_id: string | null;
  subcategory_id: string | null;
  brand_id: string | null;
  primary_color_id: string | null;
  favorite?: boolean | null;
};

type ColorLookup = LookupOption & {
  hex: string | null;
};

function toError(message: string) {
  return new Error(message);
}

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

async function fetchFavoriteFlags(): Promise<Map<string, boolean>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("wardrobe_items")
    .select("id, favorite" as typeof ANALYTICS_ITEM_SELECT);

  if (error) {
    return new Map();
  }

  const favorites = new Map<string, boolean>();
  for (const row of (data ?? []) as AnalyticsItemRow[]) {
    if (row.favorite === true) {
      favorites.set(row.id, true);
    }
  }

  return favorites;
}

export async function fetchWardrobeDashboardAnalytics(): Promise<{
  data: WardrobeDashboardAnalytics | null;
  error: Error | null;
}> {
  const supabase = createClient();

  const [
    itemsResult,
    categoriesResult,
    subcategoriesResult,
    brandsResult,
    colorsResult,
    seasonsResult,
    seasonLinksResult,
    favoriteFlags,
  ] = await Promise.all([
    supabase.from("wardrobe_items").select(ANALYTICS_ITEM_SELECT),
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("subcategories").select("id, name").order("name"),
    supabase.from("brands").select("id, name").order("name"),
    supabase.from("colors").select("id, name, hex").order("name"),
    supabase.from("seasons").select("id, name").order("name"),
    supabase.from("item_seasons").select("item_id, season_id"),
    fetchFavoriteFlags(),
  ]);

  const firstError =
    itemsResult.error ??
    categoriesResult.error ??
    subcategoriesResult.error ??
    brandsResult.error ??
    colorsResult.error ??
    seasonsResult.error ??
    seasonLinksResult.error;

  if (firstError) {
    return { data: null, error: toError(firstError.message) };
  }

  const baseItems = (itemsResult.data ?? []) as AnalyticsItemRow[];
  const items = baseItems.map((item) => ({
    ...item,
    favorite: favoriteFlags.get(item.id) ?? null,
  }));

  const categories = (categoriesResult.data ?? []) as LookupOption[];
  const subcategories = (subcategoriesResult.data ?? []) as LookupOption[];
  const brands = (brandsResult.data ?? []) as LookupOption[];
  const colors = (colorsResult.data ?? []) as ColorLookup[];
  const seasons = (seasonsResult.data ?? []) as LookupOption[];
  const seasonLinks = (seasonLinksResult.data ?? []) as {
    item_id: string;
    season_id: string;
  }[];

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
  const colorDistribution: AnalyticsColorDistributionItem[] = [...colorCounts.entries()]
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

  const wearAnalyticsResult = await fetchWearLogAnalytics(
    items.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category_id: item.category_id,
      status: item.status,
    })),
    categoryNameById,
  );

  if (wearAnalyticsResult.error) {
    return { data: null, error: wearAnalyticsResult.error };
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
    },
    error: null,
  };
}
