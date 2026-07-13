/**
 * Item pairing service (RFC-031) — orchestrates "what goes with this item?".
 *
 * Fetches the wardrobe via the recommendations repository (same snapshot the
 * Buy vs Skip context uses), derives StyleDNA per item, and hands everything to
 * the pure ItemPairingEngine. Consumed by the item detail page, the
 * `getItemPairings` AI tool, and the orchestrator's `pairing` capability — all
 * three narrate the same deterministic report (ADR-005).
 */

import { deriveStyleDNA, type StyleDNAItem } from "@/domain/style-dna";
import {
  buildPairingReport,
  type ItemPairingReport,
  type PairingEntry,
} from "@/domain/pairing";
import {
  selectRecommendationData,
  type RecoItemRow,
} from "@/features/recommendations/repositories/recommendations.repository";
import { toError } from "@/shared/utils/data-result";

function relatedNames<K extends string>(
  rows: { [key in K]: { name: string } | null }[] | null | undefined,
  key: K,
): string[] {
  return (rows ?? [])
    .map((row) => row[key]?.name ?? null)
    .filter((name): name is string => Boolean(name && name.trim()));
}

/** Map a raw wardrobe row to the StyleDNA-derivable shape the engine needs. */
function toStyleItem(row: RecoItemRow): StyleDNAItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category?.name ?? null,
    subcategory: row.subcategory?.name ?? null,
    color: row.primary_color?.name ?? null,
    formality: row.formality,
    usage: row.usage,
    rating: row.rating,
    seasons: relatedNames(row.item_seasons, "seasons"),
    styles: relatedNames(row.item_styles, "styles"),
    tags: relatedNames(row.item_tags, "tags"),
  };
}

/** Active items only — retired pieces shouldn't shape pairings. */
function isActive(row: RecoItemRow): boolean {
  return row.status === "active" || row.status === null;
}

function toEntry(row: RecoItemRow): PairingEntry {
  const item = toStyleItem(row);
  return { item, dna: deriveStyleDNA(item) };
}

/** Build the deterministic pairing report for an owned wardrobe item. */
export async function getItemPairings(
  itemId: string,
): Promise<{ data: ItemPairingReport | null; error: Error | null }> {
  const { data, error } = await selectRecommendationData();
  if (error) return { data: null, error };
  if (!data) return { data: null, error: toError("Wardrobe data unavailable.") };

  const anchorRow = data.items.find((row) => row.id === itemId);
  if (!anchorRow) return { data: null, error: toError("Item not found.") };

  const anchor = { ...toEntry(anchorRow), active: isActive(anchorRow) };
  const wardrobe = data.items
    .filter((row) => row.id !== itemId && isActive(row))
    .map(toEntry);

  return { data: buildPairingReport(anchor, wardrobe), error: null };
}
