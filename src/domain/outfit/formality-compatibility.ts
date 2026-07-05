import type { FormalityEnum } from "@/types/wardrobe";
import { FORMALITY_LEVELS } from "@/types/wardrobe";

const FORMALITY_RANK: Record<FormalityEnum, number> = {
  casual: 0,
  smart_casual: 1,
  business_casual: 2,
  business_formal: 3,
  formal: 4,
};

const DEFAULT_MAX_FORMALITY_GAP = 1;

export function getFormalityRank(
  formality: FormalityEnum | null | undefined,
): number | null {
  if (!formality) {
    return null;
  }

  return FORMALITY_RANK[formality];
}

export function areFormalitiesCompatible(
  left: FormalityEnum | null | undefined,
  right: FormalityEnum | null | undefined,
  maxGap = DEFAULT_MAX_FORMALITY_GAP,
): boolean {
  const leftRank = getFormalityRank(left);
  const rightRank = getFormalityRank(right);

  if (leftRank === null || rightRank === null) {
    return true;
  }

  return Math.abs(leftRank - rightRank) <= maxGap;
}

export type OutfitFormalityAssessment = {
  compatible: boolean;
  spread: number;
  dominantFormality: FormalityEnum | null;
  outliers: FormalityEnum[];
};

export function assessOutfitFormalityCompatibility(
  formalities: readonly (FormalityEnum | null | undefined)[],
): OutfitFormalityAssessment {
  const ranked = formalities
    .map((formality) =>
      formality ? { formality, rank: FORMALITY_RANK[formality] } : null,
    )
    .filter((entry): entry is { formality: FormalityEnum; rank: number } =>
      Boolean(entry),
    );

  if (ranked.length === 0) {
    return {
      compatible: true,
      spread: 0,
      dominantFormality: null,
      outliers: [],
    };
  }

  const ranks = ranked.map((entry) => entry.rank);
  const minRank = Math.min(...ranks);
  const maxRank = Math.max(...ranks);
  const spread = maxRank - minRank;
  const dominantRank = Math.round(ranks.reduce((sum, rank) => sum + rank, 0) / ranks.length);
  const dominantFormality = FORMALITY_LEVELS[dominantRank] ?? ranked[0]?.formality ?? null;

  const outliers = ranked
    .filter((entry) => Math.abs(entry.rank - dominantRank) > DEFAULT_MAX_FORMALITY_GAP)
    .map((entry) => entry.formality);

  return {
    compatible: spread <= DEFAULT_MAX_FORMALITY_GAP,
    spread,
    dominantFormality,
    outliers,
  };
}
