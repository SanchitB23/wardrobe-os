import type { OccasionKey as StyleOccasionKey } from "@/domain/style-dna";

/**
 * Occasion label resolution — the single source of truth shared by every
 * recommendation/generation engine. Previously this mapping was copy-pasted into
 * three engines and drifted (e.g. "brunch" was recognized in one but not the
 * others), so the same requested occasion could score differently depending on
 * the entry point. Keep all occasion→key mapping here. Pure and deterministic.
 */

/** Lowercase/trim a free-text occasion label for keyword matching. */
export function normalizeOccasion(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Maps a requested occasion label to the StyleDNA occasion key used for scoring.
 * Returns null when the label is empty or unrecognized.
 */
export function resolveStyleOccasion(
  occasion: string | null | undefined,
): StyleOccasionKey | null {
  const value = normalizeOccasion(occasion);
  if (!value) return null;
  if (["gym", "workout", "fitness"].includes(value)) return "gym";
  if (["office", "work"].includes(value)) return "office";
  if (["wedding", "formal"].includes(value)) return "wedding";
  if (["dinner", "date", "brewery", "party", "brunch", "social"].includes(value)) return "social";
  if (["travel", "vacation"].includes(value)) return "travel";
  if (["smart casual", "smartcasual"].includes(value)) return "smartCasual";
  if (["home", "loungewear"].includes(value)) return "home";
  if (["casual", "everyday"].includes(value)) return "casual";
  return null;
}
