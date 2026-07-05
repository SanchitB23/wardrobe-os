export function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function calculateAverageRating(
  ratings: readonly (number | null | undefined)[],
): number | null {
  const valid = ratings.filter(
    (rating): rating is number => rating !== null && rating !== undefined,
  );

  if (valid.length === 0) {
    return null;
  }

  const sum = valid.reduce((total, rating) => total + Number(rating), 0);
  return roundToOneDecimal(sum / valid.length);
}
