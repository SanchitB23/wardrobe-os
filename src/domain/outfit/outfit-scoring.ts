import { assessOutfitColorCompatibility } from "@/domain/outfit/color-compatibility";
import { assessOutfitFormalityCompatibility } from "@/domain/outfit/formality-compatibility";
import {
  getOptionalOutfitSlots,
  getRequiredOutfitSlots,
  OUTFIT_SLOT_DEFINITIONS,
} from "@/domain/outfit/slot-matching";
import { calculateAverageRating } from "@/domain/wardrobe/ratings";
import type { FormalityEnum, OutfitSlot } from "@/types/wardrobe";

export type OutfitScoringItem = {
  slot: OutfitSlot;
  formality: FormalityEnum | null;
  colorHex: string | null;
  colorName?: string | null;
  rating: number | null;
};

export type OutfitScore = {
  score: number;
  completeness: number;
  formalityScore: number;
  colorScore: number;
  averageItemRating: number | null;
  missingRequiredSlots: OutfitSlot[];
  formality: ReturnType<typeof assessOutfitFormalityCompatibility>;
  colors: ReturnType<typeof assessOutfitColorCompatibility>;
};

export function scoreOutfit(items: readonly OutfitScoringItem[]): OutfitScore {
  const filledSlots = new Set(items.map((item) => item.slot));
  const requiredSlots = getRequiredOutfitSlots();
  const optionalSlots = getOptionalOutfitSlots();
  const missingRequiredSlots = requiredSlots.filter((slot) => !filledSlots.has(slot));

  const completeness =
    requiredSlots.length === 0
      ? 1
      : (requiredSlots.length - missingRequiredSlots.length) / requiredSlots.length;

  const optionalFilled = optionalSlots.filter((slot) => filledSlots.has(slot)).length;
  const optionalBonus =
    optionalSlots.length === 0 ? 0 : (optionalFilled / optionalSlots.length) * 0.1;

  const formality = assessOutfitFormalityCompatibility(
    items.map((item) => item.formality),
  );
  const formalityScore = formality.compatible
    ? 1
    : Math.max(0, 1 - formality.spread * 0.2);

  const colors = assessOutfitColorCompatibility(
    items.map((item) => ({
      hex: item.colorHex,
      name: item.colorName,
    })),
  );

  const averageItemRating = calculateAverageRating(items.map((item) => item.rating));
  const ratingScore =
    averageItemRating === null ? 0.5 : Math.min(1, averageItemRating / 10);

  const score = Math.round(
    (completeness * 0.45 +
      formalityScore * 0.2 +
      colors.score * 0.2 +
      ratingScore * 0.15 +
      optionalBonus) *
      100,
  );

  return {
    score,
    completeness: Math.round(completeness * 100) / 100,
    formalityScore: Math.round(formalityScore * 100) / 100,
    colorScore: colors.score,
    averageItemRating,
    missingRequiredSlots,
    formality,
    colors,
  };
}

export function getOutfitSlotDefinitions() {
  return OUTFIT_SLOT_DEFINITIONS;
}
