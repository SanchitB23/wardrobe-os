/**
 * Shared string helpers for Catalog Review (RFC-024).
 */

export function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Common color tokens stripped before similar-name comparison. */
export const COLOR_NAME_TOKENS = new Set([
  "white",
  "wine",
  "olive",
  "black",
  "navy",
  "blue",
  "red",
  "green",
  "grey",
  "gray",
  "beige",
  "brown",
  "pink",
  "purple",
  "orange",
  "yellow",
  "cream",
  "ivory",
  "khaki",
  "tan",
  "maroon",
  "burgundy",
  "teal",
  "coral",
  "gold",
  "silver",
  "charcoal",
  "ecru",
  "camel",
  "mustard",
  "lavender",
  "lilac",
  "mint",
  "rust",
  "sand",
  "stone",
  "off-white",
  "offwhite",
]);

export function tokenizeName(name: string): string[] {
  return normalizeKey(name)
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
}

/** Name tokens with known color words removed. */
export function garmentTokens(name: string): string[] {
  return tokenizeName(name).filter((t) => !COLOR_NAME_TOKENS.has(t));
}

export function garmentSignature(name: string): string {
  return garmentTokens(name).join(" ");
}

/**
 * RFC-025: exact parallel name skeleton — same non-color token count and order.
 */
export function parallelSkeletonMatch(a: string, b: string): boolean {
  const tokensA = garmentTokens(a);
  const tokensB = garmentTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return false;
  if (tokensA.length !== tokensB.length) return false;
  return tokensA.every((t, i) => t === tokensB[i]);
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

export function stringSimilarity(a: string, b: string): number {
  const left = normalizeKey(a);
  const right = normalizeKey(b);
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  if (left === right) return 1;
  const maxLength = Math.max(left.length, right.length);
  return 1 - levenshteinDistance(left, right) / maxLength;
}

/** Ordered pair key with item ids sorted. */
export function orderedPairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function isRetiredStatus(status: string | null): boolean {
  return status === "retired";
}

export function isValidItemStatus(status: string | null): boolean {
  return status === "active" || status === "retired" || status === "returned";
}

export function isUnbrandedName(brandName: string | null): boolean {
  if (!brandName) return false;
  const n = normalizeKey(brandName);
  return n === "unbranded" || n === "no brand" || n === "none" || n === "n/a";
}
