/**
 * Pure mappers over `RecoItemRow` — the canonical home for the row → domain
 * mapping shared by every feature service that consumes
 * `selectRecommendationData` (acquisition, lifestyle, orchestrator,
 * category optimization, ...), so it isn't copy-pasted per feature.
 */

import type { StyleDNAItem } from "@/domain/style-dna";
import type { RecoItemRow } from "./recommendations.repository";

/** Extracts non-empty related names from a junction relation. */
export function relatedNames<K extends string>(
  rows: { [key in K]: { name: string } | null }[] | null | undefined,
  key: K,
): string[] {
  return (rows ?? [])
    .map((row) => row[key]?.name ?? null)
    .filter((name): name is string => Boolean(name && name.trim()));
}

/** Map a raw wardrobe row to the StyleDNA-derivable shape the engines need. */
export function toStyleItem(row: RecoItemRow): StyleDNAItem {
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

/** Active items only — retired pieces shouldn't shape wardrobe intelligence. */
export function isActive(row: RecoItemRow): boolean {
  return row.status === "active" || row.status === null;
}
