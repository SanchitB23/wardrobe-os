import {
  analyzeWardrobeHealth,
  type WardrobeHealth,
  type WardrobeHealthItem,
} from "@/domain/analytics/WardrobeHealthEngine";
import { selectActiveHealthItems } from "@/features/analytics/repositories/analytics.repository";

/**
 * Orchestrates the wardrobe health report: fetches active items, maps them to
 * the domain input, and runs the pure {@link analyzeWardrobeHealth} engine.
 */
export async function fetchWardrobeHealth(): Promise<{
  data: WardrobeHealth | null;
  error: Error | null;
}> {
  const result = await selectActiveHealthItems();
  if (result.error) {
    return { data: null, error: result.error };
  }

  const items: WardrobeHealthItem[] = (result.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category?.name ?? null,
    color: row.primary_color?.name ?? null,
    brand: row.brand?.name ?? null,
    formality: row.formality,
    status: row.status,
  }));

  return { data: analyzeWardrobeHealth(items), error: null };
}
