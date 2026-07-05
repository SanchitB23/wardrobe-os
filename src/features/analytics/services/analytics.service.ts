import {
  analyzeWardrobeHealth,
  buildWardrobeHealthDebug,
  type WardrobeHealth,
  type WardrobeHealthDebug,
  type WardrobeHealthItem,
} from "@/domain/analytics/WardrobeHealthEngine";
import {
  selectActiveHealthItems,
  type HealthItemRow,
} from "@/features/analytics/repositories/analytics.repository";

export type WardrobeHealthReport = {
  health: WardrobeHealth;
  debug: WardrobeHealthDebug;
};

/** Extracts non-empty related names from a junction relation. */
function relatedNames<K extends string>(
  rows: { [key in K]: { name: string } | null }[] | null | undefined,
  key: K,
): string[] {
  return (rows ?? [])
    .map((row) => row[key]?.name ?? null)
    .filter((name): name is string => Boolean(name && name.trim()));
}

function toHealthItem(row: HealthItemRow): WardrobeHealthItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category?.name ?? null,
    subcategory: row.subcategory?.name ?? null,
    color: row.primary_color?.name ?? null,
    brand: row.brand?.name ?? null,
    formality: row.formality,
    usage: row.usage,
    status: row.status,
    seasons: relatedNames(row.item_seasons, "seasons"),
    styles: relatedNames(row.item_styles, "styles"),
    tags: relatedNames(row.item_tags, "tags"),
  };
}

/**
 * Orchestrates the wardrobe health report: fetches active items, maps them to
 * the domain input, and runs the pure {@link analyzeWardrobeHealth} engine plus
 * the {@link buildWardrobeHealthDebug} diagnostic trace from the same items.
 */
export async function fetchWardrobeHealth(): Promise<{
  data: WardrobeHealthReport | null;
  error: Error | null;
}> {
  const result = await selectActiveHealthItems();
  if (result.error) {
    return { data: null, error: result.error };
  }

  const items = (result.data ?? []).map(toHealthItem);

  return {
    data: {
      health: analyzeWardrobeHealth(items),
      debug: buildWardrobeHealthDebug(items),
    },
    error: null,
  };
}
