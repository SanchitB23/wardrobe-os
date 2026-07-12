/**
 * Wear Logs domain (RFC-023) — pure fingerprinting + promotion drafts.
 */

export type {
  WearLogSource,
  WearLogItemRef,
  WearLogWeather,
  WearLogEventModel,
  CombinationSuggestion,
  OutfitPromoteDraft,
} from "@/domain/wear-logs/types";

export {
  WEAR_LOG_SOURCES,
  DEFAULT_PROMOTE_THRESHOLD,
  MIN_ITEMS_FOR_PROMOTE_SUGGESTION,
} from "@/domain/wear-logs/types";

export {
  normalizeItemIds,
  buildCombinationKey,
  shouldSuggestOutfitPromotion,
  buildCombinationSuggestion,
  mapWearLogToOutfitDraft,
  buildOrderedWearItems,
  legacyOutfitGroupKey,
} from "@/domain/wear-logs/WearCombination";
