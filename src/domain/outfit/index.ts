export {
  OUTFIT_SLOT_DEFINITIONS,
  categoryMatchesOutfitSlot,
  getOptionalOutfitSlots,
  getRequiredOutfitSlots,
} from "@/domain/outfit/slot-matching";

export {
  areFormalitiesCompatible,
  assessOutfitFormalityCompatibility,
  getFormalityRank,
} from "@/domain/outfit/formality-compatibility";

export {
  areColorsCompatible,
  assessOutfitColorCompatibility,
  isNeutralColor,
} from "@/domain/outfit/color-compatibility";

export {
  getOutfitSlotDefinitions,
  scoreOutfit,
  type OutfitScore,
  type OutfitScoringItem,
} from "@/domain/outfit/outfit-scoring";
