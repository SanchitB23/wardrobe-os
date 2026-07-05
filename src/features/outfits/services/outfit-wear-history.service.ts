import {
  buildOutfitWearStats,
  type OutfitWearStats,
} from "@/domain/wardrobe/wear-analytics";
import { queryWearLogsByOutfitId } from "@/features/wear-logs/repositories/wear-logs.repository";

/** Fetches wear logs for an outfit and reduces them to per-event stats. */
export async function fetchOutfitWearHistory(
  outfitId: string,
): Promise<{ data: OutfitWearStats | null; error: Error | null }> {
  const logsResult = await queryWearLogsByOutfitId(outfitId);

  if (logsResult.error) {
    return { data: null, error: logsResult.error };
  }

  return {
    data: buildOutfitWearStats(
      (logsResult.data ?? []).map((log) => ({
        worn_on: log.worn_on,
        comfort_rating: log.comfort_rating,
      })),
    ),
    error: null,
  };
}
