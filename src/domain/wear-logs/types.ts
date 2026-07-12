/**
 * Wear Logs domain types (RFC-023).
 * Event-centric wear history — distinct from curated Saved Outfits.
 */

export type WearLogSource =
  | "outfit"
  | "ad_hoc"
  | "recommendation"
  | "trip"
  | "ai";

export const WEAR_LOG_SOURCES: readonly WearLogSource[] = [
  "outfit",
  "ad_hoc",
  "recommendation",
  "trip",
  "ai",
] as const;

/** Default times an identical combo must appear before suggesting promotion. */
export const DEFAULT_PROMOTE_THRESHOLD = 3;

/** Minimum distinct items before "Save as Outfit?" is offered. */
export const MIN_ITEMS_FOR_PROMOTE_SUGGESTION = 2;

export interface WearLogItemRef {
  itemId: string;
  slot: string | null;
  sortOrder: number;
}

export interface WearLogWeather {
  season?: string | null;
  condition?: string | null;
  temperatureC?: number | null;
  feelsLikeC?: number | null;
  source?: string | null;
}

/** Pure domain shape of a wear event (no I/O). */
export interface WearLogEventModel {
  id: string;
  wornOn: string;
  occasionId: string | null;
  outfitId: string | null;
  source: WearLogSource;
  notes: string | null;
  weather: WearLogWeather | null;
  combinationKey: string;
  items: WearLogItemRef[];
  createdAt: string;
}

export interface CombinationSuggestion {
  combinationKey: string;
  count: number;
  threshold: number;
  itemCount: number;
  shouldSuggestPromote: boolean;
}

export interface OutfitPromoteDraft {
  /** Optional prefilled name hint (null — user must choose). */
  nameHint: string | null;
  itemIds: string[];
  slots: Array<{ itemId: string; slot: string | null; sortOrder: number }>;
  occasionId: string | null;
  notes: string | null;
}
