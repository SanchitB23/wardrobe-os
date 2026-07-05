import { evaluateOutfit } from "@/domain/outfit";
import type { OutfitAnalysis, OutfitEvaluationInput } from "@/domain/outfit";
import {
  fetchEvaluationRelationRows,
  fetchOccasions,
  fetchOutfitItemLinks,
  fetchOutfitRows,
  type EvaluationRelationRows,
} from "@/features/outfits/repositories/outfits.repository";
import {
  OUTFIT_SLOT_DEFINITIONS,
  type OutfitDetail,
  type OutfitSlot,
} from "@/features/outfits/types";
import type { FormalityEnum } from "@/types/wardrobe";

/** Per-item enrichment row used to build engine input. */
export type EvaluationItemAttributes = {
  item_id: string;
  name: string;
  formality: FormalityEnum | null;
  rating: number | null;
  colorHex: string | null;
  colorName: string | null;
  material: string | null;
  seasonTags: string[];
  occasionTags: string[];
};

type EvaluationOutfit = Pick<OutfitDetail, "season" | "occasion" | "items">;

/** Maps a loaded outfit plus item enrichment rows into domain engine input. */
export function toOutfitEvaluationInput(
  outfit: EvaluationOutfit,
  attributesByItemId: ReadonlyMap<string, EvaluationItemAttributes>,
): OutfitEvaluationInput {
  return {
    items: outfit.items.map((entry) => {
      const attributes = attributesByItemId.get(entry.item_id) ?? null;

      return {
        slot: entry.slot,
        name: attributes?.name ?? entry.item?.name ?? "Unknown item",
        formality: attributes?.formality ?? null,
        colorHex: attributes?.colorHex ?? null,
        colorName: attributes?.colorName ?? null,
        seasonTags: attributes?.seasonTags ?? [],
        occasionTags: attributes?.occasionTags ?? [],
        material: attributes?.material ?? null,
        rating: attributes?.rating ?? null,
      };
    }),
    context: {
      targetSeason: outfit.season?.name ?? null,
      targetOccasion: outfit.occasion?.name ?? null,
      weather: null,
    },
  };
}

function groupNamesByItemId(
  rows: { item_id: string; [key: string]: unknown }[],
  key: "season" | "material" | "occasion",
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const row of rows) {
    const related = row[key] as { name: string } | null;
    if (!related?.name) {
      continue;
    }
    const names = grouped.get(row.item_id) ?? [];
    names.push(related.name);
    grouped.set(row.item_id, names);
  }

  return grouped;
}

/** Assembles repository rows into per-item attribute records. */
export function buildEvaluationAttributes(
  rows: EvaluationRelationRows,
): Map<string, EvaluationItemAttributes> {
  const seasonsByItem = groupNamesByItemId(rows.seasons, "season");
  const materialsByItem = groupNamesByItemId(rows.materials, "material");
  const occasionsByItem = groupNamesByItemId(rows.occasions, "occasion");

  return new Map(
    rows.items.map((item) => [
      item.id,
      {
        item_id: item.id,
        name: item.name,
        formality: (item.formality as FormalityEnum | null) ?? null,
        rating: item.rating,
        colorHex: item.primary_color?.hex ?? null,
        colorName: item.primary_color?.name ?? null,
        material: materialsByItem.get(item.id)?.[0] ?? null,
        seasonTags: seasonsByItem.get(item.id) ?? [],
        occasionTags: occasionsByItem.get(item.id) ?? [],
      },
    ]),
  );
}

/** Fetches item enrichment for an outfit and runs the domain outfit engine. */
export async function fetchOutfitEvaluation(
  outfit: EvaluationOutfit,
): Promise<{ data: OutfitAnalysis | null; error: Error | null }> {
  const itemIds = [...new Set(outfit.items.map((entry) => entry.item_id))];

  const rowsResult = await fetchEvaluationRelationRows(itemIds);
  if (rowsResult.error || !rowsResult.data) {
    return { data: null, error: rowsResult.error };
  }

  const attributes = buildEvaluationAttributes(rowsResult.data);

  return {
    data: evaluateOutfit(toOutfitEvaluationInput(outfit, attributes)),
    error: null,
  };
}

function isOutfitSlot(value: string): value is OutfitSlot {
  return OUTFIT_SLOT_DEFINITIONS.some((definition) => definition.slot === value);
}

/**
 * Bulk-evaluates every outfit for list views: one pass over outfits,
 * outfit_items, and item attributes, then the pure domain engine per outfit.
 */
export async function fetchOutfitScores(): Promise<{
  data: Record<string, number> | null;
  error: Error | null;
}> {
  const [outfitsResult, linksResult, occasionsResult] = await Promise.all([
    fetchOutfitRows(),
    fetchOutfitItemLinks(),
    fetchOccasions(),
  ]);

  const firstError =
    outfitsResult.error ?? linksResult.error ?? occasionsResult.error;
  if (firstError) {
    return { data: null, error: firstError };
  }

  const outfits = outfitsResult.data ?? [];
  const links = (linksResult.data ?? []).filter((link) => isOutfitSlot(link.role));
  const occasionById = new Map(
    (occasionsResult.data ?? []).map((occasion) => [occasion.id, occasion]),
  );

  const itemIds = [...new Set(links.map((link) => link.item_id))];
  const rowsResult = await fetchEvaluationRelationRows(itemIds);
  if (rowsResult.error || !rowsResult.data) {
    return { data: null, error: rowsResult.error };
  }

  const attributes = buildEvaluationAttributes(rowsResult.data);
  const linksByOutfit = new Map<string, typeof links>();
  for (const link of links) {
    const existing = linksByOutfit.get(link.outfit_id) ?? [];
    existing.push(link);
    linksByOutfit.set(link.outfit_id, existing);
  }

  const scores: Record<string, number> = {};
  for (const outfit of outfits) {
    const outfitLinks = linksByOutfit.get(outfit.id) ?? [];
    const evaluationOutfit: EvaluationOutfit = {
      season: outfit.season ? { id: outfit.season, name: outfit.season } : null,
      occasion: outfit.occasion_id
        ? (occasionById.get(outfit.occasion_id) ?? null)
        : null,
      items: outfitLinks.map((link) => ({
        outfit_id: link.outfit_id,
        item_id: link.item_id,
        slot: link.role as OutfitSlot,
        item: null,
      })),
    };

    scores[outfit.id] = evaluateOutfit(
      toOutfitEvaluationInput(evaluationOutfit, attributes),
    ).overallScore;
  }

  return { data: scores, error: null };
}
