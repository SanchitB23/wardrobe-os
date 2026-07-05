import { evaluateOutfit } from "@/domain/outfit";
import type { OutfitEvaluationInput, OutfitEvaluationResult } from "@/domain/outfit";
import {
  fetchEvaluationRelationRows,
  type EvaluationRelationRows,
} from "@/features/outfits/repositories/outfits.repository";
import type { OutfitDetail } from "@/features/outfits/types";
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
): Promise<{ data: OutfitEvaluationResult | null; error: Error | null }> {
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
