/**
 * Pure mappers over `RecoItemRow` — the canonical home for the row → domain
 * mapping shared by every feature service that consumes
 * `selectRecommendationData` (acquisition, lifestyle, orchestrator,
 * category optimization, ...), so it isn't copy-pasted per feature.
 */

import type { WardrobeItemInput } from "@/domain/recommendation";
import type { StyleDNAItem } from "@/domain/style-dna";
import { relatedNames } from "@/shared/utils/related-names";
import type { RecoItemRow } from "./recommendations.repository";

// Re-exported from shared utils so RecoItemRow consumers import one module.
export { relatedNames };

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

/** Map a raw wardrobe row to the Recommendation Engine's item input. */
export function toItemInput(row: RecoItemRow): WardrobeItemInput {
  return {
    id: row.id,
    name: row.name,
    category: row.category?.name ?? null,
    subcategory: row.subcategory?.name ?? null,
    color: row.primary_color?.name ?? null,
    formality: row.formality,
    usage: row.usage,
    rating: row.rating,
    status: row.status,
    seasons: relatedNames(row.item_seasons, "seasons"),
    styles: relatedNames(row.item_styles, "styles"),
    tags: relatedNames(row.item_tags, "tags"),
  };
}

/** Active items only — retired pieces shouldn't shape wardrobe intelligence. */
export function isActive(row: RecoItemRow): boolean {
  return row.status === "active" || row.status === null;
}
