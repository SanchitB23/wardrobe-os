export type ColorInput = {
  hex?: string | null;
  name?: string | null;
};

const NEUTRAL_COLOR_KEYWORDS = [
  "black",
  "white",
  "gray",
  "grey",
  "charcoal",
  "navy",
  "beige",
  "cream",
  "tan",
  "brown",
  "olive",
  "denim",
];

const DEFAULT_COMPATIBILITY_SCORE = 1;

export function isNeutralColor(color: ColorInput): boolean {
  const normalizedName = color.name?.toLowerCase() ?? "";
  if (NEUTRAL_COLOR_KEYWORDS.some((keyword) => normalizedName.includes(keyword))) {
    return true;
  }

  const hex = normalizeHex(color.hex);
  if (!hex) {
    return false;
  }

  const { r, g, b } = hexToRgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;

  return saturation < 0.12 || (r > 210 && g > 210 && b > 210) || (r < 40 && g < 40 && b < 40);
}

export function areColorsCompatible(
  left: ColorInput,
  right: ColorInput,
): boolean {
  if (isNeutralColor(left) || isNeutralColor(right)) {
    return true;
  }

  const leftHex = normalizeHex(left.hex);
  const rightHex = normalizeHex(right.hex);

  if (!leftHex || !rightHex) {
    return true;
  }

  if (leftHex === rightHex) {
    return true;
  }

  const leftRgb = hexToRgb(leftHex);
  const rightRgb = hexToRgb(rightHex);
  const distance = colorDistance(leftRgb, rightRgb);

  return distance <= 120 || distance >= 220;
}

export type OutfitColorAssessment = {
  compatible: boolean;
  score: number;
  conflictingPairs: Array<{ left: string; right: string }>;
};

export function assessOutfitColorCompatibility(
  colors: readonly ColorInput[],
): OutfitColorAssessment {
  const resolvedColors = colors.filter(
    (color) => color.hex || color.name,
  );

  if (resolvedColors.length <= 1) {
    return {
      compatible: true,
      score: DEFAULT_COMPATIBILITY_SCORE,
      conflictingPairs: [],
    };
  }

  const conflictingPairs: Array<{ left: string; right: string }> = [];
  let compatiblePairs = 0;
  let totalPairs = 0;

  for (let index = 0; index < resolvedColors.length; index += 1) {
    for (let otherIndex = index + 1; otherIndex < resolvedColors.length; otherIndex += 1) {
      const left = resolvedColors[index];
      const right = resolvedColors[otherIndex];
      totalPairs += 1;

      if (areColorsCompatible(left, right)) {
        compatiblePairs += 1;
        continue;
      }

      conflictingPairs.push({
        left: left.name ?? left.hex ?? "Unknown",
        right: right.name ?? right.hex ?? "Unknown",
      });
    }
  }

  const score =
    totalPairs === 0 ? DEFAULT_COMPATIBILITY_SCORE : compatiblePairs / totalPairs;

  return {
    compatible: conflictingPairs.length === 0,
    score: Math.round(score * 100) / 100,
    conflictingPairs,
  };
}

function normalizeHex(hex: string | null | undefined): string | null {
  if (!hex) {
    return null;
  }

  const trimmed = hex.trim().replace("#", "");
  if (trimmed.length !== 6) {
    return null;
  }

  return `#${trimmed.toLowerCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function colorDistance(
  left: { r: number; g: number; b: number },
  right: { r: number; g: number; b: number },
): number {
  return Math.sqrt(
    (left.r - right.r) ** 2 + (left.g - right.g) ** 2 + (left.b - right.b) ** 2,
  );
}
