/**
 * Pure brand-name helpers (RFC-027). Normalization preserves the user's
 * casing (only trims + collapses internal whitespace); dedupe is
 * case/whitespace-insensitive EXACT match — deliberately stricter than
 * matchLookupId, which partial-matches. Creation must never silently fold a
 * distinct brand (e.g. "Nike ACG") into an existing one ("Nike").
 */

export function normalizeBrandName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function dedupeKey(value: string): string {
  return normalizeBrandName(value).toLowerCase();
}

export function findBrandByName(
  name: string,
  options: { id: string; name: string }[],
): { id: string; name: string } | null {
  const key = dedupeKey(name);
  if (!key) return null;
  return options.find((option) => dedupeKey(option.name) === key) ?? null;
}
