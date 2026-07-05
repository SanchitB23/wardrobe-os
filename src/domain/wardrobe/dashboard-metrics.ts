import type {
  AnalyticsColorDistributionItem,
  AnalyticsDistributionItem,
  AnalyticsEnumDistributionItem,
  AnalyticsInsightItem,
  FormalityEnum,
  LookupOption,
  UsageFrequency,
} from "@/types/wardrobe";
import { formatEnumLabel } from "@/types/wardrobe";

export type DistributionItemInput = {
  category_id: string | null;
  subcategory_id: string | null;
  brand_id: string | null;
  primary_color_id: string | null;
  usage: UsageFrequency | null;
  formality: FormalityEnum | null;
};

export type ColorLookup = {
  id: string;
  name: string;
  hex: string | null;
};

export function countByForeignKey(
  items: readonly DistributionItemInput[],
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

export function toDistributionItems(
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

export function buildCategoryDistribution(
  items: readonly DistributionItemInput[],
  categories: readonly LookupOption[],
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

export function buildEnumDistribution(
  items: readonly DistributionItemInput[],
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

  const distribution: AnalyticsEnumDistributionItem[] = enumValues.map((value) => ({
    value,
    label: formatEnumLabel(value),
    count: counts.get(value) ?? 0,
  }));

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

export function buildSeasonDistribution(
  seasonLinks: readonly { item_id: string; season_id: string }[],
  seasons: readonly LookupOption[],
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

export function buildColorDistribution(
  items: readonly DistributionItemInput[],
  colors: readonly ColorLookup[],
): AnalyticsColorDistributionItem[] {
  const colorById = new Map(colors.map((color) => [color.id, color]));
  const colorCounts = countByForeignKey(items, "primary_color_id");

  return [...colorCounts.entries()]
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
}

export type InsightItemInput = DistributionItemInput & {
  id: string;
  code: string;
  name: string;
  rating: number | null;
  status: string | null;
};

export function toInsightItem(
  item: InsightItemInput,
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

export function buildDashboardInsights(
  items: readonly InsightItemInput[],
  categories: readonly AnalyticsDistributionItem[],
  categoryNameById: Map<string, string>,
): {
  highestRated: AnalyticsInsightItem[];
  lowestRatedActive: AnalyticsInsightItem[];
  rareUsage: AnalyticsInsightItem[];
  highCountCategories: AnalyticsDistributionItem[];
} {
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

  return {
    highestRated,
    lowestRatedActive,
    rareUsage,
    highCountCategories: categories.slice(0, 5),
  };
}
