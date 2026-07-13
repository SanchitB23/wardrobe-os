/**
 * Tunables for the Item Pairing Engine (RFC-030).
 *
 * Seeded from the acquisition module's OUTFIT_COMPAT / GUARDS values (RFC-001)
 * so anchored-outfit behaviour starts identical to Buy vs Skip's, but tuned
 * independently from here on.
 */

export const ITEM_PAIRING_ENGINE_VERSION = "1.0.0";

export const PAIRING_DEFAULTS = {
  /** Top-K wardrobe items per complementary slot (by rating, then name). */
  topKPerSlot: 3,
  /** Hard cap on candidate outfits scored with evaluateOutfit. */
  maxCandidates: 12,
  /** Anchored outfits returned in the report. */
  maxReturnedOutfits: 4,
  /** Pairings returned per complementary slot. */
  maxReturnedPairingsPerSlot: 3,
  /** Best outfit score (0–10) at/above this reads as a strong pairing set. */
  strongOutfitThreshold: 7,
} as const;
